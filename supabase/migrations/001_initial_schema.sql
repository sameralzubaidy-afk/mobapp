-- 001_initial_schema.sql
-- Initial schema for P2P Kids Marketplace

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================
-- TABLE: users (profiles)
-- ============================================
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  email TEXT,
  phone TEXT,
  bio TEXT,
  avatar_url TEXT,
  node_id UUID,
  role TEXT DEFAULT 'user', -- user | moderator | admin
  subscription_tier_id UUID,
  swap_points_balance INTEGER DEFAULT 0,
  lifetime_swap_points_earned INTEGER DEFAULT 0,
  is_banned BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: nodes (geographic communities)
-- ============================================
CREATE TABLE IF NOT EXISTS nodes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  radius_miles INTEGER DEFAULT 10,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add fk from users.node_id -> nodes.id (ensure nodes exists)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_node_id') THEN
    ALTER TABLE users ADD CONSTRAINT fk_users_node_id FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL;
  END IF;
END$$;

-- ============================================
-- TABLE: items (listings)
-- ============================================
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  seller_id UUID NOT NULL,
  node_id UUID,
  title TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER, -- price in cents for cash purchases
  currency TEXT DEFAULT 'USD',
  accepts_swap_points BOOLEAN DEFAULT FALSE,
  donate_to_nonprofit BOOLEAN DEFAULT FALSE,
  category TEXT,
  condition TEXT,
  images JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'active', -- active | reserved | sold | removed | pending
  is_boosted BOOLEAN DEFAULT FALSE,
  boost_ends_at TIMESTAMPTZ,
  favorites_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  seller_reputation_score NUMERIC DEFAULT 0
);

ALTER TABLE IF EXISTS items ADD CONSTRAINT fk_items_seller_id FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS items ADD CONSTRAINT fk_items_node_id FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE SET NULL;

-- ============================================
-- TABLE: trades (transactions)
-- ============================================
CREATE TABLE IF NOT EXISTS trades (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID NOT NULL,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  status TEXT DEFAULT 'initiated', -- initiated | pending_payment | completed | cancelled | refunded
  payment_method TEXT DEFAULT 'cash', -- cash | stripe | swap_points
  swap_points_used INTEGER DEFAULT 0,
  price_cents INTEGER, -- final cash price paid (cents)
  platform_fee_cents INTEGER DEFAULT 0,
  node_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS trades ADD CONSTRAINT fk_trades_item_id FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS trades ADD CONSTRAINT fk_trades_buyer_id FOREIGN KEY (buyer_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS trades ADD CONSTRAINT fk_trades_seller_id FOREIGN KEY (seller_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- TABLE: messages (chat messages)
-- ============================================
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID,
  sender_id UUID NOT NULL,
  recipient_id UUID,
  content TEXT,
  image_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  CHECK (content IS NOT NULL OR image_url IS NOT NULL)
);

ALTER TABLE IF EXISTS messages ADD CONSTRAINT fk_messages_trade_id FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS messages ADD CONSTRAINT fk_messages_sender_id FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS messages ADD CONSTRAINT fk_messages_recipient_id FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- TABLE: reviews
-- ============================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  trade_id UUID NOT NULL,
  reviewer_id UUID NOT NULL,
  reviewee_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT,
  is_anonymous BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (trade_id, reviewer_id)
);

ALTER TABLE IF EXISTS reviews ADD CONSTRAINT fk_reviews_trade_id FOREIGN KEY (trade_id) REFERENCES trades(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS reviews ADD CONSTRAINT fk_reviews_reviewer_id FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS reviews ADD CONSTRAINT fk_reviews_reviewee_id FOREIGN KEY (reviewee_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- TABLE: subscription_tiers
-- ============================================
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  price_monthly NUMERIC(8,2) DEFAULT 0.00,
  max_active_listings INTEGER DEFAULT 3,
  max_boost_listings INTEGER DEFAULT 0,
  priority_support BOOLEAN DEFAULT FALSE,
  early_access_features BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure users.subscription_tier_id references subscription_tiers (if not already added)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_users_subscription_tier_id') THEN
    BEGIN
      ALTER TABLE users ADD CONSTRAINT fk_users_subscription_tier_id FOREIGN KEY (subscription_tier_id) REFERENCES subscription_tiers(id) ON DELETE SET NULL;
    EXCEPTION WHEN undefined_table THEN
      RAISE NOTICE 'subscription_tiers table does not exist yet; fk_users_subscription_tier_id will not be created in this run';
    END;
  END IF;
END$$;

-- ============================================
-- TABLE: points_transactions (swap points ledger)
-- ============================================
CREATE TABLE IF NOT EXISTS points_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  amount INTEGER NOT NULL, -- positive for earn, negative for spend
  reason TEXT,
  related_trade_id UUID,
  status TEXT DEFAULT 'pending', -- pending | released | cancelled | expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS points_transactions ADD CONSTRAINT fk_points_transactions_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS points_transactions ADD CONSTRAINT fk_points_transactions_trade_id FOREIGN KEY (related_trade_id) REFERENCES trades(id) ON DELETE SET NULL;

-- ============================================
-- TABLE: referrals
-- ============================================
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  referrer_id UUID NOT NULL,
  referee_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referrer_id, referee_id)
);

ALTER TABLE IF EXISTS referrals ADD CONSTRAINT fk_referrals_referrer FOREIGN KEY (referrer_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS referrals ADD CONSTRAINT fk_referrals_referee FOREIGN KEY (referee_id) REFERENCES users(id) ON DELETE CASCADE;

-- ============================================
-- TABLE: favorites
-- ============================================
CREATE TABLE IF NOT EXISTS favorites (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_id)
);

ALTER TABLE IF EXISTS favorites ADD CONSTRAINT fk_favorites_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS favorites ADD CONSTRAINT fk_favorites_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;

-- ============================================
-- TABLE: moderation_queue
-- ============================================
CREATE TABLE IF NOT EXISTS moderation_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID,
  reported_by UUID,
  reason TEXT,
  status TEXT DEFAULT 'open', -- open | in_review | resolved | dismissed
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  notes TEXT
);

