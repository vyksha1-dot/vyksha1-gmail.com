import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import { Resend } from "resend";
import twilio from "twilio";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

const getStripe = () => {
  let stripe: Stripe | null = null;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    console.error("STRIPE_SECRET_KEY is not configured. Payments will fail.");
    return null;
  }
  return new Stripe(key);
};

// Help helper for Twilio
const sendSMS = async (to: string, message: string) => {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;

  if (!sid || !token || !from) {
    console.warn("[SMS] Twilio credentials missing. Skipping SMS.");
    return null;
  }

  try {
    const client = twilio(sid, token);
    const result = await client.messages.create({
      body: message,
      from: from,
      to: to
    });
    console.log(`[SMS] Message sent to ${to}: ${result.sid}`);
    return result;
  } catch (err: any) {
    console.error(`[SMS] Failed to send message to ${to}:`, err.message);
    return null;
  }
};

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
    twilioConfigured: !!process.env.TWILIO_ACCOUNT_SID,
    environment: process.env.NODE_ENV
  });
});

app.post("/api/notify-report", async (req, res) => {
  try {
    const { report } = req.body || {};
    
    if (!report) {
      console.warn("[NOTIFY] Received empty request body");
      return res.status(400).json({ error: "Missing report data" });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'vik@quickfixpothole.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    const resendApiKey = process.env.RESEND_API_KEY;

    console.log(`[NOTIFY] New Report #${report.id.slice(0, 8)} from ${report.reporterName || 'Anonymous'}`);
    console.log(`[NOTIFY] Destination Email: ${adminEmail}`);

    let emailResult = { admin: null, customer: null };
    let smsResult = { admin: null, customer: null };

    // 1. Email via Resend
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const fromEmail = 'onboarding@resend.dev'; // Resend Default
        
        let attachments: any[] = [];
        let imageHtml = '';

        // If we have a base64 image, prepare it as an attachment
        if (report.imageUrl && report.imageUrl.startsWith('data:')) {
          try {
            const matches = report.imageUrl.match(/^data:([A-Za-z-+/]+);base64,(.+)$/);
            if (matches && matches.length === 3) {
              const contentType = matches[1];
              const base64Data = matches[2];
              
              attachments.push({
                filename: 'pothole_evidence.jpg',
                content: Buffer.from(base64Data, 'base64'),
                contentType: contentType,
                content_id: 'pothole_image'
              });
              
              // Use CID to reference the attachment in HTML
              imageHtml = `
                <div style="margin-top: 15px; border: 4px solid #000; overflow: hidden; background: #000;">
                  <img src="cid:pothole_image" style="width: 100%; display: block;" alt="Pothole Evidence" />
                </div>
              `;
            }
          } catch (imgErr) {
            console.error("[NOTIFY] Image processing error:", imgErr);
            // Fallback to direct embedding if CID fails, though CID is preferred
            imageHtml = `
              <div style="margin-top: 15px; border: 4px solid #000; overflow: hidden; background: #000;">
                <img src="${report.imageUrl}" style="width: 100%; display: block;" alt="Pothole Evidence" />
              </div>
            `;
          }
        }
        
        const emailContent = `
          <div style="font-family: sans-serif; border: 10px solid #000; padding: 20px; background: #fff; max-width: 600px;">
            <h1 style="text-transform: uppercase; font-size: 30px; margin: 0; letter-spacing: -1px; background: #000; color: #fff; padding: 10px;">🚨 NEW REPAIR REQUEST</h1>
            <div style="padding: 20px; border: 2px solid #000; margin-top: 10px;">
              <p style="font-size: 18px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 5px;">TICKET: #${report.id.slice(0, 8)}</p>
              <p><strong>CUSTOMER NAME:</strong> ${report.reporterName || 'STAY ANONYMOUS'}</p>
              <p><strong>MOBILE NUMBER:</strong> <a href="tel:${report.reporterPhone}">${report.reporterPhone || 'NOT PROVIDED'}</a></p>
              <p><strong>CUSTOMER EMAIL:</strong> ${report.reporterEmail || 'NOT PROVIDED'}</p>
              <hr style="border: 1px dashed #000;" />
              <p><strong>DISPATCH ADDRESS:</strong> ${report.location?.address || 'GPS COORDINATES ONLY'}</p>
              <p><strong>COORDINATES:</strong> ${report.location?.latitude}, ${report.location?.longitude}</p>
              <p><strong>SEVERITY:</strong> <span style="color: ${report.severity === 'high' ? 'red' : 'black'}; font-weight: bold;">${report.severity?.toUpperCase()}</span></p>
              <p><strong>DETAILS:</strong> ${report.description || 'No additional notes.'}</p>
              ${imageHtml}
            </div>
            <div style="margin-top: 20px; text-align: center; font-size: 10px; opacity: 0.5;">
              QUICK FIX INFRASTRUCTURE NOTIFICATION SYSTEM
            </div>
          </div>
        `;

        emailResult.admin = await resend.emails.send({
          from: `Quick Fix Dispatch <${fromEmail}>`,
          to: adminEmail,
          replyTo: report.reporterEmail || adminEmail,
          subject: `🚨 NEW POTHOLE: ${report.reporterName || 'Urgent'} - #${report.id.slice(0, 8)}`,
          html: emailContent,
          attachments: attachments
        }) as any;

        console.log(`[NOTIFY] Admin Email Sent. ID: ${JSON.stringify(emailResult.admin)}`);

        if (report.reporterEmail && report.reporterEmail.includes('@')) {
          emailResult.customer = await resend.emails.send({
            from: `Quick Fix <${fromEmail}>`,
            to: report.reporterEmail,
            subject: `Request Received: Ticket #${report.id ? report.id.slice(0, 8) : 'N/A'}`,
            html: `
              <div style="font-family: sans-serif; border: 10px solid #000; padding: 20px; background: #fff; max-width: 600px;">
                <h1 style="text-transform: uppercase; font-size: 30px; margin: 0; letter-spacing: -1px; background: #000; color: #fff; padding: 10px;">WE GOT IT.</h1>
                <div style="padding: 20px; border: 2px solid #000; margin-top: 10px;">
                  <p>Thanks <strong>${report.reporterName}</strong>, we've received your repair request. Our team is heading to your coordinates now.</p>
                  <p style="font-size: 14px; font-weight: bold; border-bottom: 2px solid #000; padding-bottom: 5px;">YOUR TICKET: #${report.id.slice(0, 8)}</p>
                  ${imageHtml}
                  <p style="font-size: 10px; margin-top: 10px; opacity: 0.6;">*60-minute rapid response target active for your zone.</p>
                </div>
              </div>
            `,
            attachments: attachments
          }) as any;
        }
      } catch (err: any) {
        console.error("[NOTIFY] Email Error:", err.message);
      }
    }

    // 2. SMS via Twilio
    const smsMessage = `🚨 QUICK FIX ALERT: New report from ${report.reporterName || 'Anonymous'}. Ticket #${report.id.slice(0, 8)}. Address: ${report.location?.address || 'GPS Location'}. Severity: ${report.severity.toUpperCase()}. Phone: ${report.reporterPhone || 'N/A'}.`;
    
    if (adminPhone) {
      smsResult.admin = await sendSMS(adminPhone, smsMessage) as any;
    }

    if (report.reporterPhone) {
      const customerMsg = `QUICK FIX: We received your pothole report (Ticket #${report.id.slice(0, 8)}). A technician is being dispatched. Track here: ${process.env.APP_URL || 'Check App'}`;
      smsResult.customer = await sendSMS(report.reporterPhone, customerMsg) as any;
    }

    res.json({ success: true, email: emailResult, sms: smsResult });
  } catch (error: any) {
    console.error("[NOTIFY] Global error:", error);
    res.status(500).json({ error: "Internal notification error" });
  }
});

