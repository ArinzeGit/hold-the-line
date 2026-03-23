# Supabase Leaderboard Setup Guide

This guide covers the global leaderboard, **Supabase Auth** (email + OTP), **one row per player** (best score only), **device hash** for audit, and **email** for prize outreach.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details and create the project (wait 2–3 minutes)

## Step 2: Base Leaderboard Table (if starting fresh)

If you **do not** have a `leaderboard` table yet, run this in **SQL Editor**:

```sql
CREATE TABLE IF NOT EXISTS leaderboard (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read leaderboard"
    ON leaderboard FOR SELECT
    USING (true);

CREATE POLICY "Anyone can insert scores"
    ON leaderboard FOR INSERT
    WITH CHECK (true);
```

## Step 3: Auth, RPC, and prize fields (required for production)

Run the migration in **`supabase/migrations/001_leaderboard_auth.sql`** (copy its full contents into **SQL Editor** → **Run**).

This will:

- Add `user_id`, `email`, `device_hash`, `updated_at`
- Enforce **one row per authenticated user** (`UNIQUE (user_id)`)
- Add `submit_leaderboard_score(...)` so scores are written only via **RPC** (no anonymous table inserts)
- Keep **only the player’s highest score** (`GREATEST`) and update display name when they beat their own score
- Store **email** from `auth.users` for exports / prize emails

After running it, **drop** the old open insert policy if it still exists:

```sql
DROP POLICY IF EXISTS "Anyone can insert scores" ON leaderboard;
```

## Step 4: Email **OTP** (code in the email)

There is **no separate “OTP” switch** in Supabase. Magic link and OTP use the **same** API (`signInWithOtp`). What changes is the **email template**: if it includes the token, users see a **code** to type.

1. **Authentication** → **Providers** → **Email** → enable **Email**.
2. **Authentication** → **URL configuration**:
   - **Site URL** = your game URL (e.g. `https://yourdomain.com` or `http://localhost:8080`)
   - **Redirect URLs** = add the same URL(s) where the game runs.
3. **Authentication** → **Email Templates** → open the template used for **Magic Link** / sign-in (often **“Magic Link”**).
   - Add a line that shows the one-time code using Supabase’s variable: **`{{ .Token }}`**  
   - Example body line: `Your code is: {{ .Token }}`  
   - [Supabase docs: Passwordless email → With OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless#with-otp)

After saving, the email should show a **6-digit (or similar) code** players can paste into the game.

### Step 4b: Auth **rate limits** (if you see “rate limit exceeded”)

Supabase limits how often **Send code** can hit the auth API (`/auth/v1/otp`):

- **Per project** (all users combined).
- **Per email** (cooldown before another email to the same address).

You can review and adjust limits in the dashboard: **Authentication** → **Rate Limits** ([docs](https://supabase.com/docs/guides/auth/rate-limits)).

**Common causes while testing:**

- Tapping **Send code** many times in a row.
- **Built-in email** has a **low hourly cap** for sending; heavy testing can hit it (custom SMTP or waiting helps).

**What to do:** wait **15–60 minutes**, then try **once**. For development, use **Authentication → Rate Limits** to loosen OTP limits if your plan allows, or test with fewer sends.

## Step 5: API keys in the game

1. **Settings** → **API**: copy **Project URL** and **anon public** key
2. In `script.js`, set `SUPABASE_URL` and `SUPABASE_ANON_KEY`

## How it works in-game

- Players play **without** signing in.
- If they qualify for the **Top 10**, they enter **email + display name**, tap **Send code**, then enter the **code from the email** and tap **Verify & save**.
- A **device hash** (stored in `localStorage` + hashed) is sent with the score for **audit** and anti-abuse review; **deduplication** is by **`user_id`** (one leaderboard row per account).
- If the same user improves their score, the RPC **keeps the higher score** and updates the display name when the new score is higher.

## Exporting emails for prizes

Query the table (SQL or Table Editor):

```sql
SELECT email, name, score, device_hash, updated_at
FROM leaderboard
WHERE user_id IS NOT NULL
ORDER BY score DESC;
```

## Custom SMTP (production email)

Supabase’s **built-in** email is for testing: strict limits, and it may only send to **team** addresses unless you use custom SMTP.

1. Pick a provider that supports **SMTP** (e.g. [Resend](https://resend.com/docs/send-with-supabase-smtp), [SendGrid](https://www.twilio.com/docs/sendgrid/for-developers/sending-email/getting-started-smtp), [AWS SES](https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html), [Postmark](https://postmarkapp.com/developer/user-guide/send-email-with-smtp), [Brevo](https://help.brevo.com/hc/en-us/articles/7924908994450-Send-transactional-emails-using-Brevo-SMTP)).
2. In their dashboard, create SMTP credentials: **host**, **port** (often **587** with STARTTLS), **username**, **password**, and a **From** address they allow (e.g. `no-reply@yourdomain.com`).
3. In Supabase: **Authentication** → **SMTP Settings** ([direct link pattern](https://supabase.com/dashboard/project/_/auth/smtp)) → enable **Custom SMTP** and enter:
   - **Sender email** / **Sender name**
   - **Host**, **Port**, **Username**, **Password**
4. Save. Then open **Authentication** → **Rate Limits** and raise email/OTP limits if needed (defaults may start low after enabling SMTP).

Official guide: [Send emails with custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

## Troubleshooting

- **RPC error / permission denied**: Re-run grants in the migration file; ensure the client is logged in (`submit_leaderboard_score` requires `auth.uid()`).
- **Email has a link but no code**: Edit the **Magic Link** email template and add **`{{ .Token }}`** (see Step 4).
- **“Invalid code”**: Typo, expired code, or template missing `{{ .Token }}`.
- **“Rate limit exceeded”**: Too many **Send code** requests; wait and retry, or adjust **Authentication → Rate Limits** (see Step 4b).
- **Legacy rows** with `user_id` NULL: still readable; new submissions use authenticated rows only.

## Free tier

Supabase free tier is usually enough for a small game leaderboard and Auth.
