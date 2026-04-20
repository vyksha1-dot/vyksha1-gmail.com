import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import Stripe from "stripe";
import dotenv from "dotenv";
import { Resend } from "resend";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();

export default app;

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
    const { report } = req.body;
    if (!report || !report.location) {
      return res.status(400).json({ error: "Invalid report data" });
    }

    const adminEmail = process.env.ADMIN_EMAIL || 'vyksha1@gmail.com';
    const resendApiKey = process.env.RESEND_API_KEY;
    
    console.log(`[ALERT] NEW POTHOLE REPORT FILED:
      ID: ${report.id}
      REPORTER: ${report.reporterName}
      ADDRESS: ${report.location.address || 'GPS Only'}
    `);

    // Resend Email Notification
    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        // If domain is not verified, Resend only allows sending to the account owner via onboarding@resend.dev
        const fromEmail = 'Quick Fix <onboarding@resend.dev>';
        
        await resend.emails.send({
          from: fromEmail,
          to: adminEmail,
          subject: `🚨 NEW REPORT: ${report.reporterName}`,
          html: `
            <div style="font-family: sans-serif; border: 10px solid #000; padding: 20px; background: #fff;">
              <h1 style="text-transform: uppercase; font-size: 40px; margin: 0; line-height: 0.8; letter-spacing: -2px;">NEW POTHOLE<br/><span style="background: #eaff00; padding: 0 5px;">REPORTED.</span></h1>
              <div style="margin-top: 20px; font-weight: bold; font-size: 12px; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 20px; text-transform: uppercase;">
                Ticker #${report.id.slice(0, 8)} | Severity: ${report.severity}
              </div>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; width: 100px; font-size: 10px; text-transform: uppercase; font-weight: bold;">Reporter</td>
                  <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${report.reporterName}</td>
                </tr>
                <tr>
                  <td style="padding: 10px; border: 1px solid #ddd; font-size: 10px; text-transform: uppercase; font-weight: bold;">Location</td>
                  <td style="padding: 10px; border: 1px solid #ddd; background: #f4f4f4;">${report.location.address || 'GPS Tagged'}</td>
                </tr>
              </table>
              <div style="margin-top: 20px;">
                <h4 style="margin: 0; font-size: 10px; text-transform: uppercase; opacity: 0.5;">Description</h4>
                <p style="font-size: 16px; font-weight: bold; margin-top: 5px;">${report.description || 'No description provided.'}</p>
              </div>
            </div>
          `
        });
      } catch (emailError) {
        console.error("Email notification failed:", emailError);
      }
    }

    res.json({ success: true, alerted: adminEmail });
  } catch (error: any) {
    console.error("Notification Error:", error);
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
            unit_amount: price * 100, // Stripe expects cents
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      customer_email: userEmail,
      success_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=success&reportId=${reportId}`,
      cancel_url: `${process.env.APP_URL || 'http://localhost:3000'}/?payment=cancel&reportId=${reportId}`,
      metadata: {
        reportId: reportId,
      },
    });

    res.json({ id: session.id, url: session.url });
  } catch (error: any) {
    console.error("Stripe Error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Only listen if this is the main module (not on Vercel)
const isMain = process.env.NODE_ENV !== "production" || !process.env.VERCEL;

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else if (isMain) {
    // Only serve static files via Express if we are running the standalone server
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  if (isMain) {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

if (isMain) {
  startServer();
}
