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

    const adminEmail = process.env.ADMIN_EMAIL || 'vyksha1@gmail.com';
    const adminPhone = process.env.ADMIN_PHONE_NUMBER;
    const resendApiKey = process.env.RESEND_API_KEY;

    console.log(`[NOTIFY] Data received for report: ${report?.id || 'unknown'}`);

    let emailResult = { admin: null, customer: null };
    let smsResult = { admin: null, customer: null };

    // 1. Email via Resend
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const fromEmail = 'onboarding@resend.dev';
        
        const emailContent = `
          <div style="font-family: sans-serif; border: 10px solid #000; padding: 20px; background: #fff;">
            <h1 style="text-transform: uppercase; font-size: 30px; margin: 0; letter-spacing: -1px;">POTHOLE REPAIR REQUEST</h1>
            <p style="font-weight:bold; text-transform:uppercase;">Ticket: #${report.id ? report.id.slice(0, 8) : 'N/A'}</p>
            <hr style="border: 2px solid #000;" />
            <p><strong>Reporter:</strong> ${report.reporterName || 'Anonymous'}</p>
            <p><strong>Address:</strong> ${(report.location && report.location.address) || 'GPS Location'}</p>
            <p><strong>Severity:</strong> ${report.severity || 'Medium'}</p>
            <p><strong>Notes:</strong> ${report.description || 'No notes'}</p>
          </div>
        `;

        emailResult.admin = await resend.emails.send({
          from: `Quick Fix Alert <${fromEmail}>`,
          to: adminEmail,
          subject: `🚨 NEW REPORT: ${report.reporterName || 'New Pothole'}`,
          html: emailContent
        }) as any;

        if (report.reporterEmail && report.reporterEmail.includes('@')) {
          emailResult.customer = await resend.emails.send({
            from: `Quick Fix <${fromEmail}>`,
            to: report.reporterEmail,
            subject: `Request Received: Ticket #${report.id ? report.id.slice(0, 8) : 'N/A'}`,
            html: `
              <div style="font-family: sans-serif; border: 10px solid #000; padding: 20px; background: #fff;">
                <h1 style="text-transform: uppercase; font-size: 30px; margin: 0; letter-spacing: -1px;">WE GOT IT.</h1>
                <p>Thanks ${report.reporterName}, we've received your repair request. Our team is heading to the coordinates now.</p>
                ${emailContent}
              </div>
            `
          }) as any;
        }
      } catch (err: any) {
        console.error("[NOTIFY] Email Error:", err.message);
      }
    }

    // 2. SMS via Twilio
    const smsMessage = `🚨 QUICK FIX ALERT: New report from ${report.reporterName || 'Anonymous'}. Ticket #${report.id.slice(0, 8)}. Address: ${report.location?.address || 'GPS Location'}. Severity: ${report.severity.toUpperCase()}.`;
    
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
    const adminEmail = process.env.ADMIN_EMAIL || 'vyksha1@gmail.com';
    const resendApiKey = process.env.RESEND_API_KEY;

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
