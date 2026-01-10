-- filepath: supabase/migrations/20260110000000_badges_v2.sql

-- Create badges table
CREATE TABLE IF NOT EXISTS badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  category TEXT NOT NULL CHECK (category IN ('sp_earning', 'sp_spending', 'trades', 'subscription', 'special')),
  icon_url TEXT,
  threshold INT NOT NULL DEFAULT 0, -- Milestone value (e.g., 100 for "100 SP Earned")
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_active BOOLEAN DEFAULT TRUE,
  sort_order INT DEFAULT 0
);

-- User badges junction table
CREATE TABLE IF NOT EXISTS user_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  awarded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, badge_id) -- User can earn each badge only once
);

-- Enable RLS
ALTER TABLE badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- RLS Policies for badges (Read only for everyone)
DROP POLICY IF EXISTS "Public can view badges" ON badges;
CREATE POLICY "Public can view badges" ON badges
  FOR SELECT USING (true);

-- RLS Policies for user_badges
-- Users can see their own awarded badges
DROP POLICY IF EXISTS "Users can view their own badges" ON user_badges;
CREATE POLICY "Users can view their own badges" ON user_badges
  FOR SELECT USING (auth.uid() = user_id);

-- Public can see user badges (for profile display)
DROP POLICY IF EXISTS "Anyone can view user awarded badges" ON user_badges;
CREATE POLICY "Anyone can view user awarded badges" ON user_badges
  FOR SELECT USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_badge ON user_badges(badge_id);

-- Seed initial badges (13 badges)
INSERT INTO badges (name, description, category, threshold) VALUES
('SP Earner - Bronze', 'Earned 10 Swap Points', 'sp_earning', 10),
('SP Earner - Silver', 'Earned 50 Swap Points', 'sp_earning', 50),
('SP Earner - Gold', 'Earned 100 Swap Points', 'sp_earning', 100),
('SP Earner - Platinum', 'Earned 500 Swap Points', 'sp_earning', 500),
('SP Spender - Bronze', 'Spent 10 Swap Points', 'sp_spending', 10),
('SP Spender - Silver', 'Spent 50 Swap Points', 'sp_spending', 50),
('First Trade', 'Completed your first trade', 'trades', 1),
('10 Trades', 'Completed 10 trades', 'trades', 10),
('50 Trades', 'Completed 50 trades', 'trades', 50),
('Trial Member', 'Joined Kids Club+ Trial', 'subscription', 0),
('1-Month Subscriber', '1 month of active subscription', 'subscription', 30),
('6-Month Subscriber', '6 months of active subscription', 'subscription', 180),
('1-Year Subscriber', '1 year of active subscription', 'subscription', 365)
ON CONFLICT (name) DO NOTHING;
