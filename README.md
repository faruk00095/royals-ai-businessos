# ROYAL’S AI BusinessOS

An original, responsive business workspace for Indian MSMEs. The app includes business-scoped records, password-based sessions, business onboarding, customer and supplier directories, product records, GST-aware invoice issue, payment and expense capture, CRM follow-ups, audit events, operational summaries, and provider interfaces. Local development uses SQLite; the checked-in Prisma schema does not yet target PostgreSQL.

## Local setup

Requirements: Node.js 22.5+. The repository runs locally with SQLite. The included database setup script uses Node's built-in `node:sqlite` module. Production deployments need a separately reviewed PostgreSQL Prisma schema and migration setup; the checked-in schema currently targets SQLite.

1. For a fresh clone, copy `.env.example` to `.env.local` and set a random `AUTH_SECRET` (at least 32 characters). The sample config uses the local SQLite database.
2. Install dependencies: `npm install`.
3. Generate Prisma client: `npm run db:generate`.
4. Create the local development database: `npm run db:init`.
5. Start the app: `npm run dev` and open `http://localhost:3000`.
6. Create an account and follow business onboarding.

The first account that creates a business receives the owner role. Records are always queried with the signed-in user's business membership. `DEMO_MODE` is not a bypass: the app does not ship shared demo credentials or fake verification results.

## Current functionality

- Email/password signup and sign-in with bcrypt password hashes and HTTP-only signed session cookies.
- Business setup and owner membership, plus role/permission foundation.
- Business-scoped customers, suppliers, products and opening stock movements, invoices, invoice items, payment receipts, expenses, leads, follow-up tasks, and audit logs.
- GST line and invoice totals calculated deterministically in integer paise. Intrastate invoices split GST between CGST/SGST; interstate invoices use IGST based on configured state codes.
- ROYAL AI screen provides read-only answers calculated directly from persisted business records. It does not pretend a model is connected.
- Responsive navigation and an operational dashboard with daily sales graphed from saved invoices.
- Automation rules can be saved for review; a background worker does not execute them yet.

## Integration configuration

GST/PAN verification, payment links, WhatsApp, and external AI require an authorized provider and server-side credentials. Adapter interfaces currently fail closed when unconfigured. Do not put provider secrets in browser code. Implement provider API calls and data-protection review before enabling any connector. GSTIN onboarding validates shape only and never claims government verification.

### Auth0 sign-in (optional)

Create an Auth0 **Regular Web Application**, then set `AUTH0_DOMAIN`, `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and a random `AUTH0_SECRET` in `.env.local`. Set `APP_BASE_URL` to the app's base URL. In the Auth0 application, add `<APP_BASE_URL>/auth/callback` under Allowed Callback URLs, `<APP_BASE_URL>` under Allowed Logout URLs, and `<APP_BASE_URL>` under Allowed Web Origins. For local development, the base URL is `http://localhost:3000`. Auth0 users must have a verified email; verified emails map to the matching BusinessOS account or create a new one. Password sign-in remains available. Auth0 settings are optional, so without them the sign-in option is replaced by a setup note and the existing login continues to work.

## Scope and production readiness

This repository is a functioning foundation, not the entire product scope in the master brief. Accounting ledgers and statutory reports, purchases, automatic stock decrement/transfer, full document templates/PDF, email verification/reset, OTP/Google/2FA, rate limiting, file storage, automation workers, live integrations, subscriptions, super-admin functions, export, and full demo seed data remain follow-on modules. Do not treat the operational report snapshot as a statutory statement or tax filing. Use HTTPS, rotate secrets, configure backups, and complete security review before production deployment.

#LOGIN 
details email arfarooq5@gmail password 123 or else you can create a diffrent account