app.post("/api/notify-status-change", async (req, res) => {
  try {
    const { report, newStatus } = req.body;
    
    if (!report || !newStatus) {
      return res.status(400).json({ error: "Missing report or status" });
    }

    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    const adminEmail = process.env.ADMIN_EMAIL || 'vik@quickfixpothole.com';
    const resendApiKey = process.env.RESEND_API_KEY;

    console.log(`[STATUS] Changing status of #${report.id.slice(0, 8)} to ${newStatus}`);
    console.log(`[STATUS] Admin Email: ${adminEmail}`);

    let smsResult = null;
    let emailResult = null;

    // Build the status change message
    let message = "";
    switch (newStatus) {
      case 'in-progress':
        message = `🚧 QUICK FIX: Technician arrived! Repair in progress for Ticket #${report.id.slice(0, 8)}. Estimated 30 mins to completion.`;
        break;
      case 'repaired':
        message = `✅ QUICK FIX: Repair complete for Ticket #${report.id.slice(0, 8)}! Thank you for helping improve our roads.`;
        break;
      default:
        message = `QUICK FIX: Update for Ticket #${report.id.slice(0, 8)}: Status changed to ${newStatus.toUpperCase()}.`;
    }

    // SMS to Customer
    if (report.reporterPhone) {
      smsResult = await sendSMS(report.reporterPhone, message);
    }

    // SMS to Admin (Notify of state change)
    if (adminPhone) {
      const adminStatusMsg = `🛠 QUICK FIX: Status of Ticket #${report.id.slice(0, 8)} (${report.reporterName || 'Anonymous'}) changed to ${newStatus.toUpperCase()}.`;
      await sendSMS(adminPhone, adminStatusMsg);
    }

    // Email to Customer
    if (report.reporterEmail && resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        emailResult = await resend.emails.send({
          from: `Quick Fix <onboarding@resend.dev>`,
          to: report.reporterEmail,
          subject: `Status Update: Ticket #${report.id.slice(0, 8)}`,
          html: `
            <div style="font-family: sans-serif; border: 10px solid #000; padding: 20px; background: #fff;">
              <h1 style="text-transform: uppercase; font-size: 30px; margin: 0; letter-spacing: -1px;">STATUS UPDATE</h1>
              <p style="font-weight:bold; font-size: 20px;">Current Status: ${newStatus.toUpperCase()}</p>
              <hr style="border: 2px solid #000;" />
              <p>${message}</p>
              <p style="font-size: 12px; margin-top: 20px;">Ticket: #${report.id}</p>
            </div>
          `
        });
      } catch (err: any) {
        console.error("[STATUS-NOTIFY] Email error:", err.message);
      }
    }

    res.json({ success: true, sms: !!smsResult, email: !!emailResult });
  } catch (error: any) {
    console.error("[STATUS-NOTIFY] Global Error:", error);
    res.status(500).json({ error: "Internal error" });
  }
});

