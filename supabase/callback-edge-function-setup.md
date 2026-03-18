# Callback Edge Function Setup

## What This Setup Does

After these steps, the homepage callback form will use:

`index.html -> Turnstile -> Supabase Edge Function -> callback_requests table`

## Files Already Prepared

The code is already in the repo:

- `index.html`
- `js/cashly-modern.js`
- `js/cashly-config.js`
- `supabase/config.toml`
- `supabase/functions/submit-callback-request/index.ts`

## 1. Create Your Turnstile Widget

In Cloudflare Turnstile:

1. Create a new widget for your site domain.
2. Copy the `site key`.
3. Copy the `secret key`.

You will use:

- the `site key` in the frontend config
- the `secret key` in Supabase function secrets

## 2. Create The Callback Intake Table

Run:

- `supabase/callback_requests.sql`

This creates a dedicated `public.callback_requests` table for website submissions.

Each request is stored as its own row with:

- a generated `id`
- the extracted form fields
- a `normalized_phone`
- the original `raw_payload` as `jsonb`
- a `sync_status` you can manage manually later

This is intentionally separate from `public.contacts`, so the public form does not overwrite CRM data.

The same SQL also creates a small rate-limit table used by the Edge Function.

That table stores:

- a hashed server-side rate-limit key, not raw IP data
- separate buckets for callback attempts and successful submissions
- how many requests were made in each active time window

## 3. Install Or Use The Supabase CLI

If you do not already have it:

1. Install the Supabase CLI.
2. Log in:

```bash
supabase login
```

3. Link this repo to your Supabase project:

```bash
supabase link --project-ref YOUR_PROJECT_REF
```

## 4. Set The Edge Function Secret

Set the Turnstile secret in Supabase:

```bash
supabase secrets set TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET_KEY
```

Notes:

- `SUPABASE_URL` is already available inside hosted Supabase Edge Functions
- `SUPABASE_SERVICE_ROLE_KEY` is already available inside hosted Supabase Edge Functions
- only `TURNSTILE_SECRET_KEY` needs to be added manually for this function

## 5. Deploy The Edge Function

Deploy the prepared function:

```bash
supabase functions deploy submit-callback-request
```

Because `supabase/config.toml` contains:

```toml
[functions.submit-callback-request]
verify_jwt = false
```

the function can be called by the public callback form without user auth.

## 6. Fill In The Frontend Config

Open:

- `js/cashly-config.js`

Add:

```js
window.CASHLY_CONFIG = Object.freeze({
  callbackForm: {
    endpoint: "https://YOUR_PROJECT_REF.supabase.co/functions/v1/submit-callback-request",
    turnstileSiteKey: "YOUR_TURNSTILE_SITE_KEY"
  }
});
```

## 7. Test The Form

Test these cases on the homepage:

1. Valid submission with Turnstile completed
2. Submit without completing Turnstile
3. Invalid email
4. Missing required fields

Expected result:

- valid requests should insert one row into `callback_requests`
- invalid or bot-like requests should be blocked before insert
- no public request should update `contacts`
- repeated attempts should be rate-limited before Turnstile verification
- after 5 successful submissions from the same source within 15 minutes, the function should return a rate-limit error
- after 12 successful submissions from the same source within 24 hours, the function should return a daily quota error

## Optional Local Function Testing

If you want to test locally with the Supabase CLI, you can serve functions locally and provide an env file with the Turnstile secret.

Example:

```bash
supabase functions serve --no-verify-jwt
```

For local testing, you may also want a local `.env` or `.env.local` that contains:

```bash
TURNSTILE_SECRET_KEY=YOUR_TURNSTILE_SECRET_KEY
```

## What Is Now Public vs Private

### Public

- the Turnstile site key
- the Edge Function URL

### Private

- the Turnstile secret key
- the Supabase service role key
- the hashed rate-limit keys used for abuse controls

The browser no longer inserts directly into the database.
