# Gym Console — White Label

A gym management console (memberships, PIN/QR check-ins, invoices and receipts, renewal reminders, feedback) that you can re-brand for each customer.

## 1. Branding per customer

There are two ways to brand an install, and both feed the same settings:

- **Build-time defaults:** edit `brand.config.json` (gym name, tagline, logo URL, address, phone, email, website, GSTIN, UPI ID, currency, phone country code, tax rate, receipt footer). To ship a logo with the build, put it in `public/` and set `"logoUrl": "logo.png"`.
- **Runtime:** log in as Admin → **Admin Panel → Gym Branding**. Upload a logo and edit the details. Changes are saved to Firestore (`settings/branding`) and show up on every terminal right away. The invoice's *Gym Billing Profile* tab edits the same settings.

The name and logo appear in the header, login screen, kiosk portal, invoices, receipts, member cards, reports, CSV exports, message templates (`{GYM}`), the browser tab title and the favicon.

## 2. Firebase (one project per customer)

Copy `.env.example` to `.env.local` and fill in that customer's Firebase web app config.
If you leave it empty, the app runs in local-only mode (data stays in the browser's localStorage), which is handy for demos.

```bash
npm install
npm run dev
```

## 3. SMS and email

Messages are sent through the `sendMessage` Cloud Function (`functions/`). It sends SMS through **Twilio** and email over **SMTP** (Gmail, Zoho, SES, SendGrid, …), and it only delivers to phone numbers and emails that belong to registered members.

```bash
npm --prefix functions install
firebase use <project-id>
firebase functions:secrets:set TWILIO_ACCOUNT_SID
firebase functions:secrets:set TWILIO_AUTH_TOKEN
firebase functions:secrets:set SMTP_URL        # smtps://user:app-password@smtp.gmail.com:465
cat > functions/.env <<'ENV'
TWILIO_FROM=+1XXXXXXXXXX
MAIL_FROM="Your Gym <hello@yourgym.com>"
DATABASE_ID=(default)
REGION=asia-south1
ENV
firebase deploy --only functions
```

Cloud Functions need the Firebase **Blaze** (pay-as-you-go) plan. Sending SMS to Indian numbers also requires DLT registration of your sender ID and templates (Twilio or any other provider).
Until the function is deployed, the SMS and Email buttons fall back to opening the device's SMS or mail app. For emails, the PDF is downloaded so it can be attached by hand.

## 4. Receipts, printing and PDFs

Invoices, advance-payment receipts, member cards and the operations report print through an isolated frame, so only the document itself is printed, with no blank or cut-off pages. They can also be downloaded or viewed as A4 PDFs, and emailed as a PDF attachment.

## 5. Deploy

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to `main`. Add the `VITE_FIREBASE_*` values as repository **Variables** (Settings → Secrets and variables → Actions → Variables), and set Settings → Pages → Source to **GitHub Actions**.

Default logins are `owner@example.com` / `ChangeMe-Owner1` and `admin@example.com` / `ChangeMe-Admin1`. **Change them in the Admin Panel on day one.**
