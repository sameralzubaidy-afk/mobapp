-- Migration 097: Add trigger for Admin Notifications on Listing Approval
-- This trigger automatically creates an admin notification when a new listing is created with status 'pending'
-- or when an existing listing's status is changed to 'pending'.

-- 1. Create the notification function
CREATE OR REPLACE FUNCTION public.fn_on_listing_pending_notification()
RETURNS TRIGGER AS $$
DECLARE
    v_seller_name TEXT;
BEGIN
    -- Only trigger when the row is entering 'pending'
    -- Note: we cannot rely on `UPDATE OF status` because other triggers may change NEW.status.
    IF (NEW.status = 'pending') THEN
        IF (TG_OP = 'UPDATE' AND (OLD.status IS NOT DISTINCT FROM NEW.status)) THEN
            RETURN NEW;
        END IF;

        -- Get seller name for the notification
        SELECT name INTO v_seller_name
        FROM public.profiles
        WHERE user_id = NEW.seller_id;

        -- Create notification for ALL admins
        INSERT INTO public.admin_notifications (
            admin_id,
            notification_type,
            entity_type,
            entity_id,
            title,
            message
        )
        SELECT 
            au.id,
            'listing_pending_approval',
            'item',
            NEW.id,
            'New Listing Needs Approval',
            COALESCE(v_seller_name, 'A user') || ' posted a new listing: "' || NEW.title || '" (Item: ' || NEW.id::text || ')'
        FROM role_based_access_control rbac
        JOIN auth.users au ON au.id = rbac.user_id
        WHERE rbac.role = 'admin';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger
DROP TRIGGER IF EXISTS tr_listing_pending_notification ON public.items;
CREATE TRIGGER tr_listing_pending_notification
    AFTER INSERT OR UPDATE
    ON public.items
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_on_listing_pending_notification();

-- 3. Verification queries (commented out for production migration)
-- SELECT * FROM pg_trigger WHERE tgname = 'tr_listing_pending_notification';
-- SELECT * FROM admin_notifications;
