import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import { Resend } from "resend";

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

app.use(express.json());

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ 
    status: "ok", 
    stripeConfigured: !!process.env.STRIPE_SECRET_KEY,
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
    const resendApiKey = process.env.RESEND_API_KEY;

    console.log(`[NOTIFY] Data received for report: ${report?.id || 'unknown'}`);

    let adminResult = null;
    let customerResult = null;

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
            <div style="margin-top: 20px; padding: 10px; background: #f2f2f2; font-size: 12px;">
              Your rapid repair squad has been dispatched. Most repairs are completed within 60 minutes.
            </div>
          </div>
        `;

        // Wait for Admin email
        adminResult = await resend.emails.send({
          from: `Quick Fix Alert <${fromEmail}>`,
          to: adminEmail,
          subject: `🚨 NEW REPORT: ${report.reporterName || 'New Pothole'}`,
          html: emailContent
        });
        console.log(`[NOTIFY] Admin email sent:`, adminResult);

        // Wait for Customer email (if they provided an email)
        if (report.reporterEmail && report.reporterEmail.includes('@')) {
          customerResult = await resend.emails.send({
            from: `Quick Fix <${fromEmail}>`,
            to: report.reporterEmail,
            subject: `Request Received: Ticket #${report.id ? report.id.slice(0, 8) : 'N/A'}`,
            html: `
              <div style="font-family: sans-serif; border: 10px solid #000; padding: 20px; background: #fff;">
                <h1 style="text-transform: uppercase; font-size: 30px; margin: 0; letter-spacing: -1px;">WE GOT IT.</h1>
                <p>Thanks ${report.reporterName}, we've received your repair request. Our team is heading to the coordinates now.</p>
                ${emailContent}
                <p style="font-size: 12px; margin-top: 20px;">Support: help@quickfixpothole.com</p>
              </div>
            `
          });
          console.log(`[NOTIFY] Customer email sent to ${report.reporterEmail}:`, customerResult);
        }
      } catch (emailErr: any) {
        console.error("[NOTIFY] Resend Error:", emailErr?.message || emailErr);
      }
    } else {
      console.warn("[NOTIFY] RESEND_API_KEY is missing. Skipping email.");
    }

    // Respond only AFTER everything is attempted
    res.json({ 
      success: true, 
      status: "complete",
      adminSent: !!adminResult,
      customerSent: !!customerResult 
    });
  } catch (error: any) {
    console.error("[NOTIFY] Global error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal notification error" });
    }
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