ALTER TABLE IF EXISTS moderation_queue ADD CONSTRAINT fk_mod_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS moderation_queue ADD CONSTRAINT fk_mod_reporter FOREIGN KEY (reported_by) REFERENCES users(id) ON DELETE SET NULL;

-- ============================================
-- TABLE: ai_moderation_logs
-- ============================================
CREATE TABLE IF NOT EXISTS ai_moderation_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  item_id UUID,
  model TEXT,
  result JSONB,
  confidence NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS ai_moderation_logs ADD CONSTRAINT fk_ai_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;

-- ============================================
-- TABLE: cpsc_recalls (product recalls)
-- ============================================
CREATE TABLE IF NOT EXISTS cpsc_recalls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_name TEXT NOT NULL,
  recall_date DATE,
  description TEXT,
  product_codes TEXT[],
  keywords TSVECTOR,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- TABLE: boost_listings
-- ============================================
CREATE TABLE IF NOT EXISTS boost_listings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  item_id UUID NOT NULL,
  duration_minutes INTEGER DEFAULT 60,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE IF EXISTS boost_listings ADD CONSTRAINT fk_boost_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE IF EXISTS boost_listings ADD CONSTRAINT fk_boost_item FOREIGN KEY (item_id) REFERENCES items(id) ON DELETE CASCADE;

