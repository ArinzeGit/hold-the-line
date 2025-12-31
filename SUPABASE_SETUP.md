# Supabase Leaderboard Setup Guide

This guide will help you set up a global leaderboard for your game using Supabase.

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up/login
2. Click "New Project"
3. Fill in your project details:
   - **Name**: e.g., "Hold the Line Leaderboard"
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose closest to your users
4. Click "Create new project" and wait for it to finish setting up (2-3 minutes)

## Step 2: Create the Leaderboard Table

1. In your Supabase project dashboard, go to **SQL Editor** (left sidebar)
2. Click **New Query**
3. Copy and paste this SQL:

```sql
-- Create leaderboard table
CREATE TABLE IF NOT EXISTS leaderboard (
    id BIGSERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    score INTEGER NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()) NOT NULL
);

-- Create index on score for faster queries
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE leaderboard ENABLE ROW LEVEL SECURITY;

-- Create policy: Anyone can read (view leaderboard)
CREATE POLICY "Anyone can read leaderboard"
    ON leaderboard FOR SELECT
    USING (true);

-- Create policy: Anyone can insert (submit scores)
-- Optional: Add rate limiting here if needed
CREATE POLICY "Anyone can insert scores"
    ON leaderboard FOR INSERT
    WITH CHECK (true);
```

4. Click **Run** (or press Ctrl/Cmd + Enter)
5. You should see "Success. No rows returned"

## Step 3: Get Your API Credentials

1. In Supabase dashboard, go to **Settings** (gear icon) → **API**
2. Find these values:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys" → "anon public")
3. Copy both values

## Step 4: Configure the Game

1. Open `script.js`
2. Find these lines near the top (around line 236):

```javascript
const SUPABASE_URL = 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

3. Replace `YOUR_SUPABASE_URL` with your Project URL
4. Replace `YOUR_SUPABASE_ANON_KEY` with your anon/public key

Example:
```javascript
const SUPABASE_URL = 'https://abcdefghijklmnop.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFiY2RlZmdoaWprbG1ub3AiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTYxNjIzOTAyMiwiZXhwIjoxOTMxODE1MDIyfQ.example-key';
```

## Step 5: Test It

1. Open your game in a browser
2. Play and get a score
3. Check the game over screen - you should see the leaderboard (or "Loading..." if it's the first time)
4. If you get a high score, enter your name and it should appear in the leaderboard

## Optional: View Your Data

1. In Supabase dashboard, go to **Table Editor** (left sidebar)
2. Click on the `leaderboard` table
3. You should see all submitted scores

## Optional: Add Rate Limiting

To prevent spam, you can add rate limiting by modifying the insert policy in SQL Editor:

```sql
-- Drop existing insert policy
DROP POLICY IF EXISTS "Anyone can insert scores" ON leaderboard;

-- Create rate-limited policy (example: max 10 inserts per hour per IP)
-- Note: This is a simplified example. For production, consider using Supabase Edge Functions
CREATE POLICY "Rate limited score submission"
    ON leaderboard FOR INSERT
    WITH CHECK (
        (SELECT COUNT(*) FROM leaderboard 
         WHERE created_at > NOW() - INTERVAL '1 hour') < 1000
    );
```

## Troubleshooting

### Leaderboard shows "Loading..." forever
- Check browser console (F12) for errors
- Verify your Supabase URL and key are correct
- Make sure the table was created successfully

### Scores not submitting
- Check browser console for errors
- Verify RLS policies are set correctly
- Make sure the table exists and has the correct columns

### "Supabase not configured" warning
- Make sure you've replaced the placeholder values in `script.js`
- The values should NOT be `'YOUR_SUPABASE_URL'` or `'YOUR_SUPABASE_ANON_KEY'`

## Security Notes

- The `anon` key is safe to use in client-side code - it's meant for public access
- Row Level Security (RLS) policies control what users can do
- The anon key cannot access admin functions or sensitive data
- For additional security, consider:
  - Adding client-side rate limiting
  - Using Supabase Edge Functions for score validation
  - Adding CAPTCHA for score submission

## Free Tier Limits

Supabase free tier includes:
- 500 MB database space
- 2 GB bandwidth
- 50,000 monthly active users
- This should be more than enough for a game leaderboard!

If you exceed these limits, Supabase will notify you before any service interruption.

