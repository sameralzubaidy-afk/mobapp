-- ========================================
-- STEP 5: Create RLS Policies
-- ========================================

CREATE POLICY admin_config_select_all ON admin_config FOR SELECT USING (TRUE);
CREATE POLICY admin_config_update_service_role ON admin_config FOR UPDATE USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY admin_config_delete_service_role ON admin_config FOR DELETE USING (auth.role() = 'service_role');
CREATE POLICY admin_config_insert_service_role ON admin_config FOR INSERT WITH CHECK (auth.role() = 'service_role');