-- ============================================
-- TABLE: admin_config
-- ============================================
CREATE TABLE IF NOT EXISTS admin_config (
  key TEXT PRIMARY KEY,
  value TEXT,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES users(id) ON DELETE SET NULL
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_node_id ON users(node_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

CREATE INDEX IF NOT EXISTS idx_nodes_city_state ON nodes(city, state);
CREATE INDEX IF NOT EXISTS idx_nodes_is_active ON nodes(is_active);
-- GIST index for geography calculations (approx)
-- using postgis geography point
DO $$ BEGIN
  BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_nodes_location') THEN
      EXECUTE 'CREATE INDEX idx_nodes_location ON nodes USING gist(ST_MakePoint(longitude, latitude));';
    END IF;
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'Could not create nodes gist index - skipping';
  END;
END$$;

CREATE INDEX IF NOT EXISTS idx_items_seller_id ON items(seller_id);
CREATE INDEX IF NOT EXISTS idx_items_node_id ON items(node_id);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE INDEX IF NOT EXISTS idx_items_category ON items(category);
CREATE INDEX IF NOT EXISTS idx_items_is_boosted ON items(is_boosted) WHERE is_boosted = true;
CREATE INDEX IF NOT EXISTS idx_items_created_at ON items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_title_search ON items USING gin(to_tsvector('english', coalesce(title, '')));
CREATE INDEX IF NOT EXISTS idx_items_description_search ON items USING gin(to_tsvector('english', coalesce(description, '')));
CREATE INDEX IF NOT EXISTS idx_items_title_trgm ON items USING gin(title gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_trades_item_id ON trades(item_id);
CREATE INDEX IF NOT EXISTS idx_trades_buyer_id ON trades(buyer_id);
CREATE INDEX IF NOT EXISTS idx_trades_seller_id ON trades(seller_id);
CREATE INDEX IF NOT EXISTS idx_trades_status ON trades(status);
CREATE INDEX IF NOT EXISTS idx_trades_created_at ON trades(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_trade_id ON messages(trade_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages(recipient_id);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_reviewee_id ON reviews(reviewee_id);
CREATE INDEX IF NOT EXISTS idx_reviews_trade_id ON reviews(trade_id);

CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON points_transactions(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_favorites_user_id ON favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_favorites_item_id ON favorites(item_id);

CREATE INDEX IF NOT EXISTS idx_moderation_queue_status ON moderation_queue(status);
CREATE INDEX IF NOT EXISTS idx_moderation_queue_item_id ON moderation_queue(item_id);

CREATE INDEX IF NOT EXISTS idx_cpsc_recalls_keywords ON cpsc_recalls USING gin(keywords);
CREATE INDEX IF NOT EXISTS idx_cpsc_recalls_product_name_trgm ON cpsc_recalls USING gin(product_name gin_trgm_ops);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Calculate distance (miles) using haversine formula
CREATE OR REPLACE FUNCTION calculate_distance(lat1 DOUBLE PRECISION, lon1 DOUBLE PRECISION, lat2 DOUBLE PRECISION, lon2 DOUBLE PRECISION) RETURNS DOUBLE PRECISION AS $$
DECLARE
  radlat1 DOUBLE PRECISION := radians(lat1);
  radlat2 DOUBLE PRECISION := radians(lat2);
  dlat DOUBLE PRECISION := radians(lat2 - lat1);
  dlon DOUBLE PRECISION := radians(lon2 - lon1);
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
  earth_radius DOUBLE PRECISION := 3959; -- miles
BEGIN
  a := sin(dlat/2) * sin(dlat/2) + cos(radlat1) * cos(radlat2) * sin(dlon/2) * sin(dlon/2);
  c := 2 * atan2(sqrt(a), sqrt(1-a));
  RETURN earth_radius * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Get user average rating
CREATE OR REPLACE FUNCTION get_user_rating(user_uuid UUID) RETURNS NUMERIC AS $$
DECLARE
  avg_rating NUMERIC;
BEGIN
  SELECT COALESCE(AVG(rating), 0) INTO avg_rating FROM reviews WHERE reviewee_id = user_uuid;
  RETURN ROUND(avg_rating::numeric, 2);
END;
$$ LANGUAGE plpgsql STABLE;

-- Get completed trade count for user
CREATE OR REPLACE FUNCTION get_user_trade_count(user_uuid UUID) RETURNS INTEGER AS $$
DECLARE
  trade_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO trade_count FROM trades WHERE (buyer_id = user_uuid OR seller_id = user_uuid) AND status = 'completed';
  RETURN trade_count;
END;
$$ LANGUAGE plpgsql STABLE;

-- Calculate points balance from transactions
CREATE OR REPLACE FUNCTION calculate_points_balance(user_uuid UUID) RETURNS INTEGER AS $$
DECLARE
  balance INTEGER;
BEGIN
  SELECT COALESCE(SUM(amount), 0) INTO balance FROM points_transactions WHERE user_id = user_uuid AND status = 'released';
  RETURN balance;
END;
$$ LANGUAGE plpgsql STABLE;

-- ============================================
-- TRIGGERS
-- ============================================

-- Auto update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  -- create triggers for tables with updated_at
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_users_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_nodes_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_nodes_updated_at BEFORE UPDATE ON nodes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_items_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_items_updated_at BEFORE UPDATE ON items FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_trades_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_trades_updated_at BEFORE UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_cpsc_recalls_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_cpsc_recalls_updated_at BEFORE UPDATE ON cpsc_recalls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_admin_config_updated_at') THEN
    EXECUTE 'CREATE TRIGGER update_admin_config_updated_at BEFORE UPDATE ON admin_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();';
  END IF;
END$$;

-- Sync points balance after insert
CREATE OR REPLACE FUNCTION sync_points_balance() RETURNS TRIGGER AS $$
BEGIN
  -- When points transaction is released, update user's swap_points_balance and lifetime earned on positive amounts
  IF (NEW.status = 'released') THEN
    UPDATE users SET swap_points_balance = COALESCE(swap_points_balance, 0) + NEW.amount WHERE id = NEW.user_id;
    IF (NEW.amount > 0) THEN
      UPDATE users SET lifetime_swap_points_earned = COALESCE(lifetime_swap_points_earned, 0) + NEW.amount WHERE id = NEW.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'sync_points_balance_after_insert') THEN
    EXECUTE 'CREATE TRIGGER sync_points_balance_after_insert AFTER INSERT ON points_transactions FOR EACH ROW EXECUTE FUNCTION sync_points_balance();';
  END IF;
END$$;

-- Update favorites count when inserted/deleted
CREATE OR REPLACE FUNCTION update_favorites_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE items SET favorites_count = COALESCE(favorites_count, 0) + 1 WHERE id = NEW.item_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE items SET favorites_count = GREATEST(COALESCE(favorites_count, 0) - 1, 0) WHERE id = OLD.item_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_favorites_count_after_insert') THEN
    EXECUTE 'CREATE TRIGGER update_favorites_count_after_insert AFTER INSERT ON favorites FOR EACH ROW EXECUTE FUNCTION update_favorites_count();';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_favorites_count_after_delete') THEN
    EXECUTE 'CREATE TRIGGER update_favorites_count_after_delete AFTER DELETE ON favorites FOR EACH ROW EXECUTE FUNCTION update_favorites_count();';
  END IF;
END$$;

-- Set message expiration when a trade reaches completed
CREATE OR REPLACE FUNCTION set_message_expiration() RETURNS TRIGGER AS $$
BEGIN
  IF (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed') THEN
    -- set all messages in trade to expire in 30 days
    UPDATE messages SET expires_at = NOW() + INTERVAL '30 days' WHERE trade_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'set_message_expiration_after_trade_complete') THEN
    EXECUTE 'CREATE TRIGGER set_message_expiration_after_trade_complete AFTER UPDATE ON trades FOR EACH ROW EXECUTE FUNCTION set_message_expiration();';
  END IF;
END$$;

-- ============================================
-- ROW LEVEL SECURITY (RLS) + POLICIES
-- ============================================

-- Enable RLS on all user-visible tables
ALTER TABLE IF EXISTS users ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS nodes ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS items ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS points_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS moderation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS ai_moderation_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS cpsc_recalls ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS boost_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS admin_config ENABLE ROW LEVEL SECURITY;

-- Policy helper: admin check
-- Note: dependencies on users table role column (must be set)

-- USERS policies (create only if missing)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_select_self') THEN
    EXECUTE $policy$CREATE POLICY users_select_self ON users FOR SELECT USING (auth.uid() = id);$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_update_self') THEN
    EXECUTE $policy$CREATE POLICY users_update_self ON users FOR UPDATE USING (auth.uid() = id);$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_admin_select') THEN
    EXECUTE $policy$CREATE POLICY users_admin_select ON users FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'users_admin_update') THEN
    EXECUTE $policy$CREATE POLICY users_admin_update ON users FOR UPDATE USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- NODES policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'nodes_public_active') THEN
    EXECUTE $policy$CREATE POLICY nodes_public_active ON nodes FOR SELECT USING (is_active = true);$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'nodes_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY nodes_admin_manage ON nodes FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- ITEMS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'items_public_active') THEN
    EXECUTE $policy$CREATE POLICY items_public_active ON items FOR SELECT USING (status = 'active');$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'items_select_own') THEN
    EXECUTE $policy$CREATE POLICY items_select_own ON items FOR SELECT USING (seller_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'items_insert_own') THEN
    EXECUTE $policy$CREATE POLICY items_insert_own ON items FOR INSERT WITH CHECK (seller_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'items_update_own') THEN
    EXECUTE $policy$CREATE POLICY items_update_own ON items FOR UPDATE USING (seller_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'items_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY items_admin_manage ON items FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- TRADES policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'trades_select_own') THEN
    EXECUTE $policy$CREATE POLICY trades_select_own ON trades FOR SELECT USING (buyer_id = auth.uid() OR seller_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'trades_insert_own') THEN
    EXECUTE $policy$CREATE POLICY trades_insert_own ON trades FOR INSERT WITH CHECK (buyer_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'trades_update_own') THEN
    EXECUTE $policy$CREATE POLICY trades_update_own ON trades FOR UPDATE USING (buyer_id = auth.uid() OR seller_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'trades_admin_select') THEN
    EXECUTE $policy$CREATE POLICY trades_admin_select ON trades FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- MESSAGES policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'messages_select_own') THEN
    EXECUTE $policy$CREATE POLICY messages_select_own ON messages FOR SELECT USING (sender_id = auth.uid() OR recipient_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'messages_insert_sender') THEN
    EXECUTE $policy$CREATE POLICY messages_insert_sender ON messages FOR INSERT WITH CHECK (sender_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'messages_update_sender') THEN
    EXECUTE $policy$CREATE POLICY messages_update_sender ON messages FOR UPDATE USING (sender_id = auth.uid());$policy$;
  END IF;
END$$;

-- REVIEWS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'reviews_public_non_anonymous') THEN
    EXECUTE $policy$CREATE POLICY reviews_public_non_anonymous ON reviews FOR SELECT USING (is_anonymous = false);$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'reviews_select_own') THEN
    EXECUTE $policy$CREATE POLICY reviews_select_own ON reviews FOR SELECT USING (reviewer_id = auth.uid() OR reviewee_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'reviews_insert') THEN
    EXECUTE $policy$CREATE POLICY reviews_insert ON reviews FOR INSERT WITH CHECK (reviewer_id = auth.uid());$policy$;
  END IF;
