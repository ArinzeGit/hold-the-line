-- Leaderboard + Supabase Auth + device hash (run in Supabase SQL Editor)
-- One row per authenticated user; keeps highest score only; stores email for prizes.

-- Add columns (safe if already applied)
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS device_hash text;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE leaderboard ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- One entry per user (multiple NULL user_id allowed for legacy rows)
ALTER TABLE leaderboard DROP CONSTRAINT IF EXISTS leaderboard_user_id_key;
ALTER TABLE leaderboard ADD CONSTRAINT leaderboard_user_id_key UNIQUE (user_id);

DROP INDEX IF EXISTS idx_leaderboard_score;
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);

-- Remove anonymous insert; scores go through RPC only
DROP POLICY IF EXISTS "Anyone can insert scores" ON leaderboard;

-- Authenticated users cannot INSERT/UPDATE table directly (RPC uses SECURITY DEFINER)
-- No INSERT/UPDATE policies = deny for table writes from clients

-- RPC: upsert score; GREATEST keeps best score; name updates when new score beats old
CREATE OR REPLACE FUNCTION public.submit_leaderboard_score(p_name text, p_score int, p_device_hash text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  em text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF p_score < 0 OR p_score > 1000000 THEN
    RAISE EXCEPTION 'Invalid score';
  END IF;

  SELECT au.email INTO em FROM auth.users au WHERE au.id = uid;

  INSERT INTO leaderboard (user_id, email, name, score, device_hash, updated_at)
  VALUES (uid, em, trim(p_name), p_score, p_device_hash, now())
  ON CONFLICT (user_id) DO UPDATE SET
    score = GREATEST(leaderboard.score, EXCLUDED.score),
    name = CASE WHEN EXCLUDED.score > leaderboard.score THEN EXCLUDED.name ELSE leaderboard.name END,
    email = (SELECT au.email FROM auth.users au WHERE au.id = uid),
    device_hash = COALESCE(EXCLUDED.device_hash, leaderboard.device_hash),
    updated_at = now();

  RETURN json_build_object('ok', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_leaderboard_score(text, int, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_leaderboard_score(text, int, text) TO authenticated;
