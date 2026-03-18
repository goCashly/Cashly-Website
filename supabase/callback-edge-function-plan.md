# Callback Form Security Upgrade Plan

## Goal

Replace the current browser-to-database callback form flow with a safer setup:

`Browser form -> Cloudflare Turnstile -> Supabase Edge Function -> callback_requests table`

This keeps the database insert logic on the server side while still working with the current static website.

## Why We Are Changing It

Right now the callback form is set up to send data from the frontend directly to Supabase REST.

That works for a quick MVP, but it has two drawbacks:

- the database write endpoint is directly callable from the browser
- RLS helps, but it does not stop spam or bot traffic by itself

The safer version moves the database insert into a Supabase Edge Function and requires a valid Turnstile verification before any row is saved.

## Final Architecture

### Frontend

The frontend will keep the existing callback form in `index.html`, but it will no longer insert directly into Supabase.

Instead, it will:

- render a Cloudflare Turnstile widget
- collect the Turnstile token after the user completes the check
- send the form payload and token to a Supabase Edge Function URL

### Edge Function

The Edge Function will:

- accept cross-origin requests from the website
- validate the incoming payload
- verify the Turnstile token with Cloudflare
- insert one row into `public.callback_requests`
- assign a generated request ID
- store the raw request payload for manual review or sync later
- return a clean JSON success or error response

### Database

The browser will no longer write directly to the database.

Instead, the Edge Function will write into a dedicated `public.callback_requests` table using the server-side `SUPABASE_SERVICE_ROLE_KEY`.

## What Will Be Public

Even in the safer version, one route is still public:

- the Edge Function URL, for example:
  `https://<project-ref>.supabase.co/functions/v1/submit-callback-request`

That is normal. Browser routes cannot truly be hidden.

The difference is that:

- the browser will not talk to the database REST route anymore
- the browser will not receive the service role key
- Turnstile verification will happen before insert

Also public on the frontend:

- the Turnstile site key

That is expected and safe. The secret Turnstile key stays server-side inside Supabase function secrets.

## Files I Plan To Change

### Frontend files

- `index.html`
  - add the Turnstile widget container
  - load the Turnstile client script
  - keep the existing callback form fields

- `js/cashly-modern.js`
  - remove the current direct Supabase insert logic
  - collect the Turnstile token
  - submit the form to the Edge Function with `fetch`
  - handle success and error messages

- `js/cashly-config.js`
  - replace raw database config with only public frontend-safe values, such as:
    - Edge Function URL
    - Turnstile site key

### Supabase files

- `supabase/functions/submit-callback-request/index.ts`
  - create the Edge Function
  - verify Turnstile
  - insert a callback intake record
  - return the generated request ID

- `supabase/config.toml`
  - configure the function for public invocation
  - set `verify_jwt = false` for this form endpoint

## Proposed Request Flow

### 1. User submits the form

The user fills out:

- first name
- last name
- email
- phone
- message

### 2. Turnstile runs in the browser

Turnstile returns a one-time verification token after the user passes the check.

### 3. Frontend sends one request to the Edge Function

The frontend sends JSON like this:

```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "phone": "555-555-5555",
  "message": "Please call me back",
  "turnstile_token": "token-from-widget",
  "source_page": "/index.html"
}
```

### 4. Edge Function verifies Turnstile

The function sends the token to Cloudflare's verification endpoint.

If verification fails:

- no insert happens
- the function returns an error

If verification passes:

- the function inserts one `callback_requests` row
- the row stores the submitted fields plus the raw JSON payload
- the response returns the generated request ID

### 5. Frontend shows the result

The browser gets a JSON response and updates the success/error message already shown under the form.

## Validation Rules I Plan To Add

### In the browser

- require the existing required fields
- require a Turnstile token before submit

### In the Edge Function

- trim all text fields
- reject empty required fields
- reject oversized payloads
- reject invalid email shape
- reject missing phone values
- reject requests without a valid Turnstile token

Optionally, I can also add:

- a hidden honeypot field
- origin checks
- layered server-side rate limiting before and after Turnstile

## Secrets and Config

### Public frontend config

These are safe in the frontend:

- Supabase Edge Function URL
- Cloudflare Turnstile site key

### Server-side secrets

These stay only inside Supabase:

- `TURNSTILE_SECRET_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_URL`

## Supabase Function Auth Choice

I plan to make this function publicly callable by setting:

```toml
[functions.submit-callback-request]
verify_jwt = false
```

Reason:

- your callback form is public
- users are not logged in
- Turnstile plus server-side rate limits will act as the abuse-control layers

This means the function route is public, but the function still controls whether the request is accepted.

## Security Outcome

### Better than the current direct insert setup

- browser no longer writes directly to the database
- service role key stays server-side
- Turnstile blocks a large class of automated spam
- the function can reject floods before calling Turnstile
- validation moves to the function
- public submissions no longer mutate `contacts`

### Still not "perfect security"

No public form is perfectly secure.

This plan is meant to be strong, practical, and appropriate for a marketing/contact callback form.

If abuse ever becomes heavy, the next layer would be:

- logging and alerting
- IP reputation checks
- email notifications for suspicious patterns

## Rollout Plan

### Phase 1

Add the function and Turnstile integration without changing the visible form layout.

### Phase 2

Switch the existing callback submit flow in `js/cashly-modern.js` from direct insert to Edge Function submit.

### Phase 3

Use the Edge Function as the only public submission path for the callback form.

### Phase 4

Test:

- valid human submission
- missing token
- invalid token
- missing required fields
- repeated spam-like submit attempts

## What I Need From You Before Final Deployment

I can prepare all code locally first, but for the final live setup you will need:

- your Supabase project reference
- your Cloudflare Turnstile site key
- your Cloudflare Turnstile secret key
- access to deploy the Supabase Edge Function

## What I Will Do Next If You Approve

1. Create the Supabase Edge Function scaffold.
2. Add Turnstile to the callback form in `index.html`.
3. Replace the current direct insert logic in `js/cashly-modern.js`.
4. Update `js/cashly-config.js` so it only contains frontend-safe values.
5. Make the function write into `callback_requests` and leave `contacts` untouched.
6. Give you the exact Supabase deploy commands and secret setup steps.

## Official References

These are the official docs this plan is based on:

- Supabase Edge Functions:
  `https://supabase.com/docs/guides/functions`
- Function configuration and `verify_jwt`:
  `https://supabase.com/docs/guides/functions/function-configuration`
- Browser CORS for Edge Functions:
  `https://supabase.com/docs/guides/functions/cors`
- Cloudflare Turnstile with Supabase:
  `https://supabase.com/docs/guides/functions/examples/cloudflare-turnstile`
- Supabase function secrets:
  `https://supabase.com/docs/guides/functions/secrets`
- Supabase Row Level Security:
  `https://supabase.com/docs/guides/database/postgres/row-level-security`