END$$;

-- SUBSCRIPTION_TIERS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'subscription_tiers_public') THEN
    EXECUTE $policy$CREATE POLICY subscription_tiers_public ON subscription_tiers FOR SELECT USING (true);$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'subscription_tiers_admin') THEN
    EXECUTE $policy$CREATE POLICY subscription_tiers_admin ON subscription_tiers FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- POINTS_TRANSACTIONS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'points_transactions_select_own') THEN
    EXECUTE $policy$CREATE POLICY points_transactions_select_own ON points_transactions FOR SELECT USING (user_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'points_transactions_admin_select') THEN
    EXECUTE $policy$CREATE POLICY points_transactions_admin_select ON points_transactions FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'points_transactions_create_system') THEN
    EXECUTE $policy$CREATE POLICY points_transactions_create_system ON points_transactions FOR INSERT WITH CHECK (true);$policy$;
  END IF;
END$$;

-- REFERRALS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'referrals_select_own') THEN
    EXECUTE $policy$CREATE POLICY referrals_select_own ON referrals FOR SELECT USING (referrer_id = auth.uid() OR referee_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'referrals_insert') THEN
    EXECUTE $policy$CREATE POLICY referrals_insert ON referrals FOR INSERT WITH CHECK (referrer_id = auth.uid());$policy$;
  END IF;
