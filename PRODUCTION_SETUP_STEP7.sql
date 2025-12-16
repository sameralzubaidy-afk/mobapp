-- ========================================
-- STEP 7: Create Trigger
-- ========================================

CREATE OR REPLACE FUNCTION update_admin_config_timestamp() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS admin_config_updated_at_trigger ON admin_config;
CREATE TRIGGER admin_config_updated_at_trigger BEFORE UPDATE ON admin_config FOR EACH ROW EXECUTE FUNCTION update_admin_config_timestamp();