app.post("/api/send-custom-sms", async (req, res) => {
  try {
    const { reportId, customerPhone, message } = req.body;
    
    if (!customerPhone || !message) {
      return res.status(400).json({ error: "Missing phone or message" });
    }

    // Optional: Log which admin sent this if we had auth here
    console.log(`[SMS] Sending custom message to Ticket #${reportId?.slice(0, 8)}`);

    const result = await sendSMS(customerPhone, message);
    
    if (result) {
      res.json({ success: true, sid: result.sid });
    } else {
      res.status(500).json({ error: "Failed to send SMS. Check Twilio logs." });
    }
  } catch (error: any) {
    console.error("[CUSTOM-SMS] Global Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/create-checkout-session", async (req, res) => {
  try {
    const { reportId, price, userEmail } = req.body;
    const stripeClient = getStripe();
    
    if (!stripeClient) {
      return res.status(500).json({ error: "Stripe not configured" });
    }

    if (!reportId || !price || !userEmail) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const session = await stripeClient.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Pothole Repair - Ticket #${reportId.slice(0, 8)}`,
              description: "1-Hour Rapid Pavement Repair Service",
            },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: userEmail,
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=success&reportId=${reportId}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=cancel&reportId=${reportId}`,
      metadata: { reportId: reportId },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Vercel Entry Point
export default app;

// Standalone Server Entry Point
const isMain = process.env.NODE_ENV !== "production" || !process.env.VERCEL;

if (isMain) {
  const startServer = async () => {
    const PORT = 3000;
    if (process.env.NODE_ENV !== "production") {
      const { createServer } = await import("vite");
      const vite = await createServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  };
  startServer();
}
