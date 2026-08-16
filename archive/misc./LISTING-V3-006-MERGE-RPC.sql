-- Create RPC to safely merge item drafts without race conditions
CREATE OR REPLACE FUNCTION merge_item_draft(
  p_draft_id uuid,
  p_updates jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE item_drafts
  SET 
    draft_data = COALESCE(draft_data, '{}'::jsonb) || p_updates,
    updated_at = NOW()
  WHERE id = p_draft_id
    AND seller_id = auth.uid();
END;
$$;
