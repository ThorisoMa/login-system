# Login System

A small Express + Passport authentication project with PostgreSQL-backed users and sessions.

## What was improved

- Replaced the in-memory user array with PostgreSQL persistence.
- Added PostgreSQL-backed sessions instead of Express's development-only MemoryStore.
- Passwords are hashed with bcrypt using a stronger cost factor.
- Added input validation and normalized email addresses.
- Added duplicate-email protection at both application and database levels.
- Login errors no longer reveal whether an email address exists.
- Added Helmet security headers and a restrictive Content Security Policy.
- Added rate limiting to login and registration endpoints.
- Added secure, HTTP-only, SameSite session cookies and production HTTPS support.
- Added proper 404/500 error pages and graceful database shutdown.
- Removed non-functional social-login buttons and unnecessary client-side JavaScript.
- Improved accessibility, mobile responsiveness, semantic HTML, and visual consistency.
- Added Vercel configuration and environment-variable documentation.

## Requirements

- Node.js 20+
- PostgreSQL

## Local setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a `.env` file from `.env.example` and set:
   - `DATABASE_URL`
   - `SESSION_SECRET`

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open `http://localhost:3000`.

The application creates the `users` table automatically on startup.

## Vercel deployment

Set these environment variables in Vercel:

- `DATABASE_URL`
- `SESSION_SECRET`
- `NODE_ENV=production`

Use a hosted PostgreSQL database such as Neon, Supabase, or another PostgreSQL provider. Do not store the database password or session secret in GitHub.

The application exports the Express app for Vercel and only calls `app.listen()` during local execution.

## Important production notes

This is a strong small-project foundation, not a complete identity platform. Before using it for a high-value production application, add email verification, password reset, MFA, account lockout/abuse monitoring, CSRF protection appropriate to your deployment, audit logging, and automated tests.