END$$;

-- FAVORITES policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'favorites_select_own') THEN
    EXECUTE $policy$CREATE POLICY favorites_select_own ON favorites FOR SELECT USING (user_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'favorites_manage_own') THEN
    EXECUTE $policy$CREATE POLICY favorites_manage_own ON favorites FOR ALL USING (user_id = auth.uid());$policy$;
  END IF;
END$$;

-- MODERATION_QUEUE policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'moderation_admin_select') THEN
    EXECUTE $policy$CREATE POLICY moderation_admin_select ON moderation_queue FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'moderation_insert_report') THEN
    EXECUTE $policy$CREATE POLICY moderation_insert_report ON moderation_queue FOR INSERT WITH CHECK (reported_by = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'moderation_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY moderation_admin_manage ON moderation_queue FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- AI_MODERATION_LOGS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ai_logs_admin_select') THEN
    EXECUTE $policy$CREATE POLICY ai_logs_admin_select ON ai_moderation_logs FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'ai_logs_system_create') THEN
    EXECUTE $policy$CREATE POLICY ai_logs_system_create ON ai_moderation_logs FOR INSERT WITH CHECK (true);$policy$;
  END IF;
END$$;

-- CPSC_RECALLS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'cpsc_public_select') THEN
    EXECUTE $policy$CREATE POLICY cpsc_public_select ON cpsc_recalls FOR SELECT USING (true);$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'cpsc_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY cpsc_admin_manage ON cpsc_recalls FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- BOOST_LISTINGS policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'boost_select_own') THEN
    EXECUTE $policy$CREATE POLICY boost_select_own ON boost_listings FOR SELECT USING (user_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'boost_insert') THEN
    EXECUTE $policy$CREATE POLICY boost_insert ON boost_listings FOR INSERT WITH CHECK (user_id = auth.uid());$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'boost_admin_select') THEN
    EXECUTE $policy$CREATE POLICY boost_admin_select ON boost_listings FOR SELECT USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- ADMIN_CONFIG policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'admin_config_public_select') THEN
    EXECUTE $policy$CREATE POLICY admin_config_public_select ON admin_config FOR SELECT USING (true);$policy$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policy WHERE polname = 'admin_config_admin_manage') THEN
    EXECUTE $policy$CREATE POLICY admin_config_admin_manage ON admin_config FOR ALL USING (EXISTS (SELECT 1 FROM users u WHERE u.id = auth.uid() AND u.role = 'admin'));$policy$;
  END IF;
