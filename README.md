# 1 Hour Pothole Repair - Rapid Response Platform

Professional on-demand pothole repair platform with dynamic pricing, real-time tracking, and Stripe integration.

## 🚀 Custom Domain & Deployment Guide

Follow these steps to move your app from the AI Studio sandbox to your own custom domain (e.g., `www.1hourpothole.com`).

### 1. Export to GitHub
1. In the AI Studio sidebar, click the **Settings (Gear Icon)**.
2. Select **"Export to GitHub"**.
3. Authorize your account and create a new repository (e.g., `pothole-repair-ops`).

### 2. Deploy to a Host (Node.js Support Required)
Because this app uses an Express backend, you need a host that supports full-stack applications.
- **Recommended**: [Vercel](https://vercel.com) or [Render.com](https://render.com).
- **Steps (Vercel)**:
  1. Log in to Vercel with your GitHub.
  2. Click **"Add New Project"** and select your repository.
  3. Under **Environment Variables**, add the keys from your `.env.example`:
     - `STRIPE_SECRET_KEY` (from your Stripe Dashboard)
     - `GEMINI_API_KEY` (if used for AI features)
  4. Click **Deploy**.

### 3. Connect Your Domain
1. In Vercel Project Settings, go to **Domains**.
2. Enter your domain (e.g., `1hourpothole.com`) and click Add.
3. Vercel will provide an **A Record** or **CNAME Record**.
4. Log in to your domain provider (GoDaddy, Google Domains, etc.) and add these records to your DNS settings.

### 🚩 GoDaddy Specific Instructions

#### If you only want to use GoDaddy for the Name (Recommended):
1. Log in to your **GoDaddy Portfolio**.
2. Click **DNS** next to your domain.
3. Add a record: Type `A`, Name `@`, Value `76.76.21.21` (if using Vercel).
4. Add a record: Type `CNAME`, Name `www`, Value `cname.vercel-dns.com`.
5. Your app is now hosted on Vercel but uses your GoDaddy name!

#### Troubleshooting: "It's Not Working"
If your domain shows an error or doesn't load:
1. **Check for "Forwarding"**: Go to GoDaddy DNS settings and scroll down to "Forwarding". If it is turned on, delete it. It conflicts with your A/CNAME records.
2. **Check Nameservers**: Ensure your GoDaddy domain is using "Default Nameservers". If you are using custom ones (like Cloudflare), the A records won't work.
3. **Patience**: DNS changes can take 5 to 60 minutes. Open your site in an **Incognito/Private** window to bypass your browser's memory.
4. **Vercel Build Error**: Go to your Vercel Dashboard and check the "Deployments" tab. If the build status is "Failed", check the logs. It usually means an Environment Variable (like `STRIPE_SECRET_KEY`) is missing.

#### Full-Stack Routing on Vercel
Vercel is great for static sites, but this app has a server. If your API routes return 404, ensure you have added a `vercel.json` file (provided in this repo) to tell Vercel to route traffic to the server.

#### Payment Persistence Checklist (Stripe)
If clicking "Confirm Repair" doesn't take you to the Stripe payment screen:
1. **Environment Variables**: Go to Vercel Settings > Environment Variables. You MUST add `STRIPE_SECRET_KEY` with your secret key from Stripe (`sk_live_...`).
2. **APP_URL**: Add an environment variable `APP_URL` set to `https://1hourpotholerepair.com`. This tells Stripe where to send the user after they pay.
3. **Redeploy**: If you just added the `vercel.json` file, you MUST go to the "Deployments" tab in Vercel and click **Redeploy** on the latest build to activate the new routing rules.
4. **Browser Console**: Right-click the page, select "Inspect", and go to the "Console" tab. If you see an error like "Stripe not configured", it confirms Step 1 is missing.

#### If you want to host the files on GoDaddy (Advanced):
*Note: You must have a "Web Hosting" (cPanel) plan that supports Node.js.*
1. Log in to your **GoDaddy cPanel**.
2. Search for **"Setup Node.js App"**.
3. Create a new application:
   - **Node.js version**: Select 18.x or higher.
   - **Application root**: Upload your files here via File Manager.
   - **Application startup file**: Set this to `server.ts` (or `dist/server.js` if pre-built).
4. Run **"npm install"** using the cPanel terminal.
5. Set environment variables (Stripe/Firebase keys) in the "Environment Variables" section of the Node.js tool.
6. Click **Restart**.

### 4. Authorize the Domain (Crucial)
To prevent security blocks, you must add your new domain to your third-party services:

#### Firebase (Login support)
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Select your project.
3. Go to **Authentication** > **Settings** > **Authorized Domains**.
4. Add your domain name (e.g., `1hourpothole.com`).

#### Stripe (Payment support)
1. Go to your [Stripe Dashboard](https://dashboard.stripe.com/).
2. Go to **Settings** > **Checkout and Payment Links**.
3. Under **Customer Portal** or **Allowed Redirects**, ensure your new domain is permitted.

---

## 🛠 Tech Stack
- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Framer Motion.
- **Backend**: Node.js (Express), Vite Middleware.
- **Database**: Google Firebase (Firestore).
- **Payments**: Stripe Checkout.
- **Maps**: React-Leaflet (OpenStreetMap).

## 📊 Operations
- **Standard Hours (6 AM - 5 PM)**: Base rates ($299 / $499 / Inspection).
- **After Hours (5 PM - 6 AM)**: Dynamic doubling for hazard pay and logistics.
- **Danger Zone**: Mandatory structural inspection triggered before work begins.

---
*Created with Google AI Studio Build.*
