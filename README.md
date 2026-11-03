# Harsh's AI

Harsh's AI is a private AI-assisted interview and knowledge workspace built
with Next.js, TypeScript, Supabase, and Tailwind CSS.

## Current implementation

- Email/password signup and login
- Password recovery and logout
- Google OAuth entry point
- Cookie-based Supabase SSR authentication
- Protected dashboard routes
- Responsive dashboard with live Supabase overview data
- Session creation, lifecycle controls, deletion, and history views
- Interview, meeting, and general session types
- Real document, AI usage, and account overview pages
- OpenAI Realtime speech-to-speech conversations over WebRTC
- Live user and assistant transcripts with idempotent Supabase persistence
- Microphone mute, AI interruption, volume, connection state, and waveform controls
- PostgreSQL schema with Row Level Security
- Private document, resume, and session attachment storage
- Secure document upload, signed download, and deletion APIs
- Vector-ready document chunks
- Usage and estimated-cost database records
- Secure, one-time administrator bootstrap procedure

Document AI processing, Resend, and final integration health checks are
implemented in later project stages.

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
3. Run `supabase/migrations/202611020002_session_types.sql`.
4. Run `supabase/migrations/202611030001_realtime_voice.sql`.
5. Under Authentication URL Configuration, set:
   - Site URL: `http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
6. Add the deployed Vercel callback URL after deployment.

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

## Realtime Voice AI

Realtime Voice AI uses OpenAI's GA WebRTC interface. The browser sends
microphone audio directly to OpenAI using a short-lived client secret minted by
an authenticated server route. The permanent API key never reaches browser
JavaScript, and raw microphone audio is not stored.

Required Vercel environment variable:

```dotenv
OPENAI_API_KEY=
```

Optional configuration:

```dotenv
OPENAI_REALTIME_MODEL=gpt-realtime-2.1
OPENAI_REALTIME_TRANSCRIPTION_MODEL=gpt-4o-mini-transcribe
OPENAI_REALTIME_DEFAULT_VOICE=marin
OPENAI_MONTHLY_BUDGET_USD=5
```

Realtime token prices are not returned as invoice amounts by the API. To
display application-level cost estimates, configure the four optional
per-million-token pricing variables documented in `.env.example`. When those
rates are absent, the application records actual token usage but explicitly
shows cost as pending instead of inventing a price. Provider invoices remain
authoritative.

Voice conversations require HTTPS outside localhost and a current Chrome or
Edge browser with microphone permission. Start the database session before
selecting **Start Voice AI**.

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