END$$;

-- ============================================
-- SEED DATA: subscription_tiers, admin_config, nodes
-- ============================================

INSERT INTO subscription_tiers (id, name, price_monthly, max_active_listings, max_boost_listings, priority_support, early_access_features)
VALUES
  (uuid_generate_v4(), 'free', 0.00, 3, 0, FALSE, FALSE),
  (uuid_generate_v4(), 'basic', 4.99, 10, 1, FALSE, TRUE),
  (uuid_generate_v4(), 'plus', 9.99, 25, 2, TRUE, TRUE),
  (uuid_generate_v4(), 'premium', 14.99, 100, 5, TRUE, TRUE)
ON CONFLICT DO NOTHING;

-- Admin config seeds (safe to re-run)
INSERT INTO admin_config (key, value, description) VALUES
  ('minimum_item_price', '20', 'Minimum cash price for items ($)'),
  ('platform_fee_percent', '5', 'Platform fee percent charged to sellers (percent)'),
  ('buyer_fee_percent', '2', 'Buyer fee percent (percent)'),
  ('swap_points_earning_rate', '1', 'Swap points earned per $1 spent (points)'),
  ('swap_points_pending_days', '3', 'Days for points to remain pending'),
  ('swap_points_expiration_days', '90', 'Days before swap points expire'),
  ('swap_points_max_percent_per_purchase', '50', 'Maximum percent of purchase that can be covered by SP'),
  ('ai_confidence_threshold', '0.75', 'AI confidence threshold for auto-approval'),
  ('ai_confidence_threshold_gpt4', '0.80', 'AI confidence to use GPT-4 fallback'),
  ('max_image_upload_mb', '10', 'Max bytes per image upload (MB)')
ON CONFLICT (key) DO NOTHING;

-- Nodes seed
INSERT INTO nodes (id, name, city, state, zip_code, latitude, longitude, radius_miles, is_active)
VALUES
  (uuid_generate_v4(), 'Norwalk CT Community', 'Norwalk', 'CT', '06850', 41.117447, -73.408230, 10, true),
  (uuid_generate_v4(), 'Little Falls NJ Community', 'Little Falls', 'NJ', '07424', 40.881893, -74.216759, 10, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- End of migration
-- ============================================
