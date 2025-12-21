-- ========================================
-- STEP 3: Create indexes
-- ========================================

CREATE INDEX idx_admin_config_key ON admin_config(key);
CREATE INDEX idx_admin_config_category ON admin_config(category);
CREATE INDEX idx_admin_config_is_active ON admin_config(is_active);
