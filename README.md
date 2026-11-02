# Harsh's AI

Harsh's AI is a private AI-assisted interview and knowledge workspace built
with Next.js, TypeScript, Supabase, and Tailwind CSS.

## Current implementation

- Email/password signup and login
- Password recovery and logout
- Google OAuth entry point
- Cookie-based Supabase SSR authentication
- Protected dashboard routes
- PostgreSQL schema with Row Level Security
- Private document, resume, and session attachment storage
- Secure document upload, signed download, and deletion APIs
- Vector-ready document chunks
- Usage and estimated-cost database records
- Secure, one-time administrator bootstrap procedure

OpenAI, Resend, integration health checks, and final deployment configuration
are implemented in later project stages.

## Environment variables

Copy `.env.example` to `.env.local` for local development. Never commit
`.env.local` or any secret.

Required Supabase values:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://gyvnpszmmcfijjjtwkok.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
```

Use current Supabase publishable and secret keys when available. The legacy
anonymous and service-role aliases are retained only for compatibility.

## Supabase setup

1. Open the Supabase SQL Editor.
2. Run `supabase/migrations/202611020001_initial_schema.sql`.
3. Under Authentication URL Configuration, set:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
4. Add the deployed Vercel callback URL after deployment.

The migration creates private buckets named:

- `user-documents`
- `resumes`
- `session-attachments`

Uploads are restricted to authenticated user-owned paths and a 10 MB limit.

## Initial administrator

The administrator is assigned by a restricted database procedure, not by a
frontend email comparison.

1. Register `harshath.kn2911@gmail.com`.
2. Verify the email address.
3. In the Supabase SQL Editor, run:

```sql
select public.bootstrap_initial_admin();
```

The function refuses to run if the account is unverified or an administrator
already exists.

## Google OAuth

Create Google OAuth web credentials without enabling paid Google Cloud
services. In Google Cloud, use this authorized redirect URI:

```text
https://gyvnpszmmcfijjjtwkok.supabase.co/auth/v1/callback
```

Enter the Google client ID and client secret directly in Supabase under
Authentication Providers. Do not place the Google client secret in frontend
code or commit it to Git.

## Optional local development

Local development requires a supported Node.js LTS release:

```bash
npm install
npm run dev
```

The application is then available at `http://localhost:3000`.

## Vercel deployment

Import `harshathkn-dev/harsh-ai` into Vercel and select the Hobby plan for
personal development. Configure environment variables in Vercel rather than
uploading `.env.local`. Do not enable paid add-ons.

Vercel installs dependencies and runs `npm run build` remotely, so Node.js does
not have to be installed on the computer used to upload the repository.

## Security

- Secret keys are server-only.
- Supabase secret keys must never use a `NEXT_PUBLIC_` prefix.
- All application tables use Row Level Security.
- Storage buckets are private.
- Downloads use short-lived signed URLs.
- `.env.local`, private keys, build output, and dependencies are ignored by Git.

## Budget policy

The intended infrastructure plans are Supabase Free, Vercel Hobby, and Resend
Free. OpenAI is pay-as-you-go with an application-level target budget of
USD 5 per month. No implementation in this repository enables automatic credit
purchases or paid infrastructure.
