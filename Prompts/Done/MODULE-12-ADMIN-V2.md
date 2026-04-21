# MODULE-12: ADMIN PANEL V2

**Version:** 2.0  
**Last Updated:** December 7, 2025  
**Status:** Ready for Implementation  
**Dependencies:** MODULE-11 (Subscriptions V2), MODULE-09 (Swap Points V2), MODULE-08 (Badges V2), MODULE-06 (Trade Flow V2), MODULE-04 (Item Listing V2)

---

## V2 PRODUCT MODEL OVERVIEW

### Kids Club+ Subscription Integration
- **Subscription Plan**: $7.99/month with 30-day no-card trial
- **Trial Activation**: Automatic on user signup
- **Grace Period**: 90 days post-cancellation before status changes to 'cancelled'
- **Admin Controls**: Subscription override, manual extension, refund processing

### Swap Points (SP) Gating
- **Earning**: Only trial/active subscribers earn SP
- **Spending**: Only trial/active subscribers spend SP
- **Transaction Fees**: $0.99 (subscribers), $2.99 (non-subscribers)
- **Admin Operations**: Manual SP adjustment, wallet inspection, ledger audit

### Badge System
- **Automatic Awards**: Triggers on SP milestones, trade completion, subscription tenure
- **Manual Override**: Admin can award/revoke badges for special events
- **Leaderboard**: Badge count ranking with admin visibility

---

## V2 CHANGELOG

### Major Changes from V1
1. **Subscription Management Dashboard**
   - Real-time subscriber count (trial/active/grace/cancelled)
   - Manual subscription actions (extend trial, force cancellation, refund)
   - Subscription analytics (churn rate, LTV, trial conversion)

2. **SP Wallet Operations**
   - Wallet inspection (balance, ledger history)
   - Manual SP adjustments (add/deduct with admin note)
   - SP audit logs (all admin modifications tracked)

3. **Badge Administration**
   - View all user badges
   - Manual award/revoke with reason
   - Badge statistics (most earned, rarest badges)

4. **Enhanced Reporting**
   - Revenue dashboard (subscription MRR, transaction fee breakdown)
   - SP economy metrics (total earned, total spent, circulation)
   - User engagement (DAU/MAU with subscription cohorts)

---

## CRITICAL V2 RULES

### Subscription Admin Actions
- **MUST** log all manual subscription changes in `admin_activity_log`
- **MUST** validate admin role before any subscription override
- **MUST** notify user when admin extends trial or processes refund

### SP Wallet Admin Actions
- **MUST** create ledger entry with `admin_adjustment` reason for manual SP changes
- **MUST** include admin user ID and note in all SP modifications
- **MUST** prevent negative wallet balances (validate before deduction)

### Badge Admin Actions
- **MUST** log reason when manually awarding/revoking badges
- **CANNOT** delete badge records (soft delete only via `revoked_at` timestamp)
- **MUST** maintain badge audit trail

---

## AGENT-OPTIMIZED PROMPT TEMPLATE

```text
@agent: claude-sonnet-4.5
@mode: extended-reasoning
@autonomy: high

AGENT INSTRUCTIONS:
1. Read the entire task before generating code.
2. Produce a short plan (3-6 steps) and list any missing dependencies.
3. Generate the requested files exactly at the `filepath` locations.
4. Create unit tests for critical logic using the project's test framework.
5. Run a self-check list: type-check, lint, and run the new tests (if environment available).
6. Add concise TODO comments where manual verification is required (secrets, environment variables, or infra setup).

VERIFICATION STEPS (agent must print results):
- TypeScript type-check: `npm run type-check` (or `yarn tsc`)
- Linting: `npm run lint`
- Tests: `npm test -- --testPathPattern=<new tests>`

ERROR HANDLING RULES:
- If a required file/dependency is missing, stop and report exact missing paths.
- For runtime secrets (API keys), inject clear TODOs and do not attempt to store secrets in code.
- For database schema mismatches, add migration stubs and mark for manual review.

REASONING GUIDELINES:
- Provide brief chain-of-thought before producing complex SQL or payment flows.
- Flag performance, security, and privacy concerns.
```

---

## TASK ADMIN-V2-001: Admin Role Schema & Authentication

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** MODULE-03 (Authentication V2)

### Description
Create admin role system with secure authentication. Add `role` enum to users table (user, admin, moderator). Create admin login flow with role verification. Implement admin session management with elevated privileges. Create admin activity logging table for audit trail.

### Acceptance Criteria
- [ ] Admin role added to users table with enum validation
- [ ] Admin login checks `role = 'admin'` before granting access
- [ ] Admin session includes elevated permissions in JWT
- [ ] All admin actions logged in `admin_activity_log` table
- [ ] Non-admin users redirected with error on admin panel access
- [ ] Admin dashboard accessible only to authenticated admins

---

### AI Prompt for Cursor

```typescript
/*
TASK: Admin role schema and authentication with V2 subscription context

CONTEXT:
Admin panel is separate from mobile app.
Only users with role='admin' can access.
Admin actions must be logged for audit compliance.

V2 REQUIREMENTS:
- Admin can manage subscriptions (extend trial, cancel, refund)
- Admin can adjust SP wallets (add/deduct with reason)
- Admin can award/revoke badges
- All admin actions logged with admin_id, action_type, entity_id, notes

REQUIREMENTS:
1. Add role enum to users table
2. Create admin_activity_log table
3. Admin login with role verification
4. Protected admin routes
5. Admin session management

==================================================
FILE 1: Database migration for admin roles
==================================================
*/

-- filepath: supabase/migrations/120_admin_roles_v2.sql

-- Create role enum if not exists
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'user_role'
  ) THEN
    CREATE TYPE user_role AS ENUM ('user', 'admin', 'moderator');
  END IF;
END $$;

-- Add role column to users table
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user';

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS users_role_idx ON users(role);

-- Admin activity log table
CREATE TABLE admin_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL, -- 'subscription_extend', 'subscription_cancel', 'sp_adjustment', 'badge_award', 'badge_revoke'
  entity_type TEXT NOT NULL, -- 'subscription', 'sp_wallet', 'badge', 'user'
  entity_id UUID NOT NULL, -- ID of affected entity
  details JSONB, -- Action-specific details
  notes TEXT, -- Admin notes explaining action
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX admin_activity_log_admin_idx ON admin_activity_log(admin_id);
CREATE INDEX admin_activity_log_entity_idx ON admin_activity_log(entity_type, entity_id);
CREATE INDEX admin_activity_log_created_idx ON admin_activity_log(created_at DESC);

-- RLS policies
ALTER TABLE admin_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all activity logs"
  ON admin_activity_log FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can insert activity logs"
  ON admin_activity_log FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Helper function to log admin actions
CREATE OR REPLACE FUNCTION log_admin_action(
  p_admin_id UUID,
  p_action_type TEXT,
  p_entity_type TEXT,
  p_entity_id UUID,
  p_details JSONB DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  INSERT INTO admin_activity_log (admin_id, action_type, entity_type, entity_id, details, notes)
  VALUES (p_admin_id, p_action_type, p_entity_type, p_entity_id, p_details, p_notes)
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: TypeScript types for admin
==================================================
*/

// filepath: src/types/admin.ts

export type UserRole = 'user' | 'admin' | 'moderator';

export interface AdminUser {
  id: string;
  email: string;
  full_name: string | null;
  role: UserRole;
  created_at: string;
}

export type AdminActionType = 
  | 'subscription_extend'
  | 'subscription_cancel'
  | 'subscription_refund'
  | 'sp_adjustment'
  | 'badge_award'
  | 'badge_revoke'
  | 'user_suspend'
  | 'user_unsuspend';

export type AdminEntityType = 'subscription' | 'sp_wallet' | 'badge' | 'user' | 'trade';

export interface AdminActivityLog {
  id: string;
  admin_id: string;
  action_type: AdminActionType;
  entity_type: AdminEntityType;
  entity_id: string;
  details: Record<string, any> | null;
  notes: string | null;
  created_at: string;
}

export interface AdminSession {
  user: AdminUser;
  access_token: string;
  refresh_token: string;
}

/*
==================================================
FILE 3: Admin authentication service
==================================================
*/

// filepath: src/services/adminAuth.ts

import { supabase } from '@/lib/supabase';
import type { AdminUser, AdminSession } from '@/types/admin';

export class AdminAuthService {
  /**
   * Admin login with role verification
   */
  static async loginAdmin(email: string, password: string): Promise<AdminSession> {
    // Step 1: Authenticate with Supabase
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      throw new Error(`Authentication failed: ${authError.message}`);
    }

    if (!authData.user) {
      throw new Error('No user returned from authentication');
    }

    // Step 2: Verify admin role
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', authData.user.id)
      .single();

    if (userError) {
      throw new Error(`Failed to fetch user data: ${userError.message}`);
    }

    if (userData.role !== 'admin') {
      // Sign out non-admin user
      await supabase.auth.signOut();
      throw new Error('Access denied: Admin privileges required');
    }

    // Step 3: Return admin session
    return {
      user: userData as AdminUser,
      access_token: authData.session!.access_token,
      refresh_token: authData.session!.refresh_token,
    };
  }

  /**
   * Get current admin user
   */
  static async getCurrentAdmin(): Promise<AdminUser | null> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return null;
    }

    const { data, error } = await supabase
      .from('users')
      .select('id, email, full_name, role')
      .eq('id', user.id)
      .single();

    if (error || !data || data.role !== 'admin') {
      return null;
    }

    return data as AdminUser;
  }

  /**
   * Admin logout
   */
  static async logoutAdmin(): Promise<void> {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw new Error(`Logout failed: ${error.message}`);
    }
  }

  /**
   * Verify current session is admin
   */
  static async verifyAdminSession(): Promise<boolean> {
    const admin = await this.getCurrentAdmin();
    return admin !== null;
  }
}

/*
==================================================
FILE 4: Admin activity logging service
==================================================
*/

// filepath: src/services/adminActivityLog.ts

import { supabase } from '@/lib/supabase';
import type { AdminActionType, AdminEntityType, AdminActivityLog } from '@/types/admin';

export class AdminActivityLogService {
  /**
   * Log admin action
   */
  static async logAction(
    actionType: AdminActionType,
    entityType: AdminEntityType,
    entityId: string,
    details?: Record<string, any>,
    notes?: string
  ): Promise<string> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated user');
    }

    const { data, error } = await supabase
      .rpc('log_admin_action', {
        p_admin_id: user.id,
        p_action_type: actionType,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_details: details || null,
        p_notes: notes || null,
      });

    if (error) {
      throw new Error(`Failed to log admin action: ${error.message}`);
    }

    return data as string;
  }

  /**
   * Get activity logs with optional filters
   */
  static async getActivityLogs(params?: {
    adminId?: string;
    actionType?: AdminActionType;
    entityType?: AdminEntityType;
    entityId?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminActivityLog[]> {
    let query = supabase
      .from('admin_activity_log')
      .select('*')
      .order('created_at', { ascending: false });

    if (params?.adminId) {
      query = query.eq('admin_id', params.adminId);
    }

    if (params?.actionType) {
      query = query.eq('action_type', params.actionType);
    }

    if (params?.entityType) {
      query = query.eq('entity_type', params.entityType);
    }

    if (params?.entityId) {
      query = query.eq('entity_id', params.entityId);
    }

    if (params?.limit) {
      query = query.limit(params.limit);
    }

    if (params?.offset) {
      query = query.range(params.offset, params.offset + (params.limit || 10) - 1);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch activity logs: ${error.message}`);
    }

    return data as AdminActivityLog[];
  }

  /**
   * Get activity logs for specific entity
   */
  static async getEntityActivityLogs(
    entityType: AdminEntityType,
    entityId: string
  ): Promise<AdminActivityLog[]> {
    const { data, error } = await supabase
      .from('admin_activity_log')
      .select('*')
      .eq('entity_type', entityType)
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to fetch entity activity logs: ${error.message}`);
    }

    return data as AdminActivityLog[];
  }
}

/*
==================================================
FILE 5: Protected admin route component (React)
==================================================
*/

// filepath: src/components/admin/ProtectedAdminRoute.tsx

import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminAuthService } from '@/services/adminAuth';
import type { AdminUser } from '@/types/admin';

interface ProtectedAdminRouteProps {
  children: React.ReactNode;
}

export const ProtectedAdminRoute: React.FC<ProtectedAdminRouteProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(true);
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);

  useEffect(() => {
    checkAdminAccess();
  }, []);

  const checkAdminAccess = async () => {
    try {
      const admin = await AdminAuthService.getCurrentAdmin();
      setAdminUser(admin);
    } catch (error) {
      console.error('Admin access check failed:', error);
      setAdminUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Verifying admin access...</div>
      </div>
    );
  }

  if (!adminUser) {
    return <Navigate to="/admin/login" replace />;
  }

  return <>{children}</>;
};

/*
==================================================
FILE 6: Admin login screen (React)
==================================================
*/

// filepath: src/screens/admin/AdminLoginScreen.tsx

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminAuthService } from '@/services/adminAuth';

export const AdminLoginScreen: React.FC = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await AdminAuthService.loginAdmin(email, password);
      navigate('/admin/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <h1 className="text-2xl font-bold text-center mb-6">Admin Login</h1>
        
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            {isLoading ? 'Logging in...' : 'Login'}
          </button>
        </form>
      </div>
    </div>
  );
};

/*
==================================================
FILE 7: Tests for admin authentication
==================================================
*/

// filepath: src/services/__tests__/adminAuth.test.ts

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AdminAuthService } from '../adminAuth';
import { supabase } from '@/lib/supabase';

vi.mock('@/lib/supabase');

describe('AdminAuthService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('loginAdmin', () => {
    it('should successfully login admin user', async () => {
      const mockAuthData = {
        user: { id: 'admin-123', email: 'admin@test.com' },
        session: {
          access_token: 'token-123',
          refresh_token: 'refresh-123',
        },
      };

      const mockUserData = {
        id: 'admin-123',
        email: 'admin@test.com',
        full_name: 'Admin User',
        role: 'admin',
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: mockAuthData,
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUserData,
          error: null,
        }),
      } as any);

      const result = await AdminAuthService.loginAdmin('admin@test.com', 'password');

      expect(result.user.role).toBe('admin');
      expect(result.access_token).toBe('token-123');
    });

    it('should reject non-admin user login', async () => {
      const mockAuthData = {
        user: { id: 'user-123', email: 'user@test.com' },
        session: {
          access_token: 'token-123',
          refresh_token: 'refresh-123',
        },
      };

      const mockUserData = {
        id: 'user-123',
        email: 'user@test.com',
        full_name: 'Regular User',
        role: 'user',
      };

      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: mockAuthData,
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUserData,
          error: null,
        }),
      } as any);

      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: null,
      } as any);

      await expect(
        AdminAuthService.loginAdmin('user@test.com', 'password')
      ).rejects.toThrow('Access denied: Admin privileges required');

      expect(supabase.auth.signOut).toHaveBeenCalled();
    });

    it('should handle authentication errors', async () => {
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid credentials' } as any,
      } as any);

      await expect(
        AdminAuthService.loginAdmin('admin@test.com', 'wrong-password')
      ).rejects.toThrow('Authentication failed: Invalid credentials');
    });
  });

  describe('getCurrentAdmin', () => {
    it('should return admin user when authenticated', async () => {
      const mockUser = { id: 'admin-123' };
      const mockAdminData = {
        id: 'admin-123',
        email: 'admin@test.com',
        full_name: 'Admin User',
        role: 'admin',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockAdminData,
          error: null,
        }),
      } as any);

      const result = await AdminAuthService.getCurrentAdmin();

      expect(result).toEqual(mockAdminData);
    });

    it('should return null for non-admin user', async () => {
      const mockUser = { id: 'user-123' };
      const mockUserData = {
        id: 'user-123',
        email: 'user@test.com',
        role: 'user',
      };

      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: mockUserData,
          error: null,
        }),
      } as any);

      const result = await AdminAuthService.getCurrentAdmin();

      expect(result).toBeNull();
    });
  });
});
```

### Testing Checklist
- [ ] Admin can login with valid credentials
- [ ] Non-admin users cannot access admin panel
- [ ] Admin session persists across page reloads
- [ ] Admin activity logs created for all actions
- [ ] Protected routes redirect non-admins to login
- [ ] Admin logout clears session completely

### Deployment Notes
1. Manually create first admin user via Supabase dashboard
2. Update users table: `UPDATE users SET role = 'admin' WHERE email = 'your-admin@email.com'`
3. Configure admin panel subdomain (e.g., admin.kidsclub.com)
4. Set up separate authentication flow for admin vs. mobile app

---

## TASK ADMIN-V2-002: Subscription Management Dashboard

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** ADMIN-V2-001, MODULE-11 (Subscriptions V2)

### Description
Create admin dashboard for subscription management. Display real-time subscription metrics (trial/active/grace/cancelled counts). Enable manual subscription actions: extend trial, force cancellation, process refunds. Show subscription analytics: churn rate, LTV, trial conversion rate. Implement user subscription search and inspection.

### Acceptance Criteria
- [ ] Dashboard shows real-time subscription counts by status
- [ ] Admin can extend trial period for specific user
- [ ] Admin can force cancel subscription with refund option
- [ ] Admin can view subscription history for any user
- [ ] All subscription actions logged in admin_activity_log
- [ ] Subscription analytics charts display correctly

---

### AI Prompt for Cursor

```typescript
/*
TASK: Subscription management dashboard with admin controls

CONTEXT:
Admin needs ability to manage user subscriptions manually.
Common use cases: customer support requests, refunds, trial extensions.

V2 SUBSCRIPTION MODEL:
- Kids Club+: $7.99/month
- Trial: 30 days, no credit card required
- Grace period: 90 days after cancellation
- Statuses: trial, active, grace_period, cancelled, suspended

ADMIN ACTIONS:
1. Extend trial: Add days to trial_ends_at
2. Force cancel: Set status to 'cancelled', process refund if requested
3. Suspend/Unsuspend: Temporarily block subscription benefits
4. View history: All subscription events for user

==================================================
FILE 1: Admin subscription management RPCs
==================================================
*/

-- filepath: supabase/migrations/121_admin_subscription_management.sql

-- RPC: Extend trial period for user
CREATE OR REPLACE FUNCTION admin_extend_trial(
  p_admin_id UUID,
  p_user_id UUID,
  p_extension_days INTEGER,
  p_notes TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_new_trial_end TIMESTAMPTZ;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Get user's subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE user_id = p_user_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No subscription found for user %', p_user_id;
  END IF;

  -- Calculate new trial end date
  v_new_trial_end := COALESCE(v_subscription.trial_ends_at, now()) + (p_extension_days || ' days')::INTERVAL;

  -- Update subscription
  UPDATE subscriptions
  SET 
    trial_ends_at = v_new_trial_end,
    status = CASE 
      WHEN status = 'cancelled' THEN 'trial'
      ELSE status
    END,
    updated_at = now()
  WHERE id = v_subscription.id;

  -- Log admin action
  PERFORM log_admin_action(
    p_admin_id,
    'subscription_extend',
    'subscription',
    v_subscription.id,
    jsonb_build_object(
      'user_id', p_user_id,
      'extension_days', p_extension_days,
      'previous_trial_end', v_subscription.trial_ends_at,
      'new_trial_end', v_new_trial_end
    ),
    p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', v_subscription.id,
    'new_trial_end', v_new_trial_end
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Force cancel subscription with optional refund
CREATE OR REPLACE FUNCTION admin_cancel_subscription(
  p_admin_id UUID,
  p_subscription_id UUID,
  p_process_refund BOOLEAN DEFAULT false,
  p_refund_amount DECIMAL(10,2) DEFAULT NULL,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_subscription RECORD;
  v_sp_wallet RECORD;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Get subscription
  SELECT * INTO v_subscription
  FROM subscriptions
  WHERE id = p_subscription_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Subscription % not found', p_subscription_id;
  END IF;

  -- Update subscription status
  UPDATE subscriptions
  SET 
    status = 'cancelled',
    cancelled_at = now(),
    updated_at = now()
  WHERE id = p_subscription_id;

  -- Freeze SP wallet (user can no longer earn/spend SP)
  SELECT * INTO v_sp_wallet
  FROM sp_wallets
  WHERE user_id = v_subscription.user_id;

  IF FOUND THEN
    UPDATE sp_wallets
    SET 
      status = 'frozen',
      updated_at = now()
    WHERE id = v_sp_wallet.id;
  END IF;

  -- Log admin action
  PERFORM log_admin_action(
    p_admin_id,
    CASE WHEN p_process_refund THEN 'subscription_refund' ELSE 'subscription_cancel' END,
    'subscription',
    p_subscription_id,
    jsonb_build_object(
      'user_id', v_subscription.user_id,
      'previous_status', v_subscription.status,
      'refund_processed', p_process_refund,
      'refund_amount', p_refund_amount
    ),
    p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'subscription_id', p_subscription_id,
    'status', 'cancelled',
    'sp_wallet_frozen', v_sp_wallet.id IS NOT NULL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get subscription analytics
CREATE OR REPLACE FUNCTION get_subscription_analytics(
  p_admin_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB AS $$
DECLARE
  v_total_subscriptions INTEGER;
  v_trial_count INTEGER;
  v_active_count INTEGER;
  v_grace_count INTEGER;
  v_cancelled_count INTEGER;
  v_trial_conversion_rate DECIMAL(5,2);
  v_churn_rate DECIMAL(5,2);
  v_mrr DECIMAL(10,2);
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Count subscriptions by status
  SELECT COUNT(*) INTO v_total_subscriptions
  FROM subscriptions
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(*) INTO v_trial_count
  FROM subscriptions
  WHERE status = 'trial'
    AND created_at BETWEEN p_start_date AND p_end_date;

  SELECT COUNT(*) INTO v_active_count
  FROM subscriptions
  WHERE status = 'active';

  SELECT COUNT(*) INTO v_grace_count
  FROM subscriptions
  WHERE status = 'grace_period';

  SELECT COUNT(*) INTO v_cancelled_count
  FROM subscriptions
  WHERE status = 'cancelled'
    AND cancelled_at BETWEEN p_start_date AND p_end_date;

  -- Calculate trial conversion rate
  SELECT 
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'trial') > 0 
      THEN ROUND((COUNT(*) FILTER (WHERE status = 'active')::DECIMAL / COUNT(*) FILTER (WHERE status = 'trial')) * 100, 2)
      ELSE 0
    END INTO v_trial_conversion_rate
  FROM subscriptions
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  -- Calculate churn rate (cancelled / (active + cancelled))
  SELECT 
    CASE 
      WHEN (v_active_count + v_cancelled_count) > 0
      THEN ROUND((v_cancelled_count::DECIMAL / (v_active_count + v_cancelled_count)) * 100, 2)
      ELSE 0
    END INTO v_churn_rate;

  -- Calculate MRR (Monthly Recurring Revenue)
  -- Assuming $7.99/month for active subscribers
  v_mrr := v_active_count * 7.99;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'counts', jsonb_build_object(
      'total', v_total_subscriptions,
      'trial', v_trial_count,
      'active', v_active_count,
      'grace_period', v_grace_count,
      'cancelled', v_cancelled_count
    ),
    'metrics', jsonb_build_object(
      'trial_conversion_rate', v_trial_conversion_rate,
      'churn_rate', v_churn_rate,
      'mrr', v_mrr
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Admin subscription service
==================================================
*/

// filepath: src/services/admin/subscriptionManagement.ts

import { supabase } from '@/lib/supabase';
import { AdminActivityLogService } from '../adminActivityLog';

export interface SubscriptionAnalytics {
  period: {
    start_date: string;
    end_date: string;
  };
  counts: {
    total: number;
    trial: number;
    active: number;
    grace_period: number;
    cancelled: number;
  };
  metrics: {
    trial_conversion_rate: number;
    churn_rate: number;
    mrr: number;
  };
}

export class AdminSubscriptionService {
  /**
   * Extend trial period for user
   */
  static async extendTrial(
    userId: string,
    extensionDays: number,
    notes: string
  ): Promise<{ success: boolean; new_trial_end: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('admin_extend_trial', {
      p_admin_id: user.id,
      p_user_id: userId,
      p_extension_days: extensionDays,
      p_notes: notes,
    });

    if (error) {
      throw new Error(`Failed to extend trial: ${error.message}`);
    }

    return data;
  }

  /**
   * Cancel subscription with optional refund
   */
  static async cancelSubscription(
    subscriptionId: string,
    processRefund: boolean = false,
    refundAmount?: number,
    notes?: string
  ): Promise<{ success: boolean; sp_wallet_frozen: boolean }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('admin_cancel_subscription', {
      p_admin_id: user.id,
      p_subscription_id: subscriptionId,
      p_process_refund: processRefund,
      p_refund_amount: refundAmount || null,
      p_notes: notes || null,
    });

    if (error) {
      throw new Error(`Failed to cancel subscription: ${error.message}`);
    }

    return data;
  }

  /**
   * Get subscription analytics
   */
  static async getAnalytics(
    startDate?: Date,
    endDate?: Date
  ): Promise<SubscriptionAnalytics> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('get_subscription_analytics', {
      p_admin_id: user.id,
      p_start_date: startDate?.toISOString() || undefined,
      p_end_date: endDate?.toISOString() || undefined,
    });

    if (error) {
      throw new Error(`Failed to get analytics: ${error.message}`);
    }

    return data as SubscriptionAnalytics;
  }

  /**
   * Search subscriptions by user email or ID
   */
  static async searchSubscriptions(query: string) {
    const { data, error } = await supabase
      .from('subscriptions')
      .select(`
        *,
        users:user_id (
          id,
          email,
          full_name
        )
      `)
      .or(`user_id.eq.${query},users.email.ilike.%${query}%`)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to search subscriptions: ${error.message}`);
    }

    return data;
  }

  /**
   * Get subscription details with history
   */
  static async getSubscriptionDetails(subscriptionId: string) {
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select(`
        *,
        users:user_id (
          id,
          email,
          full_name,
          created_at
        )
      `)
      .eq('id', subscriptionId)
      .single();

    if (subError) {
      throw new Error(`Failed to get subscription: ${subError.message}`);
    }

    // Get activity logs for this subscription
    const activityLogs = await AdminActivityLogService.getEntityActivityLogs(
      'subscription',
      subscriptionId
    );

    return {
      subscription,
      activity_logs: activityLogs,
    };
  }
}

/*
==================================================
FILE 3: Subscription management dashboard UI
==================================================
*/

// filepath: src/screens/admin/SubscriptionDashboard.tsx

import React, { useEffect, useState } from 'react';
import { AdminSubscriptionService, type SubscriptionAnalytics } from '@/services/admin/subscriptionManagement';

export const SubscriptionDashboard: React.FC = () => {
  const [analytics, setAnalytics] = useState<SubscriptionAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      const data = await AdminSubscriptionService.getAnalytics();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading subscription analytics...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  if (!analytics) {
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Subscription Management</h1>

      {/* Subscription Counts */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <MetricCard
          title="Total Subscriptions"
          value={analytics.counts.total}
          color="bg-blue-500"
        />
        <MetricCard
          title="Trial"
          value={analytics.counts.trial}
          color="bg-yellow-500"
        />
        <MetricCard
          title="Active"
          value={analytics.counts.active}
          color="bg-green-500"
        />
        <MetricCard
          title="Grace Period"
          value={analytics.counts.grace_period}
          color="bg-orange-500"
        />
        <MetricCard
          title="Cancelled"
          value={analytics.counts.cancelled}
          color="bg-red-500"
        />
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          title="Trial Conversion Rate"
          value={`${analytics.metrics.trial_conversion_rate}%`}
          color="bg-purple-500"
        />
        <MetricCard
          title="Churn Rate"
          value={`${analytics.metrics.churn_rate}%`}
          color="bg-pink-500"
        />
        <MetricCard
          title="MRR"
          value={`$${analytics.metrics.mrr.toFixed(2)}`}
          color="bg-indigo-500"
        />
      </div>

      {/* Search and Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Subscription Search</h2>
        <SubscriptionSearch />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string | number; color: string }> = ({
  title,
  value,
  color,
}) => (
  <div className={`${color} text-white rounded-lg shadow p-6`}>
    <h3 className="text-sm font-medium opacity-90">{title}</h3>
    <p className="text-3xl font-bold mt-2">{value}</p>
  </div>
);

const SubscriptionSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const data = await AdminSubscriptionService.searchSubscriptions(query);
      setResults(data);
    } catch (err) {
      console.error('Search failed:', err);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Search by email or user ID..."
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {results.length > 0 && (
        <div className="space-y-2">
          {results.map((sub) => (
            <SubscriptionResult key={sub.id} subscription={sub} />
          ))}
        </div>
      )}
    </div>
  );
};

const SubscriptionResult: React.FC<{ subscription: any }> = ({ subscription }) => {
  const [showActions, setShowActions] = useState(false);

  return (
    <div className="border rounded-lg p-4 hover:bg-gray-50">
      <div className="flex justify-between items-start">
        <div>
          <p className="font-medium">{subscription.users?.email}</p>
          <p className="text-sm text-gray-600">
            Status: <span className={`font-medium ${getStatusColor(subscription.status)}`}>
              {subscription.status}
            </span>
          </p>
          <p className="text-xs text-gray-500">ID: {subscription.id}</p>
        </div>
        <button
          onClick={() => setShowActions(!showActions)}
          className="text-blue-600 hover:text-blue-800 text-sm font-medium"
        >
          {showActions ? 'Hide Actions' : 'Show Actions'}
        </button>
      </div>

      {showActions && (
        <SubscriptionActions subscriptionId={subscription.id} userId={subscription.user_id} />
      )}
    </div>
  );
};

const SubscriptionActions: React.FC<{ subscriptionId: string; userId: string }> = ({
  subscriptionId,
  userId,
}) => {
  const [extensionDays, setExtensionDays] = useState(7);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExtendTrial = async () => {
    if (!notes.trim()) {
      alert('Please provide a reason for extending the trial');
      return;
    }

    setIsProcessing(true);
    try {
      await AdminSubscriptionService.extendTrial(userId, extensionDays, notes);
      alert('Trial extended successfully');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to extend trial');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCancelSubscription = async (processRefund: boolean) => {
    if (!confirm(`Are you sure you want to cancel this subscription${processRefund ? ' with refund' : ''}?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await AdminSubscriptionService.cancelSubscription(
        subscriptionId,
        processRefund,
        processRefund ? 7.99 : undefined,
        notes || undefined
      );
      alert('Subscription cancelled successfully');
      window.location.reload();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to cancel subscription');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Extend Trial (days)
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={extensionDays}
            onChange={(e) => setExtensionDays(parseInt(e.target.value))}
            min={1}
            max={90}
            className="w-24 rounded-md border-gray-300 shadow-sm"
          />
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Reason for extension..."
            className="flex-1 rounded-md border-gray-300 shadow-sm"
          />
          <button
            onClick={handleExtendTrial}
            disabled={isProcessing}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            Extend Trial
          </button>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => handleCancelSubscription(false)}
          disabled={isProcessing}
          className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
        >
          Cancel Subscription
        </button>
        <button
          onClick={() => handleCancelSubscription(true)}
          disabled={isProcessing}
          className="px-3 py-2 bg-red-800 text-white rounded-md hover:bg-red-900 disabled:opacity-50 text-sm"
        >
          Cancel with Refund
        </button>
      </div>
    </div>
  );
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'trial':
      return 'text-yellow-600';
    case 'active':
      return 'text-green-600';
    case 'grace_period':
      return 'text-orange-600';
    case 'cancelled':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}
```

### Testing Checklist
- [ ] Admin can extend trial period successfully
- [ ] Trial extension logged in admin_activity_log
- [ ] Admin can cancel subscription with/without refund
- [ ] Cancelled subscription freezes SP wallet
- [ ] Analytics display correct counts by status
- [ ] Trial conversion rate calculated accurately
- [ ] MRR reflects active subscriber count
- [ ] Subscription search finds users by email/ID

### Deployment Notes
1. Test subscription cancellation flow in staging
2. Verify refund processing with payment provider
3. Set up monitoring for admin actions
4. Configure alerts for unusual admin activity (bulk cancellations)

---

## TASK ADMIN-V2-003: SP Wallet Admin Operations

**Duration:** 3.5 hours  
**Priority:** High  
**Dependencies:** ADMIN-V2-001, MODULE-09 (Swap Points V2)

### Description
Create admin tools for SP wallet management. Enable wallet inspection (view balance, ledger history). Implement manual SP adjustments (add/deduct points with reason). Create SP audit log for all admin modifications. Display SP economy metrics (total circulation, earning rate, spending rate).

### Acceptance Criteria
- [ ] Admin can view any user's SP wallet details
- [ ] Admin can manually add/deduct SP with mandatory reason
- [ ] All SP adjustments create ledger entries with 'admin_adjustment' reason
- [ ] SP adjustments logged in admin_activity_log
- [ ] Wallet inspection shows full ledger history
- [ ] SP economy dashboard displays total earned/spent/circulation

---

### AI Prompt for Cursor

```typescript
/*
TASK: SP wallet admin operations with audit trail

CONTEXT:
Admin needs ability to adjust SP wallets for customer support.
Common use cases: compensation, error correction, promotional bonuses.

V2 SP WALLET MODEL:
- Only trial/active subscribers can earn/spend SP
- Wallet statuses: active, frozen, suspended
- Ledger tracks all SP transactions with reason and metadata

ADMIN ACTIONS:
1. Add SP: Credit wallet with admin_adjustment reason
2. Deduct SP: Debit wallet (prevent negative balance)
3. View history: Full ledger with transaction details
4. Freeze/unfreeze: Temporarily block SP earning/spending

==================================================
FILE 1: Admin SP wallet management RPCs
==================================================
*/

-- filepath: supabase/migrations/122_admin_sp_wallet_management.sql

-- RPC: Admin adjust SP wallet (add or deduct points)
CREATE OR REPLACE FUNCTION admin_adjust_sp_wallet(
  p_admin_id UUID,
  p_user_id UUID,
  p_amount INTEGER, -- Positive to add, negative to deduct
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_new_balance INTEGER;
  v_ledger_id UUID;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Get user's SP wallet
  SELECT * INTO v_wallet
  FROM sp_wallets
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No SP wallet found for user %', p_user_id;
  END IF;

  -- Calculate new balance
  v_new_balance := v_wallet.balance + p_amount;

  -- Prevent negative balance
  IF v_new_balance < 0 THEN
    RAISE EXCEPTION 'Cannot deduct % SP. Current balance: %. Would result in negative balance.', 
      ABS(p_amount), v_wallet.balance;
  END IF;

  -- Update wallet balance
  UPDATE sp_wallets
  SET 
    balance = v_new_balance,
    updated_at = now()
  WHERE id = v_wallet.id;

  -- Create ledger entry
  INSERT INTO sp_ledger (
    wallet_id,
    transaction_type,
    amount,
    balance_after,
    reason,
    metadata
  ) VALUES (
    v_wallet.id,
    CASE WHEN p_amount > 0 THEN 'earned' ELSE 'spent' END,
    ABS(p_amount),
    v_new_balance,
    'admin_adjustment',
    jsonb_build_object(
      'admin_id', p_admin_id,
      'adjustment_reason', p_reason,
      'admin_notes', p_notes
    )
  ) RETURNING id INTO v_ledger_id;

  -- Log admin action
  PERFORM log_admin_action(
    p_admin_id,
    'sp_adjustment',
    'sp_wallet',
    v_wallet.id,
    jsonb_build_object(
      'user_id', p_user_id,
      'amount', p_amount,
      'previous_balance', v_wallet.balance,
      'new_balance', v_new_balance,
      'ledger_id', v_ledger_id
    ),
    p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', v_wallet.id,
    'previous_balance', v_wallet.balance,
    'new_balance', v_new_balance,
    'ledger_id', v_ledger_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Freeze/unfreeze SP wallet
CREATE OR REPLACE FUNCTION admin_toggle_sp_wallet_status(
  p_admin_id UUID,
  p_wallet_id UUID,
  p_new_status TEXT, -- 'active', 'frozen', 'suspended'
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_wallet RECORD;
  v_previous_status TEXT;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Validate new status
  IF p_new_status NOT IN ('active', 'frozen', 'suspended') THEN
    RAISE EXCEPTION 'Invalid status: %. Must be active, frozen, or suspended', p_new_status;
  END IF;

  -- Get wallet
  SELECT * INTO v_wallet
  FROM sp_wallets
  WHERE id = p_wallet_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SP wallet % not found', p_wallet_id;
  END IF;

  v_previous_status := v_wallet.status;

  -- Update wallet status
  UPDATE sp_wallets
  SET 
    status = p_new_status,
    updated_at = now()
  WHERE id = p_wallet_id;

  -- Log admin action
  PERFORM log_admin_action(
    p_admin_id,
    'sp_wallet_status_change',
    'sp_wallet',
    p_wallet_id,
    jsonb_build_object(
      'user_id', v_wallet.user_id,
      'previous_status', v_previous_status,
      'new_status', p_new_status
    ),
    p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'wallet_id', p_wallet_id,
    'previous_status', v_previous_status,
    'new_status', p_new_status
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get SP economy metrics
CREATE OR REPLACE FUNCTION get_sp_economy_metrics(
  p_admin_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB AS $$
DECLARE
  v_total_earned BIGINT;
  v_total_spent BIGINT;
  v_total_circulation BIGINT;
  v_active_wallets INTEGER;
  v_avg_balance DECIMAL(10,2);
  v_admin_adjustments_count INTEGER;
  v_admin_adjustments_total INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Total SP earned (all time)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_earned
  FROM sp_ledger
  WHERE transaction_type = 'earned'
    AND created_at <= p_end_date;

  -- Total SP spent (all time)
  SELECT COALESCE(SUM(amount), 0) INTO v_total_spent
  FROM sp_ledger
  WHERE transaction_type = 'spent'
    AND created_at <= p_end_date;

  -- Current circulation (sum of all wallet balances)
  SELECT COALESCE(SUM(balance), 0) INTO v_total_circulation
  FROM sp_wallets
  WHERE status = 'active';

  -- Active wallets count
  SELECT COUNT(*) INTO v_active_wallets
  FROM sp_wallets
  WHERE status = 'active';

  -- Average wallet balance
  SELECT COALESCE(AVG(balance), 0) INTO v_avg_balance
  FROM sp_wallets
  WHERE status = 'active'
    AND balance > 0;

  -- Admin adjustments in period
  SELECT COUNT(*) INTO v_admin_adjustments_count
  FROM sp_ledger
  WHERE reason = 'admin_adjustment'
    AND created_at BETWEEN p_start_date AND p_end_date;

  SELECT COALESCE(SUM(amount), 0) INTO v_admin_adjustments_total
  FROM sp_ledger
  WHERE reason = 'admin_adjustment'
    AND created_at BETWEEN p_start_date AND p_end_date;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'totals', jsonb_build_object(
      'total_earned', v_total_earned,
      'total_spent', v_total_spent,
      'circulation', v_total_circulation,
      'active_wallets', v_active_wallets,
      'avg_balance', v_avg_balance
    ),
    'admin_adjustments', jsonb_build_object(
      'count', v_admin_adjustments_count,
      'total_amount', v_admin_adjustments_total
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Admin SP wallet service
==================================================
*/

// filepath: src/services/admin/spWalletManagement.ts

import { supabase } from '@/lib/supabase';

export interface SPEconomyMetrics {
  period: {
    start_date: string;
    end_date: string;
  };
  totals: {
    total_earned: number;
    total_spent: number;
    circulation: number;
    active_wallets: number;
    avg_balance: number;
  };
  admin_adjustments: {
    count: number;
    total_amount: number;
  };
}

export class AdminSPWalletService {
  /**
   * Adjust SP wallet balance (add or deduct)
   */
  static async adjustWallet(
    userId: string,
    amount: number,
    reason: string,
    notes?: string
  ): Promise<{ success: boolean; new_balance: number }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('admin_adjust_sp_wallet', {
      p_admin_id: user.id,
      p_user_id: userId,
      p_amount: amount,
      p_reason: reason,
      p_notes: notes || null,
    });

    if (error) {
      throw new Error(`Failed to adjust SP wallet: ${error.message}`);
    }

    return {
      success: data.success,
      new_balance: data.new_balance,
    };
  }

  /**
   * Toggle SP wallet status (active/frozen/suspended)
   */
  static async toggleWalletStatus(
    walletId: string,
    newStatus: 'active' | 'frozen' | 'suspended',
    notes?: string
  ): Promise<{ success: boolean; previous_status: string; new_status: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('admin_toggle_sp_wallet_status', {
      p_admin_id: user.id,
      p_wallet_id: walletId,
      p_new_status: newStatus,
      p_notes: notes || null,
    });

    if (error) {
      throw new Error(`Failed to toggle wallet status: ${error.message}`);
    }

    return data;
  }

  /**
   * Get SP economy metrics
   */
  static async getEconomyMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<SPEconomyMetrics> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('get_sp_economy_metrics', {
      p_admin_id: user.id,
      p_start_date: startDate?.toISOString() || undefined,
      p_end_date: endDate?.toISOString() || undefined,
    });

    if (error) {
      throw new Error(`Failed to get economy metrics: ${error.message}`);
    }

    return data as SPEconomyMetrics;
  }

  /**
   * Get user's SP wallet with ledger history
   */
  static async getWalletDetails(userId: string) {
    // Get wallet
    const { data: wallet, error: walletError } = await supabase
      .from('sp_wallets')
      .select(`
        *,
        users:user_id (
          id,
          email,
          full_name
        )
      `)
      .eq('user_id', userId)
      .single();

    if (walletError) {
      throw new Error(`Failed to get wallet: ${walletError.message}`);
    }

    // Get ledger entries
    const { data: ledger, error: ledgerError } = await supabase
      .from('sp_ledger')
      .select('*')
      .eq('wallet_id', wallet.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (ledgerError) {
      throw new Error(`Failed to get ledger: ${ledgerError.message}`);
    }

    return {
      wallet,
      ledger,
    };
  }

  /**
   * Search SP wallets by user email or ID
   */
  static async searchWallets(query: string) {
    const { data, error } = await supabase
      .from('sp_wallets')
      .select(`
        *,
        users:user_id (
          id,
          email,
          full_name
        )
      `)
      .or(`user_id.eq.${query}`)
      .order('balance', { ascending: false })
      .limit(20);

    if (error) {
      throw new Error(`Failed to search wallets: ${error.message}`);
    }

    return data;
  }
}

/*
==================================================
FILE 3: SP wallet admin dashboard UI
==================================================
*/

// filepath: src/screens/admin/SPWalletDashboard.tsx

import React, { useEffect, useState } from 'react';
import { AdminSPWalletService, type SPEconomyMetrics } from '@/services/admin/spWalletManagement';

export const SPWalletDashboard: React.FC = () => {
  const [metrics, setMetrics] = useState<SPEconomyMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      const data = await AdminSPWalletService.getEconomyMetrics();
      setMetrics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load metrics');
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading SP economy metrics...</div>;
  }

  if (error) {
    return <div className="p-8 text-red-600">Error: {error}</div>;
  }

  if (!metrics) {
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">SP Wallet Management</h1>

      {/* SP Economy Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <MetricCard
          title="Total Earned"
          value={metrics.totals.total_earned.toLocaleString()}
          subtitle="SP"
          color="bg-green-500"
        />
        <MetricCard
          title="Total Spent"
          value={metrics.totals.total_spent.toLocaleString()}
          subtitle="SP"
          color="bg-red-500"
        />
        <MetricCard
          title="Circulation"
          value={metrics.totals.circulation.toLocaleString()}
          subtitle="SP"
          color="bg-blue-500"
        />
        <MetricCard
          title="Active Wallets"
          value={metrics.totals.active_wallets}
          color="bg-purple-500"
        />
        <MetricCard
          title="Avg Balance"
          value={Math.round(metrics.totals.avg_balance).toLocaleString()}
          subtitle="SP"
          color="bg-indigo-500"
        />
      </div>

      {/* Admin Adjustments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <MetricCard
          title="Admin Adjustments (30d)"
          value={metrics.admin_adjustments.count}
          color="bg-orange-500"
        />
        <MetricCard
          title="Total Adjusted (30d)"
          value={metrics.admin_adjustments.total_amount.toLocaleString()}
          subtitle="SP"
          color="bg-yellow-500"
        />
      </div>

      {/* Wallet Search */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Wallet Search & Management</h2>
        <WalletSearch />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ 
  title: string; 
  value: string | number; 
  subtitle?: string;
  color: string;
}> = ({ title, value, subtitle, color }) => (
  <div className={`${color} text-white rounded-lg shadow p-6`}>
    <h3 className="text-sm font-medium opacity-90">{title}</h3>
    <div className="flex items-baseline gap-2 mt-2">
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && <span className="text-sm opacity-75">{subtitle}</span>}
    </div>
  </div>
);

const WalletSearch: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [walletDetails, setWalletDetails] = useState<any>(null);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = async () => {
    if (!userId.trim()) return;

    setIsSearching(true);
    try {
      const data = await AdminSPWalletService.getWalletDetails(userId);
      setWalletDetails(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Search failed');
      setWalletDetails(null);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          placeholder="Enter user ID..."
          className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
        />
        <button
          onClick={handleSearch}
          disabled={isSearching}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isSearching ? 'Searching...' : 'Search'}
        </button>
      </div>

      {walletDetails && (
        <WalletDetailsPanel 
          wallet={walletDetails.wallet} 
          ledger={walletDetails.ledger}
          onUpdate={() => handleSearch()}
        />
      )}
    </div>
  );
};

const WalletDetailsPanel: React.FC<{ 
  wallet: any; 
  ledger: any[];
  onUpdate: () => void;
}> = ({ wallet, ledger, onUpdate }) => {
  const [adjustAmount, setAdjustAmount] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleAdjust = async () => {
    if (adjustAmount === 0) {
      alert('Please enter an amount');
      return;
    }

    if (!adjustReason.trim()) {
      alert('Please provide a reason for the adjustment');
      return;
    }

    setIsProcessing(true);
    try {
      await AdminSPWalletService.adjustWallet(
        wallet.user_id,
        adjustAmount,
        adjustReason,
        adjustNotes || undefined
      );
      alert('SP wallet adjusted successfully');
      setAdjustAmount(0);
      setAdjustReason('');
      setAdjustNotes('');
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to adjust wallet');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleToggleStatus = async (newStatus: 'active' | 'frozen' | 'suspended') => {
    if (!confirm(`Change wallet status to ${newStatus}?`)) {
      return;
    }

    setIsProcessing(true);
    try {
      await AdminSPWalletService.toggleWalletStatus(
        wallet.id,
        newStatus,
        adjustNotes || undefined
      );
      alert('Wallet status updated');
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update status');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="border rounded-lg p-6 space-y-6">
      {/* Wallet Info */}
      <div>
        <h3 className="text-lg font-semibold mb-2">Wallet Details</h3>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-gray-600">User:</span>{' '}
            <span className="font-medium">{wallet.users?.email}</span>
          </div>
          <div>
            <span className="text-gray-600">Status:</span>{' '}
            <span className={`font-medium ${getStatusColor(wallet.status)}`}>
              {wallet.status}
            </span>
          </div>
          <div>
            <span className="text-gray-600">Balance:</span>{' '}
            <span className="font-bold text-lg">{wallet.balance} SP</span>
          </div>
          <div>
            <span className="text-gray-600">Wallet ID:</span>{' '}
            <span className="text-xs font-mono">{wallet.id}</span>
          </div>
        </div>
      </div>

      {/* Adjustment Controls */}
      <div>
        <h4 className="font-semibold mb-3">Adjust Balance</h4>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Amount (+ to add, - to deduct)
              </label>
              <input
                type="number"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(parseInt(e.target.value) || 0)}
                className="w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reason *
              </label>
              <input
                type="text"
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="e.g., Customer compensation"
                className="w-full rounded-md border-gray-300 shadow-sm"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Admin Notes
            </label>
            <textarea
              value={adjustNotes}
              onChange={(e) => setAdjustNotes(e.target.value)}
              placeholder="Additional context..."
              rows={2}
              className="w-full rounded-md border-gray-300 shadow-sm"
            />
          </div>
          <button
            onClick={handleAdjust}
            disabled={isProcessing}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isProcessing ? 'Processing...' : 'Apply Adjustment'}
          </button>
        </div>
      </div>

      {/* Status Controls */}
      <div>
        <h4 className="font-semibold mb-3">Wallet Status</h4>
        <div className="flex gap-2">
          <button
            onClick={() => handleToggleStatus('active')}
            disabled={isProcessing || wallet.status === 'active'}
            className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm"
          >
            Activate
          </button>
          <button
            onClick={() => handleToggleStatus('frozen')}
            disabled={isProcessing || wallet.status === 'frozen'}
            className="px-3 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 disabled:opacity-50 text-sm"
          >
            Freeze
          </button>
          <button
            onClick={() => handleToggleStatus('suspended')}
            disabled={isProcessing || wallet.status === 'suspended'}
            className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 text-sm"
          >
            Suspend
          </button>
        </div>
      </div>

      {/* Ledger History */}
      <div>
        <h4 className="font-semibold mb-3">Transaction History (Last 100)</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Date</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Amount</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Balance</th>
                <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Reason</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {ledger.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {new Date(entry.created_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`text-xs font-medium ${
                      entry.transaction_type === 'earned' ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {entry.transaction_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 font-medium">
                    {entry.transaction_type === 'earned' ? '+' : '-'}{entry.amount}
                  </td>
                  <td className="px-3 py-2 text-gray-600">{entry.balance_after}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">
                    {entry.reason}
                    {entry.reason === 'admin_adjustment' && entry.metadata?.adjustment_reason && (
                      <div className="text-xs text-blue-600 italic">
                        {entry.metadata.adjustment_reason}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

function getStatusColor(status: string): string {
  switch (status) {
    case 'active':
      return 'text-green-600';
    case 'frozen':
      return 'text-yellow-600';
    case 'suspended':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}
```

### Testing Checklist
- [ ] Admin can add SP to user wallet successfully
- [ ] Admin can deduct SP (with negative balance prevention)
- [ ] All SP adjustments create ledger entries
- [ ] Admin adjustments logged in admin_activity_log
- [ ] Wallet status changes (active/frozen/suspended) work correctly
- [ ] SP economy metrics calculate correctly
- [ ] Ledger history displays all transactions

### Deployment Notes
1. Test SP adjustment with both positive and negative amounts
2. Verify negative balance prevention works
3. Ensure ledger entries include admin metadata
4. Monitor SP economy metrics for anomalies

---

## TASK ADMIN-V2-004: Badge Administration

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** ADMIN-V2-001, MODULE-08 (Badges V2)

### Description
Create admin tools for badge management. Enable manual badge awarding/revoking with reason. Display badge statistics (most earned, rarest badges). Show user badge collections. Implement badge leaderboard with admin view.

### Acceptance Criteria
- [ ] Admin can manually award badge to user with reason
- [ ] Admin can revoke badge from user (soft delete with timestamp)
- [ ] Badge awards/revokes logged in admin_activity_log
- [ ] Admin can view badge statistics (distribution, rarity)
- [ ] Badge leaderboard shows top users by badge count
- [ ] Admin can view all badges earned by specific user

---

### AI Prompt for Cursor

```typescript
/*
TASK: Badge administration with manual award/revoke

CONTEXT:
Admin needs ability to manually award badges for special events.
Common use cases: promotional campaigns, community contests, error correction.

V2 BADGE SYSTEM:
- Automatic awards via triggers (SP milestones, trades, subscription tenure)
- Manual awards for special events
- Soft delete for revocations (revoked_at timestamp)

ADMIN ACTIONS:
1. Award badge: Create user_badges entry with admin metadata
2. Revoke badge: Set revoked_at timestamp with reason
3. View statistics: Badge distribution and rarity
4. Leaderboard: Top users by badge count

==================================================
FILE 1: Admin badge management RPCs
==================================================
*/

-- filepath: supabase/migrations/123_admin_badge_management.sql

-- RPC: Admin award badge to user
CREATE OR REPLACE FUNCTION admin_award_badge(
  p_admin_id UUID,
  p_user_id UUID,
  p_badge_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_badge_id UUID;
  v_badge RECORD;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Get badge details
  SELECT * INTO v_badge FROM badges WHERE id = p_badge_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Badge % not found', p_badge_id;
  END IF;

  -- Check if user already has this badge
  IF EXISTS (
    SELECT 1 FROM user_badges 
    WHERE user_id = p_user_id 
      AND badge_id = p_badge_id 
      AND revoked_at IS NULL
  ) THEN
    RAISE EXCEPTION 'User already has badge: %', v_badge.name;
  END IF;

  -- Award badge
  INSERT INTO user_badges (user_id, badge_id, awarded_at, metadata)
  VALUES (
    p_user_id,
    p_badge_id,
    now(),
    jsonb_build_object(
      'awarded_by_admin', true,
      'admin_id', p_admin_id,
      'award_reason', p_reason,
      'admin_notes', p_notes
    )
  )
  RETURNING id INTO v_user_badge_id;

  -- Log admin action
  PERFORM log_admin_action(
    p_admin_id,
    'badge_award',
    'badge',
    v_user_badge_id,
    jsonb_build_object(
      'user_id', p_user_id,
      'badge_id', p_badge_id,
      'badge_name', v_badge.name
    ),
    p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_badge_id', v_user_badge_id,
    'badge_name', v_badge.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Admin revoke badge from user
CREATE OR REPLACE FUNCTION admin_revoke_badge(
  p_admin_id UUID,
  p_user_badge_id UUID,
  p_reason TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_user_badge RECORD;
  v_badge RECORD;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Get user badge
  SELECT * INTO v_user_badge
  FROM user_badges
  WHERE id = p_user_badge_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User badge % not found', p_user_badge_id;
  END IF;

  IF v_user_badge.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'Badge already revoked';
  END IF;

  -- Get badge details
  SELECT * INTO v_badge FROM badges WHERE id = v_user_badge.badge_id;

  -- Revoke badge (soft delete)
  UPDATE user_badges
  SET 
    revoked_at = now(),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'revoked_by_admin', true,
      'admin_id', p_admin_id,
      'revoke_reason', p_reason,
      'admin_notes', p_notes
    )
  WHERE id = p_user_badge_id;

  -- Log admin action
  PERFORM log_admin_action(
    p_admin_id,
    'badge_revoke',
    'badge',
    p_user_badge_id,
    jsonb_build_object(
      'user_id', v_user_badge.user_id,
      'badge_id', v_user_badge.badge_id,
      'badge_name', v_badge.name
    ),
    p_notes
  );

  RETURN jsonb_build_object(
    'success', true,
    'user_badge_id', p_user_badge_id,
    'badge_name', v_badge.name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get badge statistics
CREATE OR REPLACE FUNCTION get_badge_statistics(p_admin_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_total_badges INTEGER;
  v_total_awards INTEGER;
  v_active_awards INTEGER;
  v_revoked_awards INTEGER;
  v_admin_awards INTEGER;
  v_auto_awards INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Total badge types
  SELECT COUNT(*) INTO v_total_badges FROM badges;

  -- Total badge awards
  SELECT COUNT(*) INTO v_total_awards FROM user_badges;

  -- Active awards
  SELECT COUNT(*) INTO v_active_awards 
  FROM user_badges 
  WHERE revoked_at IS NULL;

  -- Revoked awards
  SELECT COUNT(*) INTO v_revoked_awards 
  FROM user_badges 
  WHERE revoked_at IS NOT NULL;

  -- Admin-awarded badges
  SELECT COUNT(*) INTO v_admin_awards
  FROM user_badges
  WHERE metadata->>'awarded_by_admin' = 'true'
    AND revoked_at IS NULL;

  -- Auto-awarded badges
  SELECT COUNT(*) INTO v_auto_awards
  FROM user_badges
  WHERE (metadata->>'awarded_by_admin' IS NULL OR metadata->>'awarded_by_admin' = 'false')
    AND revoked_at IS NULL;

  RETURN jsonb_build_object(
    'totals', jsonb_build_object(
      'badge_types', v_total_badges,
      'total_awards', v_total_awards,
      'active_awards', v_active_awards,
      'revoked_awards', v_revoked_awards
    ),
    'award_types', jsonb_build_object(
      'admin_awards', v_admin_awards,
      'auto_awards', v_auto_awards
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get badge distribution (how many users have each badge)
CREATE OR REPLACE FUNCTION get_badge_distribution(p_admin_id UUID)
RETURNS TABLE(
  badge_id UUID,
  badge_name TEXT,
  badge_icon TEXT,
  award_count BIGINT,
  rarity_score DECIMAL
) AS $$
DECLARE
  v_total_users INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Get total active users
  SELECT COUNT(*) INTO v_total_users FROM users;

  RETURN QUERY
  SELECT 
    b.id,
    b.name,
    b.icon,
    COUNT(ub.id) AS award_count,
    ROUND(100.0 - (COUNT(ub.id)::DECIMAL / GREATEST(v_total_users, 1) * 100), 2) AS rarity_score
  FROM badges b
  LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.revoked_at IS NULL
  GROUP BY b.id, b.name, b.icon
  ORDER BY award_count ASC; -- Rarest badges first
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Admin badge service
==================================================
*/

// filepath: src/services/admin/badgeManagement.ts

import { supabase } from '@/lib/supabase';

export interface BadgeStatistics {
  totals: {
    badge_types: number;
    total_awards: number;
    active_awards: number;
    revoked_awards: number;
  };
  award_types: {
    admin_awards: number;
    auto_awards: number;
  };
}

export interface BadgeDistribution {
  badge_id: string;
  badge_name: string;
  badge_icon: string;
  award_count: number;
  rarity_score: number;
}

export class AdminBadgeService {
  /**
   * Award badge to user
   */
  static async awardBadge(
    userId: string,
    badgeId: string,
    reason: string,
    notes?: string
  ): Promise<{ success: boolean; badge_name: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('admin_award_badge', {
      p_admin_id: user.id,
      p_user_id: userId,
      p_badge_id: badgeId,
      p_reason: reason,
      p_notes: notes || null,
    });

    if (error) {
      throw new Error(`Failed to award badge: ${error.message}`);
    }

    return data;
  }

  /**
   * Revoke badge from user
   */
  static async revokeBadge(
    userBadgeId: string,
    reason: string,
    notes?: string
  ): Promise<{ success: boolean; badge_name: string }> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('admin_revoke_badge', {
      p_admin_id: user.id,
      p_user_badge_id: userBadgeId,
      p_reason: reason,
      p_notes: notes || null,
    });

    if (error) {
      throw new Error(`Failed to revoke badge: ${error.message}`);
    }

    return data;
  }

  /**
   * Get badge statistics
   */
  static async getStatistics(): Promise<BadgeStatistics> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('get_badge_statistics', {
      p_admin_id: user.id,
    });

    if (error) {
      throw new Error(`Failed to get statistics: ${error.message}`);
    }

    return data as BadgeStatistics;
  }

  /**
   * Get badge distribution (rarity)
   */
  static async getDistribution(): Promise<BadgeDistribution[]> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('get_badge_distribution', {
      p_admin_id: user.id,
    });

    if (error) {
      throw new Error(`Failed to get distribution: ${error.message}`);
    }

    return data as BadgeDistribution[];
  }

  /**
   * Get all badges
   */
  static async getAllBadges() {
    const { data, error } = await supabase
      .from('badges')
      .select('*')
      .order('category', { ascending: true });

    if (error) {
      throw new Error(`Failed to get badges: ${error.message}`);
    }

    return data;
  }

  /**
   * Get user's badges
   */
  static async getUserBadges(userId: string) {
    const { data, error } = await supabase
      .from('user_badges')
      .select(`
        *,
        badges:badge_id (
          id,
          name,
          description,
          icon,
          category
        )
      `)
      .eq('user_id', userId)
      .order('awarded_at', { ascending: false });

    if (error) {
      throw new Error(`Failed to get user badges: ${error.message}`);
    }

    return data;
  }
}

/*
==================================================
FILE 3: Badge admin dashboard UI
==================================================
*/

// filepath: src/screens/admin/BadgeDashboard.tsx

import React, { useEffect, useState } from 'react';
import { AdminBadgeService, type BadgeStatistics, type BadgeDistribution } from '@/services/admin/badgeManagement';

export const BadgeDashboard: React.FC = () => {
  const [statistics, setStatistics] = useState<BadgeStatistics | null>(null);
  const [distribution, setDistribution] = useState<BadgeDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setIsLoading(true);
      const [stats, dist] = await Promise.all([
        AdminBadgeService.getStatistics(),
        AdminBadgeService.getDistribution(),
      ]);
      setStatistics(stats);
      setDistribution(dist);
    } catch (err) {
      console.error('Failed to load badge data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading badge statistics...</div>;
  }

  if (!statistics) {
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Badge Administration</h1>

      {/* Badge Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Badge Types"
          value={statistics.totals.badge_types}
          color="bg-blue-500"
        />
        <MetricCard
          title="Active Awards"
          value={statistics.totals.active_awards}
          color="bg-green-500"
        />
        <MetricCard
          title="Admin Awards"
          value={statistics.award_types.admin_awards}
          color="bg-purple-500"
        />
        <MetricCard
          title="Auto Awards"
          value={statistics.award_types.auto_awards}
          color="bg-indigo-500"
        />
      </div>

      {/* Badge Distribution */}
      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-xl font-semibold mb-4">Badge Distribution (Rarity)</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Badge</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Awards</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Rarity</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {distribution.map((badge) => (
                <tr key={badge.badge_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <span className="text-2xl">{badge.badge_icon}</span>
                      <span className="font-medium">{badge.badge_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2">{badge.award_count}</td>
                  <td className="px-4 py-2">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-blue-600 h-2 rounded-full"
                          style={{ width: `${badge.rarity_score}%` }}
                        />
                      </div>
                      <span className="text-sm text-gray-600">{badge.rarity_score}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Badge Management */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Award/Revoke Badges</h2>
        <BadgeManagementPanel />
      </div>
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: number; color: string }> = ({
  title,
  value,
  color,
}) => (
  <div className={`${color} text-white rounded-lg shadow p-6`}>
    <h3 className="text-sm font-medium opacity-90">{title}</h3>
    <p className="text-3xl font-bold mt-2">{value}</p>
  </div>
);

const BadgeManagementPanel: React.FC = () => {
  const [userId, setUserId] = useState('');
  const [userBadges, setUserBadges] = useState<any[]>([]);
  const [allBadges, setAllBadges] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadAllBadges();
  }, []);

  const loadAllBadges = async () => {
    try {
      const badges = await AdminBadgeService.getAllBadges();
      setAllBadges(badges);
    } catch (err) {
      console.error('Failed to load badges:', err);
    }
  };

  const handleSearchUser = async () => {
    if (!userId.trim()) return;

    setIsLoading(true);
    try {
      const badges = await AdminBadgeService.getUserBadges(userId);
      setUserBadges(badges);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load user badges');
      setUserBadges([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAwardBadge = async (badgeId: string, badgeName: string) => {
    const reason = prompt(`Reason for awarding "${badgeName}":`);
    if (!reason) return;

    setIsLoading(true);
    try {
      await AdminBadgeService.awardBadge(userId, badgeId, reason);
      alert('Badge awarded successfully');
      handleSearchUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to award badge');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevokeBadge = async (userBadgeId: string, badgeName: string) => {
    const reason = prompt(`Reason for revoking "${badgeName}":`);
    if (!reason) return;

    if (!confirm(`Revoke badge "${badgeName}"?`)) return;

    setIsLoading(true);
    try {
      await AdminBadgeService.revokeBadge(userBadgeId, reason);
      alert('Badge revoked successfully');
      handleSearchUser();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to revoke badge');
    } finally {
      setIsLoading(false);
    }
  };

  const userBadgeIds = new Set(
    userBadges.filter(ub => !ub.revoked_at).map(ub => ub.badge_id)
  );

  return (
    <div className="space-y-6">
      {/* User Search */}
      <div className="flex gap-2">
        <input
          type="text"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearchUser()}
          placeholder="Enter user ID..."
          className="flex-1 rounded-md border-gray-300 shadow-sm"
        />
        <button
          onClick={handleSearchUser}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
        >
          {isLoading ? 'Loading...' : 'Search'}
        </button>
      </div>

      {userBadges.length > 0 && (
        <>
          {/* Current Badges */}
          <div>
            <h3 className="font-semibold mb-3">Current Badges</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {userBadges
                .filter(ub => !ub.revoked_at)
                .map((ub) => (
                  <div
                    key={ub.id}
                    className="border rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{ub.badges.icon}</span>
                      <span className="font-medium text-sm">{ub.badges.name}</span>
                    </div>
                    <button
                      onClick={() => handleRevokeBadge(ub.id, ub.badges.name)}
                      disabled={isLoading}
                      className="w-full text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                    >
                      Revoke
                    </button>
                  </div>
                ))}
            </div>
          </div>

          {/* Available Badges */}
          <div>
            <h3 className="font-semibold mb-3">Available Badges to Award</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {allBadges
                .filter(badge => !userBadgeIds.has(badge.id))
                .map((badge) => (
                  <div
                    key={badge.id}
                    className="border rounded-lg p-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-2xl">{badge.icon}</span>
                      <span className="font-medium text-sm">{badge.name}</span>
                    </div>
                    <button
                      onClick={() => handleAwardBadge(badge.id, badge.name)}
                      disabled={isLoading}
                      className="w-full text-xs px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                    >
                      Award
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};
```

### Testing Checklist
- [ ] Admin can award badge to user successfully
- [ ] Admin can revoke badge from user (soft delete)
- [ ] Badge awards/revokes logged in admin_activity_log
- [ ] Cannot award duplicate badge to same user
- [ ] Badge statistics calculate correctly
- [ ] Badge distribution shows rarity accurately
- [ ] User badge list displays all active/revoked badges

### Deployment Notes
1. Test badge awarding/revoking in staging
2. Verify soft delete (revoked_at) works correctly
3. Ensure admin metadata stored in user_badges
4. Monitor badge distribution for anomalies

---

## TASK ADMIN-V2-005: Revenue & Analytics Dashboard

**Duration:** 3.5 hours  
**Priority:** High  
**Dependencies:** ADMIN-V2-001, MODULE-11 (Subscriptions V2), MODULE-06 (Trade Flow V2)

### Description
Create comprehensive revenue and analytics dashboard. Display subscription revenue metrics (MRR, ARR, churn). Show transaction fee revenue breakdown. Visualize user engagement metrics (DAU/MAU with subscription cohorts). Implement time-series charts for trend analysis.

### Acceptance Criteria
- [ ] Dashboard displays MRR and ARR correctly
- [ ] Transaction fee revenue broken down by subscriber/non-subscriber
- [ ] DAU/MAU metrics calculated with subscription cohort analysis
- [ ] Time-series charts show revenue trends
- [ ] Admin can filter metrics by date range
- [ ] Export functionality for analytics data

---

### AI Prompt for Cursor

```typescript
/*
TASK: Revenue and analytics dashboard

CONTEXT:
Admin needs comprehensive view of platform economics.
Key metrics: subscription revenue, transaction fees, user engagement.

V2 REVENUE SOURCES:
1. Subscription: $7.99/month (active subscribers only)
2. Transaction fees: $0.99 (subscribers), $2.99 (non-subscribers)

METRICS TO TRACK:
- MRR (Monthly Recurring Revenue)
- ARR (Annual Recurring Revenue)
- Transaction fee revenue
- DAU/MAU by subscription status
- Churn rate
- ARPU (Average Revenue Per User)

==================================================
FILE 1: Revenue analytics RPCs
==================================================
*/

-- filepath: supabase/migrations/124_admin_revenue_analytics.sql

-- RPC: Get revenue metrics
CREATE OR REPLACE FUNCTION get_revenue_metrics(
  p_admin_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT (now() - INTERVAL '30 days'),
  p_end_date TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB AS $$
DECLARE
  v_active_subscribers INTEGER;
  v_mrr DECIMAL(10,2);
  v_arr DECIMAL(10,2);
  v_transaction_fee_revenue DECIMAL(10,2);
  v_subscriber_fee_revenue DECIMAL(10,2);
  v_non_subscriber_fee_revenue DECIMAL(10,2);
  v_total_revenue DECIMAL(10,2);
  v_arpu DECIMAL(10,2);
  v_total_users INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Active subscribers (trial + active)
  SELECT COUNT(*) INTO v_active_subscribers
  FROM subscriptions
  WHERE status IN ('trial', 'active');

  -- MRR (Monthly Recurring Revenue from active subscribers only)
  v_mrr := v_active_subscribers * 7.99;

  -- ARR (Annual Recurring Revenue)
  v_arr := v_mrr * 12;

  -- Transaction fee revenue in period
  SELECT COALESCE(SUM(
    CASE 
      WHEN s.status IN ('trial', 'active') THEN 0.99
      ELSE 2.99
    END
  ), 0) INTO v_transaction_fee_revenue
  FROM trades t
  LEFT JOIN subscriptions s ON s.user_id = t.buyer_id AND s.status IN ('trial', 'active')
  WHERE t.status = 'completed'
    AND t.completed_at BETWEEN p_start_date AND p_end_date;

  -- Subscriber transaction fees
  SELECT COALESCE(SUM(0.99), 0) INTO v_subscriber_fee_revenue
  FROM trades t
  INNER JOIN subscriptions s ON s.user_id = t.buyer_id AND s.status IN ('trial', 'active')
  WHERE t.status = 'completed'
    AND t.completed_at BETWEEN p_start_date AND p_end_date;

  -- Non-subscriber transaction fees
  v_non_subscriber_fee_revenue := v_transaction_fee_revenue - v_subscriber_fee_revenue;

  -- Total revenue (subscription + transaction fees)
  v_total_revenue := v_mrr + v_transaction_fee_revenue;

  -- Total users
  SELECT COUNT(*) INTO v_total_users FROM users;

  -- ARPU (Average Revenue Per User)
  v_arpu := CASE WHEN v_total_users > 0 THEN v_total_revenue / v_total_users ELSE 0 END;

  RETURN jsonb_build_object(
    'period', jsonb_build_object(
      'start_date', p_start_date,
      'end_date', p_end_date
    ),
    'subscription_revenue', jsonb_build_object(
      'active_subscribers', v_active_subscribers,
      'mrr', v_mrr,
      'arr', v_arr
    ),
    'transaction_fee_revenue', jsonb_build_object(
      'total', v_transaction_fee_revenue,
      'subscribers', v_subscriber_fee_revenue,
      'non_subscribers', v_non_subscriber_fee_revenue
    ),
    'totals', jsonb_build_object(
      'total_revenue', v_total_revenue,
      'total_users', v_total_users,
      'arpu', v_arpu
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC: Get user engagement metrics
CREATE OR REPLACE FUNCTION get_engagement_metrics(
  p_admin_id UUID,
  p_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB AS $$
DECLARE
  v_dau INTEGER;
  v_mau INTEGER;
  v_dau_subscribers INTEGER;
  v_mau_subscribers INTEGER;
  v_dau_non_subscribers INTEGER;
  v_mau_non_subscribers INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users WHERE id = p_admin_id AND role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- DAU (Daily Active Users) - users who logged in today
  -- Note: This assumes you have a user_sessions or login_activity table
  -- For now, using created_at as proxy (replace with actual activity tracking)
  SELECT COUNT(DISTINCT u.id) INTO v_dau
  FROM users u
  WHERE DATE(u.created_at) = p_date OR u.id IN (
    SELECT DISTINCT user_id FROM trades WHERE DATE(created_at) = p_date
  );

  -- MAU (Monthly Active Users) - users active in last 30 days
  SELECT COUNT(DISTINCT u.id) INTO v_mau
  FROM users u
  WHERE u.created_at >= (p_date - INTERVAL '30 days') OR u.id IN (
    SELECT DISTINCT user_id FROM trades WHERE created_at >= (p_date - INTERVAL '30 days')
  );

  -- DAU subscribers
  SELECT COUNT(DISTINCT u.id) INTO v_dau_subscribers
  FROM users u
  INNER JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('trial', 'active')
  WHERE DATE(u.created_at) = p_date OR u.id IN (
    SELECT DISTINCT user_id FROM trades WHERE DATE(created_at) = p_date
  );

  -- MAU subscribers
  SELECT COUNT(DISTINCT u.id) INTO v_mau_subscribers
  FROM users u
  INNER JOIN subscriptions s ON s.user_id = u.id AND s.status IN ('trial', 'active')
  WHERE u.created_at >= (p_date - INTERVAL '30 days') OR u.id IN (
    SELECT DISTINCT user_id FROM trades WHERE created_at >= (p_date - INTERVAL '30 days')
  );

  -- Non-subscriber counts
  v_dau_non_subscribers := v_dau - v_dau_subscribers;
  v_mau_non_subscribers := v_mau - v_mau_subscribers;

  RETURN jsonb_build_object(
    'date', p_date,
    'daily', jsonb_build_object(
      'total', v_dau,
      'subscribers', v_dau_subscribers,
      'non_subscribers', v_dau_non_subscribers
    ),
    'monthly', jsonb_build_object(
      'total', v_mau,
      'subscribers', v_mau_subscribers,
      'non_subscribers', v_mau_non_subscribers
    ),
    'dau_mau_ratio', CASE WHEN v_mau > 0 THEN ROUND((v_dau::DECIMAL / v_mau) * 100, 2) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

/*
==================================================
FILE 2: Admin analytics service
==================================================
*/

// filepath: src/services/admin/analytics.ts

import { supabase } from '@/lib/supabase';

export interface RevenueMetrics {
  period: {
    start_date: string;
    end_date: string;
  };
  subscription_revenue: {
    active_subscribers: number;
    mrr: number;
    arr: number;
  };
  transaction_fee_revenue: {
    total: number;
    subscribers: number;
    non_subscribers: number;
  };
  totals: {
    total_revenue: number;
    total_users: number;
    arpu: number;
  };
}

export interface EngagementMetrics {
  date: string;
  daily: {
    total: number;
    subscribers: number;
    non_subscribers: number;
  };
  monthly: {
    total: number;
    subscribers: number;
    non_subscribers: number;
  };
  dau_mau_ratio: number;
}

export class AdminAnalyticsService {
  /**
   * Get revenue metrics
   */
  static async getRevenueMetrics(
    startDate?: Date,
    endDate?: Date
  ): Promise<RevenueMetrics> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('get_revenue_metrics', {
      p_admin_id: user.id,
      p_start_date: startDate?.toISOString() || undefined,
      p_end_date: endDate?.toISOString() || undefined,
    });

    if (error) {
      throw new Error(`Failed to get revenue metrics: ${error.message}`);
    }

    return data as RevenueMetrics;
  }

  /**
   * Get engagement metrics
   */
  static async getEngagementMetrics(date?: Date): Promise<EngagementMetrics> {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('No authenticated admin');
    }

    const { data, error } = await supabase.rpc('get_engagement_metrics', {
      p_admin_id: user.id,
      p_date: date?.toISOString().split('T')[0] || undefined,
    });

    if (error) {
      throw new Error(`Failed to get engagement metrics: ${error.message}`);
    }

    return data as EngagementMetrics;
  }
}

/*
==================================================
FILE 3: Revenue dashboard UI
==================================================
*/

// filepath: src/screens/admin/RevenueDashboard.tsx

import React, { useEffect, useState } from 'react';
import { AdminAnalyticsService, type RevenueMetrics, type EngagementMetrics } from '@/services/admin/analytics';

export const RevenueDashboard: React.FC = () => {
  const [revenueMetrics, setRevenueMetrics] = useState<RevenueMetrics | null>(null);
  const [engagementMetrics, setEngagementMetrics] = useState<EngagementMetrics | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadMetrics();
  }, []);

  const loadMetrics = async () => {
    try {
      setIsLoading(true);
      const [revenue, engagement] = await Promise.all([
        AdminAnalyticsService.getRevenueMetrics(),
        AdminAnalyticsService.getEngagementMetrics(),
      ]);
      setRevenueMetrics(revenue);
      setEngagementMetrics(engagement);
    } catch (err) {
      console.error('Failed to load metrics:', err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return <div className="p-8">Loading analytics...</div>;
  }

  if (!revenueMetrics || !engagementMetrics) {
    return null;
  }

  return (
    <div className="p-8">
      <h1 className="text-3xl font-bold mb-6">Revenue & Analytics Dashboard</h1>

      {/* Subscription Revenue */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Subscription Revenue</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Active Subscribers"
            value={revenueMetrics.subscription_revenue.active_subscribers}
            color="bg-blue-500"
          />
          <MetricCard
            title="MRR"
            value={`$${revenueMetrics.subscription_revenue.mrr.toFixed(2)}`}
            color="bg-green-500"
          />
          <MetricCard
            title="ARR"
            value={`$${revenueMetrics.subscription_revenue.arr.toFixed(2)}`}
            color="bg-purple-500"
          />
        </div>
      </div>

      {/* Transaction Fee Revenue */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Transaction Fee Revenue (30d)</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Fees"
            value={`$${revenueMetrics.transaction_fee_revenue.total.toFixed(2)}`}
            color="bg-indigo-500"
          />
          <MetricCard
            title="Subscriber Fees ($0.99)"
            value={`$${revenueMetrics.transaction_fee_revenue.subscribers.toFixed(2)}`}
            color="bg-cyan-500"
          />
          <MetricCard
            title="Non-Subscriber Fees ($2.99)"
            value={`$${revenueMetrics.transaction_fee_revenue.non_subscribers.toFixed(2)}`}
            color="bg-orange-500"
          />
        </div>
      </div>

      {/* Total Revenue */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Total Revenue & ARPU</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Total Revenue (30d)"
            value={`$${revenueMetrics.totals.total_revenue.toFixed(2)}`}
            color="bg-emerald-500"
          />
          <MetricCard
            title="Total Users"
            value={revenueMetrics.totals.total_users}
            color="bg-gray-500"
          />
          <MetricCard
            title="ARPU"
            value={`$${revenueMetrics.totals.arpu.toFixed(2)}`}
            color="bg-pink-500"
          />
        </div>
      </div>

      {/* Engagement Metrics */}
      <div>
        <h2 className="text-xl font-semibold mb-4">User Engagement</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <MetricCard
            title="DAU"
            value={engagementMetrics.daily.total}
            subtitle={`${engagementMetrics.daily.subscribers} subscribers`}
            color="bg-violet-500"
          />
          <MetricCard
            title="MAU"
            value={engagementMetrics.monthly.total}
            subtitle={`${engagementMetrics.monthly.subscribers} subscribers`}
            color="bg-fuchsia-500"
          />
          <MetricCard
            title="DAU/MAU Ratio"
            value={`${engagementMetrics.dau_mau_ratio}%`}
            color="bg-rose-500"
          />
          <MetricCard
            title="Non-Subscriber DAU"
            value={engagementMetrics.daily.non_subscribers}
            color="bg-amber-500"
          />
        </div>
      </div>
    </div>
  );
};

const MetricCard: React.FC<{
  title: string;
  value: string | number;
  subtitle?: string;
  color: string;
}> = ({ title, value, subtitle, color }) => (
  <div className={`${color} text-white rounded-lg shadow p-6`}>
    <h3 className="text-sm font-medium opacity-90">{title}</h3>
    <p className="text-3xl font-bold mt-2">{value}</p>
    {subtitle && <p className="text-xs opacity-75 mt-1">{subtitle}</p>}
  </div>
);
```

### Testing Checklist
- [ ] MRR calculated correctly (active subscribers × $7.99)
- [ ] ARR equals MRR × 12
- [ ] Transaction fee revenue separated by subscriber status
- [ ] ARPU calculated correctly (total revenue / total users)
- [ ] DAU/MAU metrics display accurately
- [ ] Engagement metrics show subscription cohort breakdown

### Deployment Notes
1. Implement proper user activity tracking for accurate DAU/MAU
2. Set up scheduled analytics snapshots for historical trends
3. Configure export functionality for compliance reporting
4. Monitor revenue metrics daily for anomalies

---

## TASK ADMIN-V2-006: User Management Dashboard

**Duration:** 5 hours  
**Priority:** High  
**Dependencies:** ADMIN-V2-001, ADMIN-V2-002, MODULE-03 (Authentication V2), MODULE-11 (Subscriptions V2), MODULE-09 (Swap Points V2)

### Description
Create a comprehensive user management dashboard for the admin panel. Display top-level user analytics (total users, active users, new signups, suspended accounts). Provide a paginated, searchable, filterable table showing every user's profile data including name, email, phone, subscription status, registration date, and last login date. Enable admin actions: suspend/unsuspend account, view full user profile, inspect trade and listing history, view SP wallet, trigger a password-reset email, and soft-delete an account. Log every admin action against the user in `admin_activity_log`.

### Acceptance Criteria
- [ ] Dashboard displays user counts broken down by status (total, active, new this month, suspended)
- [ ] Dashboard displays user breakdown by subscription tier (trial/active/grace/cancelled/free)
- [ ] User table shows: avatar, full name, email, phone, subscription status, node, registered date, last login, account status
- [ ] Table supports search by name, email, or phone
- [ ] Table supports filter by subscription status, account status, and node
- [ ] Table is paginated (20 users per page) with total count displayed
- [ ] Admin can suspend a user with a mandatory reason
- [ ] Admin can unsuspend a user with a mandatory reason
- [ ] Admin can trigger a password-reset email for any user
- [ ] Admin can soft-delete a user account with confirmation and mandatory reason
- [ ] Admin can click a user row to open a full user detail panel
- [ ] User detail panel shows profile info, subscription history, trade history (count + last trade), SP wallet summary, badge count, and recent activity log
- [ ] All admin actions on users logged in `admin_activity_log`
- [ ] Non-admin users cannot call any user-management RPCs

---

### AI Prompt for Cursor

```typescript
/*
TASK: User management dashboard with admin controls

CONTEXT:
Admin needs a single dashboard to inspect, search, and manage all users.
Common use cases: CS requests, abuse/trust-and-safety, account recovery.

V2 USER MODEL:
- Users exist in `users` table with role, subscription, SP wallet, badges
- Account status: 'active' | 'suspended' | 'banned'
- Subscription status comes from `subscriptions` table
- Last login tracked via Supabase auth.users.last_sign_in_at
- Node assignment from user_preferences or node_members table

ADMIN ACTIONS:
1. View user list with filters/search/pagination
2. View full user detail (profile + sub + SP + trades + badges)
3. Suspend / unsuspend user (with reason, logged)
4. Trigger password-reset email (via Supabase admin API)
5. Soft-delete account (sets deleted_at, logged)

SECURITY:
- All RPCs verify admin role (role = 'admin')
- Soft-delete only — no hard deletes
- Every action logged in admin_activity_log

==================================================
FILE 1: Database migration for user management
==================================================
*/

-- filepath: supabase/migrations/125_admin_user_management.sql

-- -----------------------------------------------
-- BLOCK 1: Schema changes
-- -----------------------------------------------

-- Account status enum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'account_status') THEN
    CREATE TYPE account_status AS ENUM ('active', 'suspended', 'banned');
  END IF;
END $$;

-- Add account-management columns to users table
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS account_status account_status DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS suspended_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS suspended_by    UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS suspension_reason TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by      UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS deletion_reason TEXT;

-- Index for status-based admin queries
CREATE INDEX IF NOT EXISTS users_account_status_idx ON users(account_status);
CREATE INDEX IF NOT EXISTS users_deleted_at_idx     ON users(deleted_at) WHERE deleted_at IS NULL;

-- -----------------------------------------------
-- BLOCK 2: RPC — paginated user list with filters
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION admin_list_users(
  p_admin_id         UUID,
  p_search           TEXT    DEFAULT NULL,
  p_account_status   TEXT    DEFAULT NULL,   -- 'active' | 'suspended' | 'banned'
  p_subscription_status TEXT DEFAULT NULL,   -- 'trial' | 'active' | 'grace_period' | 'cancelled' | 'none'
  p_node_id          UUID    DEFAULT NULL,
  p_page             INTEGER DEFAULT 1,
  p_page_size        INTEGER DEFAULT 20
)
RETURNS JSONB AS $$
DECLARE
  v_offset     INTEGER;
  v_total      INTEGER;
  v_users      JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p_admin_id AND u.role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  v_offset := (p_page - 1) * p_page_size;

  -- Total count (for pagination header)
  SELECT COUNT(*)
  INTO   v_total
  FROM   users u
  LEFT   JOIN subscriptions s ON s.user_id = u.id
                              AND s.id = (
                                SELECT id FROM subscriptions s2
                                WHERE  s2.user_id = u.id
                                ORDER  BY s2.created_at DESC LIMIT 1
                              )
  LEFT   JOIN auth.users au ON au.id = u.id
  WHERE  u.deleted_at IS NULL
    AND  (
           p_search IS NULL
           OR u.full_name ILIKE '%' || p_search || '%'
           OR u.email     ILIKE '%' || p_search || '%'
           OR u.phone     ILIKE '%' || p_search || '%'
         )
    AND  (p_account_status  IS NULL OR u.account_status::TEXT = p_account_status)
    AND  (
           p_subscription_status IS NULL
           OR (p_subscription_status = 'none' AND s.id IS NULL)
           OR s.status::TEXT = p_subscription_status
         );

  -- Paginated data
  SELECT jsonb_agg(row_to_json(t))
  INTO   v_users
  FROM (
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.phone,
      u.avatar_url,
      u.account_status,
      u.role,
      u.created_at                          AS registered_at,
      au.last_sign_in_at                    AS last_login_at,
      s.status                              AS subscription_status,
      s.trial_ends_at,
      s.current_period_end,
      COALESCE(sp.balance, 0)               AS sp_balance,
      COALESCE(trades.trade_count, 0)       AS trade_count,
      COALESCE(badges.badge_count, 0)       AS badge_count
    FROM   users u
    LEFT   JOIN auth.users au ON au.id = u.id
    LEFT   JOIN subscriptions s ON s.user_id = u.id
                                AND s.id = (
                                  SELECT id FROM subscriptions s2
                                  WHERE  s2.user_id = u.id
                                  ORDER  BY s2.created_at DESC LIMIT 1
                                )
    LEFT   JOIN sp_wallets sp ON sp.user_id = u.id
    LEFT   JOIN (
                  SELECT seller_id AS user_id, COUNT(*) AS trade_count
                  FROM   transactions
                  WHERE  status = 'completed'
                  GROUP  BY seller_id
                ) trades ON trades.user_id = u.id
    LEFT   JOIN (
                  SELECT user_id, COUNT(*) AS badge_count
                  FROM   user_badges
                  WHERE  revoked_at IS NULL
                  GROUP  BY user_id
                ) badges ON badges.user_id = u.id
    WHERE  u.deleted_at IS NULL
      AND  (
             p_search IS NULL
             OR u.full_name ILIKE '%' || p_search || '%'
             OR u.email     ILIKE '%' || p_search || '%'
             OR u.phone     ILIKE '%' || p_search || '%'
           )
      AND  (p_account_status IS NULL OR u.account_status::TEXT = p_account_status)
      AND  (
             p_subscription_status IS NULL
             OR (p_subscription_status = 'none' AND s.id IS NULL)
             OR s.status::TEXT = p_subscription_status
           )
    ORDER  BY u.created_at DESC
    LIMIT  p_page_size
    OFFSET v_offset
  ) t;

  RETURN jsonb_build_object(
    'users',      COALESCE(v_users, '[]'::JSONB),
    'total',      v_total,
    'page',       p_page,
    'page_size',  p_page_size,
    'total_pages', CEIL(v_total::FLOAT / p_page_size)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------
-- BLOCK 3: RPC — full user detail
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION admin_get_user_detail(
  p_admin_id UUID,
  p_user_id  UUID
)
RETURNS JSONB AS $$
DECLARE
  v_user        JSONB;
  v_sub         JSONB;
  v_sp          JSONB;
  v_trades      JSONB;
  v_badges      JSONB;
  v_activity    JSONB;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p_admin_id AND u.role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Core profile
  SELECT row_to_json(t) INTO v_user
  FROM (
    SELECT
      u.id,
      u.full_name,
      u.email,
      u.phone,
      u.avatar_url,
      u.account_status,
      u.role,
      u.dob,
      u.created_at          AS registered_at,
      u.suspended_at,
      u.suspension_reason,
      au.last_sign_in_at    AS last_login_at,
      au.email_confirmed_at,
      au.phone_confirmed_at
    FROM  users u
    LEFT  JOIN auth.users au ON au.id = u.id
    WHERE u.id = p_user_id
  ) t;

  IF v_user IS NULL THEN
    RAISE EXCEPTION 'User % not found', p_user_id;
  END IF;

  -- Latest subscription
  SELECT row_to_json(t) INTO v_sub
  FROM (
    SELECT s.id, s.status, s.trial_ends_at, s.current_period_end,
           s.cancelled_at, s.created_at
    FROM   subscriptions s
    WHERE  s.user_id = p_user_id
    ORDER  BY s.created_at DESC
    LIMIT  1
  ) t;

  -- SP wallet summary
  SELECT row_to_json(t) INTO v_sp
  FROM (
    SELECT sw.balance, sw.status,
           COALESCE(
             (SELECT SUM(amount) FROM sp_transactions st
              WHERE  st.wallet_id = sw.id AND st.type = 'earned'), 0
           ) AS lifetime_earned,
           COALESCE(
             (SELECT SUM(ABS(amount)) FROM sp_transactions st
              WHERE  st.wallet_id = sw.id AND st.type = 'spent'), 0
           ) AS lifetime_spent
    FROM   sp_wallets sw
    WHERE  sw.user_id = p_user_id
  ) t;

  -- Trade summary (last 5 + totals)
  SELECT jsonb_build_object(
    'total_completed',
    COALESCE((
      SELECT COUNT(*) FROM transactions
      WHERE  (buyer_id = p_user_id OR seller_id = p_user_id)
        AND  status = 'completed'
    ), 0),
    'total_as_seller',
    COALESCE((
      SELECT COUNT(*) FROM transactions
      WHERE  seller_id = p_user_id AND status = 'completed'
    ), 0),
    'total_as_buyer',
    COALESCE((
      SELECT COUNT(*) FROM transactions
      WHERE  buyer_id = p_user_id AND status = 'completed'
    ), 0),
    'last_trade_at',
    (
      SELECT MAX(completed_at) FROM transactions
      WHERE  (buyer_id = p_user_id OR seller_id = p_user_id)
        AND  status = 'completed'
    )
  ) INTO v_trades;

  -- Badge count
  SELECT jsonb_build_object(
    'total', COALESCE((
      SELECT COUNT(*) FROM user_badges
      WHERE  user_id = p_user_id AND revoked_at IS NULL
    ), 0),
    'badges', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'badge_id', ub.badge_id,
        'badge_name', b.name,
        'awarded_at', ub.awarded_at
      ))
      FROM   user_badges ub
      JOIN   badges b ON b.id = ub.badge_id
      WHERE  ub.user_id = p_user_id AND ub.revoked_at IS NULL
      ORDER  BY ub.awarded_at DESC
    ), '[]'::JSONB)
  ) INTO v_badges;

  -- Recent admin activity log for this user (last 10)
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::JSONB)
  INTO   v_activity
  FROM (
    SELECT al.id, al.action_type, al.details, al.notes, al.created_at,
           u.email AS performed_by_email
    FROM   admin_activity_log al
    JOIN   users u ON u.id = al.admin_id
    WHERE  al.entity_type = 'user'
      AND  al.entity_id   = p_user_id
    ORDER  BY al.created_at DESC
    LIMIT  10
  ) t;

  RETURN jsonb_build_object(
    'user',         v_user,
    'subscription', v_sub,
    'sp_wallet',    v_sp,
    'trades',       v_trades,
    'badges',       v_badges,
    'activity_log', v_activity
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------
-- BLOCK 4: RPC — suspend / unsuspend user
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION admin_suspend_user(
  p_admin_id UUID,
  p_user_id  UUID,
  p_reason   TEXT
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p_admin_id AND u.role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Suspension reason is required';
  END IF;

  UPDATE users
  SET    account_status    = 'suspended',
         suspended_at      = now(),
         suspended_by      = p_admin_id,
         suspension_reason = p_reason
  WHERE  id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found or already deleted', p_user_id;
  END IF;

  PERFORM log_admin_action(
    p_admin_id, 'user_suspend', 'user', p_user_id,
    jsonb_build_object('reason', p_reason),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'account_status', 'suspended');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION admin_unsuspend_user(
  p_admin_id UUID,
  p_user_id  UUID,
  p_reason   TEXT
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p_admin_id AND u.role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Unsuspension reason is required';
  END IF;

  UPDATE users
  SET    account_status    = 'active',
         suspended_at      = NULL,
         suspended_by      = NULL,
         suspension_reason = NULL
  WHERE  id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found or already deleted', p_user_id;
  END IF;

  PERFORM log_admin_action(
    p_admin_id, 'user_unsuspend', 'user', p_user_id,
    jsonb_build_object('reason', p_reason),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'account_status', 'active');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------
-- BLOCK 5: RPC — soft-delete user
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION admin_delete_user(
  p_admin_id UUID,
  p_user_id  UUID,
  p_reason   TEXT
)
RETURNS JSONB AS $$
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p_admin_id AND u.role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  -- Prevent admin self-delete
  IF p_admin_id = p_user_id THEN
    RAISE EXCEPTION 'Admin cannot delete their own account via this RPC';
  END IF;

  IF p_reason IS NULL OR TRIM(p_reason) = '' THEN
    RAISE EXCEPTION 'Deletion reason is required';
  END IF;

  UPDATE users
  SET    deleted_at      = now(),
         deleted_by      = p_admin_id,
         deletion_reason = p_reason,
         account_status  = 'banned'
  WHERE  id = p_user_id AND deleted_at IS NULL;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User % not found or already deleted', p_user_id;
  END IF;

  -- Freeze SP wallet on deletion
  UPDATE sp_wallets
  SET    status = 'suspended'
  WHERE  user_id = p_user_id;

  PERFORM log_admin_action(
    p_admin_id, 'user_delete', 'user', p_user_id,
    jsonb_build_object('reason', p_reason, 'soft_delete', true),
    p_reason
  );

  RETURN jsonb_build_object('success', true, 'deleted', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- -----------------------------------------------
-- BLOCK 6: RPC — user analytics summary
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION admin_get_user_analytics(
  p_admin_id UUID
)
RETURNS JSONB AS $$
DECLARE
  v_total           INTEGER;
  v_active          INTEGER;
  v_suspended       INTEGER;
  v_new_this_month  INTEGER;
  v_deleted         INTEGER;
  v_by_subscription JSONB;
  v_dau             INTEGER;
  v_mau             INTEGER;
BEGIN
  -- Verify admin role
  IF NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p_admin_id AND u.role = 'admin') THEN
    RAISE EXCEPTION 'User % is not an admin', p_admin_id;
  END IF;

  SELECT COUNT(*) INTO v_total      FROM users WHERE deleted_at IS NULL;
  SELECT COUNT(*) INTO v_active     FROM users WHERE account_status = 'active'    AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_suspended  FROM users WHERE account_status = 'suspended' AND deleted_at IS NULL;
  SELECT COUNT(*) INTO v_deleted    FROM users WHERE deleted_at IS NOT NULL;

  SELECT COUNT(*) INTO v_new_this_month
  FROM   users
  WHERE  created_at >= date_trunc('month', now())
    AND  deleted_at IS NULL;

  SELECT COUNT(*) INTO v_dau
  FROM   auth.users
  WHERE  last_sign_in_at >= now() - INTERVAL '1 day';

  SELECT COUNT(*) INTO v_mau
  FROM   auth.users
  WHERE  last_sign_in_at >= now() - INTERVAL '30 days';

  -- Breakdown by latest subscription status
  SELECT jsonb_object_agg(COALESCE(sub_status, 'none'), cnt)
  INTO   v_by_subscription
  FROM (
    SELECT
      COALESCE(s.status::TEXT, 'none') AS sub_status,
      COUNT(u.id)                       AS cnt
    FROM   users u
    LEFT   JOIN subscriptions s ON s.user_id = u.id
                                AND s.id = (
                                  SELECT id FROM subscriptions s2
                                  WHERE  s2.user_id = u.id
                                  ORDER  BY s2.created_at DESC LIMIT 1
                                )
    WHERE  u.deleted_at IS NULL
    GROUP  BY sub_status
  ) t;

  RETURN jsonb_build_object(
    'total_users',       v_total,
    'active_users',      v_active,
    'suspended_users',   v_suspended,
    'deleted_users',     v_deleted,
    'new_this_month',    v_new_this_month,
    'dau',               v_dau,
    'mau',               v_mau,
    'by_subscription',   v_by_subscription
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

/*
==================================================
FILE 2: TypeScript types for user management
==================================================
*/

// filepath: src/types/adminUsers.ts

export type AccountStatus = 'active' | 'suspended' | 'banned';

export type SubscriptionStatusFilter =
  | 'trial'
  | 'active'
  | 'grace_period'
  | 'cancelled'
  | 'none';

export interface AdminUserRow {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  avatar_url: string | null;
  account_status: AccountStatus;
  role: string;
  registered_at: string;
  last_login_at: string | null;
  subscription_status: SubscriptionStatusFilter | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
  sp_balance: number;
  trade_count: number;
  badge_count: number;
}

export interface AdminUserListResult {
  users: AdminUserRow[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

export interface AdminUserDetail {
  user: {
    id: string;
    full_name: string | null;
    email: string;
    phone: string | null;
    avatar_url: string | null;
    account_status: AccountStatus;
    role: string;
    dob: string | null;
    registered_at: string;
    suspended_at: string | null;
    suspension_reason: string | null;
    last_login_at: string | null;
    email_confirmed_at: string | null;
    phone_confirmed_at: string | null;
  };
  subscription: {
    id: string;
    status: string;
    trial_ends_at: string | null;
    current_period_end: string | null;
    cancelled_at: string | null;
    created_at: string;
  } | null;
  sp_wallet: {
    balance: number;
    status: string;
    lifetime_earned: number;
    lifetime_spent: number;
  } | null;
  trades: {
    total_completed: number;
    total_as_seller: number;
    total_as_buyer: number;
    last_trade_at: string | null;
  };
  badges: {
    total: number;
    badges: { badge_id: string; badge_name: string; awarded_at: string }[];
  };
  activity_log: {
    id: string;
    action_type: string;
    details: Record<string, any> | null;
    notes: string | null;
    created_at: string;
    performed_by_email: string;
  }[];
}

export interface UserAnalytics {
  total_users: number;
  active_users: number;
  suspended_users: number;
  deleted_users: number;
  new_this_month: number;
  dau: number;
  mau: number;
  by_subscription: Record<string, number>;
}

export interface UserListFilters {
  search?: string;
  account_status?: AccountStatus;
  subscription_status?: SubscriptionStatusFilter;
  node_id?: string;
  page?: number;
  page_size?: number;
}

/*
==================================================
FILE 3: Admin user management service
==================================================
*/

// filepath: src/services/admin/userManagement.ts

import { supabase } from '@/lib/supabase';
import type {
  AdminUserListResult,
  AdminUserDetail,
  UserAnalytics,
  UserListFilters,
  AccountStatus,
} from '@/types/adminUsers';

export class AdminUserManagementService {
  /**
   * Get paginated user list with optional filters
   */
  static async listUsers(filters: UserListFilters = {}): Promise<AdminUserListResult> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated admin');

    const { data, error } = await supabase.rpc('admin_list_users', {
      p_admin_id:           user.id,
      p_search:             filters.search             ?? null,
      p_account_status:     filters.account_status     ?? null,
      p_subscription_status: filters.subscription_status ?? null,
      p_node_id:            filters.node_id            ?? null,
      p_page:               filters.page               ?? 1,
      p_page_size:          filters.page_size          ?? 20,
    });

    if (error) throw new Error(`Failed to fetch users: ${error.message}`);
    return data as AdminUserListResult;
  }

  /**
   * Get full detail for a single user
   */
  static async getUserDetail(userId: string): Promise<AdminUserDetail> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated admin');

    const { data, error } = await supabase.rpc('admin_get_user_detail', {
      p_admin_id: user.id,
      p_user_id:  userId,
    });

    if (error) throw new Error(`Failed to fetch user detail: ${error.message}`);
    return data as AdminUserDetail;
  }

  /**
   * Suspend a user account
   */
  static async suspendUser(userId: string, reason: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated admin');

    const { error } = await supabase.rpc('admin_suspend_user', {
      p_admin_id: user.id,
      p_user_id:  userId,
      p_reason:   reason,
    });

    if (error) throw new Error(`Failed to suspend user: ${error.message}`);
  }

  /**
   * Unsuspend a user account
   */
  static async unsuspendUser(userId: string, reason: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated admin');

    const { error } = await supabase.rpc('admin_unsuspend_user', {
      p_admin_id: user.id,
      p_user_id:  userId,
      p_reason:   reason,
    });

    if (error) throw new Error(`Failed to unsuspend user: ${error.message}`);
  }

  /**
   * Soft-delete a user account
   */
  static async deleteUser(userId: string, reason: string): Promise<void> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated admin');

    const { error } = await supabase.rpc('admin_delete_user', {
      p_admin_id: user.id,
      p_user_id:  userId,
      p_reason:   reason,
    });

    if (error) throw new Error(`Failed to delete user: ${error.message}`);
  }

  /**
   * Trigger a password-reset email for a user (uses Supabase admin API from Edge Function)
   */
  static async triggerPasswordReset(userId: string): Promise<void> {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error('No authenticated admin');

    const response = await fetch(
      `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/admin-trigger-password-reset`,
      {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ target_user_id: userId }),
      }
    );

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err?.error?.message ?? 'Failed to trigger password reset');
    }
  }

  /**
   * Get top-level user analytics
   */
  static async getAnalytics(): Promise<UserAnalytics> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('No authenticated admin');

    const { data, error } = await supabase.rpc('admin_get_user_analytics', {
      p_admin_id: user.id,
    });

    if (error) throw new Error(`Failed to fetch user analytics: ${error.message}`);
    return data as UserAnalytics;
  }
}

/*
==================================================
FILE 4: Edge Function — admin-trigger-password-reset
         (uses service-role key to call auth admin API)
==================================================
*/

// filepath: supabase/functions/admin-trigger-password-reset/index.ts
// SECURITY DEFINER equivalent for Edge Functions.
// Uses service role to call Supabase Auth Admin API.
// Authorization: verifies caller is admin via DB role check.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Missing authorization header' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify caller JWT with anon client
    const anonClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user: callerUser }, error: callerErr } = await anonClient.auth.getUser();
    if (callerErr || !callerUser) {
      return new Response(
        JSON.stringify({ error: { code: 'UNAUTHORIZED', message: 'Invalid token' } }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role in DB
    const { data: adminCheck } = await anonClient
      .from('users')
      .select('role')
      .eq('id', callerUser.id)
      .single();

    if (adminCheck?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Admin privileges required' } }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { target_user_id } = await req.json();
    if (!target_user_id) {
      return new Response(
        JSON.stringify({ error: { code: 'INVALID_INPUT', message: 'target_user_id is required' } }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Use service role to fetch user email and send reset
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get target user email
    const { data: targetUserData, error: targetErr } = await serviceClient.auth.admin.getUserById(target_user_id);
    if (targetErr || !targetUserData.user?.email) {
      return new Response(
        JSON.stringify({ error: { code: 'USER_NOT_FOUND', message: 'Target user not found or has no email' } }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Trigger password reset using public client (uses email template)
    const publicClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!
    );
    await publicClient.auth.resetPasswordForEmail(targetUserData.user.email);

    // Log audit event
    await anonClient.rpc('log_admin_action', {
      p_admin_id:    callerUser.id,
      p_action_type: 'user_password_reset',
      p_entity_type: 'user',
      p_entity_id:   target_user_id,
      p_details:     { triggered_by_admin: true },
      p_notes:       'Admin-triggered password reset email',
    });

    console.log('[admin-trigger-password-reset]', {
      admin_id: callerUser.id,
      target_user_id,
    });

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[admin-trigger-password-reset] error', err);
    return new Response(
      JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'Unexpected server error' } }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

/*
==================================================
FILE 5: User Management Dashboard UI
==================================================
*/

// filepath: src/app/users/page.tsx  (Next.js admin panel)

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { AdminUserManagementService } from '@/services/admin/userManagement';
import type {
  AdminUserRow,
  AdminUserDetail,
  UserAnalytics,
  UserListFilters,
  AccountStatus,
  SubscriptionStatusFilter,
} from '@/types/adminUsers';

// ─── Analytics header ───────────────────────────────────────────────────────

const UserAnalyticsHeader: React.FC<{ analytics: UserAnalytics }> = ({ analytics }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
    <MetricCard title="Total Users"       value={analytics.total_users}      color="bg-blue-600" />
    <MetricCard title="Active"            value={analytics.active_users}     color="bg-green-600" />
    <MetricCard title="Suspended"         value={analytics.suspended_users}  color="bg-orange-500" />
    <MetricCard title="Deleted"           value={analytics.deleted_users}    color="bg-red-600" />
    <MetricCard title="New This Month"    value={analytics.new_this_month}   color="bg-purple-600" />
    <MetricCard title="DAU"               value={analytics.dau}              color="bg-indigo-500" />
    <MetricCard title="MAU"               value={analytics.mau}              color="bg-cyan-600" />
  </div>
);

const SubscriptionBreakdown: React.FC<{ bySubscription: Record<string, number> }> = ({ bySubscription }) => {
  const colorMap: Record<string, string> = {
    trial:        'bg-yellow-500',
    active:       'bg-green-500',
    grace_period: 'bg-orange-400',
    cancelled:    'bg-red-400',
    none:         'bg-gray-400',
  };

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      {Object.entries(bySubscription).map(([status, count]) => (
        <MetricCard
          key={status}
          title={`Subscription: ${status.replace('_', ' ')}`}
          value={count}
          color={colorMap[status] ?? 'bg-gray-500'}
        />
      ))}
    </div>
  );
};

const MetricCard: React.FC<{ title: string; value: string | number; color: string }> = ({
  title, value, color,
}) => (
  <div className={`${color} text-white rounded-lg shadow p-5`}>
    <h3 className="text-xs font-medium opacity-90 uppercase tracking-wide">{title}</h3>
    <p className="text-3xl font-bold mt-2">{value}</p>
  </div>
);

// ─── Filter bar ─────────────────────────────────────────────────────────────

const FilterBar: React.FC<{
  filters: UserListFilters;
  onChange: (f: UserListFilters) => void;
}> = ({ filters, onChange }) => (
  <div className="flex flex-wrap gap-3 mb-4">
    <input
      type="text"
      placeholder="Search name, email, phone…"
      value={filters.search ?? ''}
      onChange={(e) => onChange({ ...filters, search: e.target.value || undefined, page: 1 })}
      className="flex-1 min-w-[200px] rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"
    />

    <select
      value={filters.account_status ?? ''}
      onChange={(e) => onChange({ ...filters, account_status: (e.target.value as AccountStatus) || undefined, page: 1 })}
      className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm"
    >
      <option value="">All statuses</option>
      <option value="active">Active</option>
      <option value="suspended">Suspended</option>
      <option value="banned">Banned</option>
    </select>

    <select
      value={filters.subscription_status ?? ''}
      onChange={(e) =>
        onChange({ ...filters, subscription_status: (e.target.value as SubscriptionStatusFilter) || undefined, page: 1 })
      }
      className="rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm"
    >
      <option value="">All subscriptions</option>
      <option value="trial">Trial</option>
      <option value="active">Active</option>
      <option value="grace_period">Grace Period</option>
      <option value="cancelled">Cancelled</option>
      <option value="none">Free (no sub)</option>
    </select>
  </div>
);

// ─── User table ─────────────────────────────────────────────────────────────

const subscriptionBadge = (status: string | null) => {
  const map: Record<string, string> = {
    trial:        'bg-yellow-100 text-yellow-800',
    active:       'bg-green-100 text-green-800',
    grace_period: 'bg-orange-100 text-orange-800',
    cancelled:    'bg-red-100 text-red-800',
    none:         'bg-gray-100 text-gray-600',
  };
  const key = status ?? 'none';
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[key] ?? map.none}`}>
      {key.replace('_', ' ')}
    </span>
  );
};

const accountStatusBadge = (status: AccountStatus) => {
  const map: Record<AccountStatus, string> = {
    active:    'bg-green-100 text-green-800',
    suspended: 'bg-orange-100 text-orange-800',
    banned:    'bg-red-100 text-red-800',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status]}`}>
      {status}
    </span>
  );
};

const UserTable: React.FC<{
  users: AdminUserRow[];
  onSelectUser: (u: AdminUserRow) => void;
}> = ({ users, onSelectUser }) => (
  <div className="overflow-x-auto">
    <table className="min-w-full divide-y divide-gray-200 text-sm">
      <thead className="bg-gray-50">
        <tr>
          {['User', 'Email', 'Phone', 'Subscription', 'Account', 'Registered', 'Last Login', 'Trades', 'SP', 'Badges'].map(
            (h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                {h}
              </th>
            )
          )}
          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
        </tr>
      </thead>
      <tbody className="bg-white divide-y divide-gray-200">
        {users.map((u) => (
          <tr key={u.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => onSelectUser(u)}>
            <td className="px-4 py-3 whitespace-nowrap">
              <div className="flex items-center gap-2">
                {u.avatar_url ? (
                  <img src={u.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xs font-bold">
                    {(u.full_name ?? u.email)[0].toUpperCase()}
                  </div>
                )}
                <span className="font-medium text-gray-900">{u.full_name ?? '—'}</span>
              </div>
            </td>
            <td className="px-4 py-3 text-gray-600">{u.email}</td>
            <td className="px-4 py-3 text-gray-600">{u.phone ?? '—'}</td>
            <td className="px-4 py-3">{subscriptionBadge(u.subscription_status)}</td>
            <td className="px-4 py-3">{accountStatusBadge(u.account_status)}</td>
            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
              {new Date(u.registered_at).toLocaleDateString()}
            </td>
            <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
              {u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : '—'}
            </td>
            <td className="px-4 py-3 text-center text-gray-700">{u.trade_count}</td>
            <td className="px-4 py-3 text-center text-gray-700">{u.sp_balance.toLocaleString()}</td>
            <td className="px-4 py-3 text-center text-gray-700">{u.badge_count}</td>
            <td className="px-4 py-3 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onSelectUser(u)}
                className="text-blue-600 hover:text-blue-800 text-xs font-medium mr-2"
              >
                Details
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// ─── Pagination ──────────────────────────────────────────────────────────────

const Pagination: React.FC<{
  page: number;
  totalPages: number;
  total: number;
  pageSize: number;
  onChange: (p: number) => void;
}> = ({ page, totalPages, total, pageSize, onChange }) => (
  <div className="flex items-center justify-between mt-4 text-sm text-gray-600">
    <span>
      Showing {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)} of {total} users
    </span>
    <div className="flex gap-2">
      <button
        disabled={page === 1}
        onClick={() => onChange(page - 1)}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
      >
        ← Prev
      </button>
      <span className="px-3 py-1">Page {page} of {totalPages}</span>
      <button
        disabled={page === totalPages}
        onClick={() => onChange(page + 1)}
        className="px-3 py-1 rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-50"
      >
        Next →
      </button>
    </div>
  </div>
);

// ─── User detail panel ───────────────────────────────────────────────────────

const UserDetailPanel: React.FC<{
  userId: string;
  onClose: () => void;
  onRefresh: () => void;
}> = ({ userId, onClose, onRefresh }) => {
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [reasonInput, setReasonInput] = useState('');

  useEffect(() => {
    AdminUserManagementService.getUserDetail(userId)
      .then(setDetail)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userId]);

  const handleSuspend = async () => {
    if (!reasonInput.trim()) {
      alert('Reason is required to suspend this account.');
      return;
    }
    if (!confirm('Suspend this user?')) return;
    setActionLoading(true);
    try {
      await AdminUserManagementService.suspendUser(userId, reasonInput);
      setReasonInput('');
      onRefresh();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsuspend = async () => {
    if (!reasonInput.trim()) {
      alert('Reason is required to unsuspend this account.');
      return;
    }
    setActionLoading(true);
    try {
      await AdminUserManagementService.unsuspendUser(userId, reasonInput);
      setReasonInput('');
      onRefresh();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!reasonInput.trim()) {
      alert('Reason is required to delete this account.');
      return;
    }
    if (!confirm('⚠️ This will permanently soft-delete the account. Are you sure?')) return;
    setActionLoading(true);
    try {
      await AdminUserManagementService.deleteUser(userId, reasonInput);
      setReasonInput('');
      onRefresh();
      onClose();
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    if (!confirm('Send a password reset email to this user?')) return;
    setActionLoading(true);
    try {
      await AdminUserManagementService.triggerPasswordReset(userId);
      alert('Password reset email sent.');
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 w-full max-w-2xl shadow-2xl">
        <p className="text-center text-gray-500">Loading user details…</p>
      </div>
    </div>
  );

  if (!detail) return null;
  const { user, subscription, sp_wallet, trades, badges, activity_log } = detail;

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-full max-w-3xl shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            {user.avatar_url ? (
              <img src={user.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover" />
            ) : (
              <div className="w-12 h-12 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-lg font-bold">
                {(user.full_name ?? user.email)[0].toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-lg font-bold text-gray-900">{user.full_name ?? '(no name)'}</h2>
              <p className="text-sm text-gray-500">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl font-light">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-6">
          {/* Identity */}
          <Section title="Identity & Status">
            <InfoGrid items={[
              { label: 'User ID',       value: user.id },
              { label: 'Phone',         value: user.phone ?? '—' },
              { label: 'Date of Birth', value: user.dob ?? '—' },
              { label: 'Role',          value: user.role },
              { label: 'Account Status', value: <span>{accountStatusBadge(user.account_status)}</span> },
              { label: 'Registered',    value: new Date(user.registered_at).toLocaleString() },
              { label: 'Last Login',    value: user.last_login_at ? new Date(user.last_login_at).toLocaleString() : '—' },
              { label: 'Email Verified', value: user.email_confirmed_at ? '✅' : '❌' },
              { label: 'Phone Verified', value: user.phone_confirmed_at ? '✅' : '❌' },
            ]} />
            {user.account_status === 'suspended' && user.suspension_reason && (
              <p className="mt-3 text-sm text-orange-700 bg-orange-50 rounded p-3">
                <strong>Suspension reason:</strong> {user.suspension_reason}
                {user.suspended_at && ` (since ${new Date(user.suspended_at).toLocaleDateString()})`}
              </p>
            )}
          </Section>

          {/* Subscription */}
          <Section title="Subscription">
            {subscription ? (
              <InfoGrid items={[
                { label: 'Status',       value: subscriptionBadge(subscription.status) },
                { label: 'Started',      value: new Date(subscription.created_at).toLocaleDateString() },
                { label: 'Trial Ends',   value: subscription.trial_ends_at ? new Date(subscription.trial_ends_at).toLocaleDateString() : '—' },
                { label: 'Period End',   value: subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : '—' },
                { label: 'Cancelled At', value: subscription.cancelled_at ? new Date(subscription.cancelled_at).toLocaleDateString() : '—' },
              ]} />
            ) : (
              <p className="text-sm text-gray-500">No subscription record found (Free user).</p>
            )}
          </Section>

          {/* SP Wallet */}
          <Section title="Swap Points Wallet">
            {sp_wallet ? (
              <InfoGrid items={[
                { label: 'Balance',        value: sp_wallet.balance.toLocaleString() + ' SP' },
                { label: 'Wallet Status',  value: sp_wallet.status },
                { label: 'Lifetime Earned', value: sp_wallet.lifetime_earned.toLocaleString() + ' SP' },
                { label: 'Lifetime Spent', value: sp_wallet.lifetime_spent.toLocaleString() + ' SP' },
              ]} />
            ) : (
              <p className="text-sm text-gray-500">No SP wallet found.</p>
            )}
          </Section>

          {/* Trades */}
          <Section title="Trade Activity">
            <InfoGrid items={[
              { label: 'Completed Trades', value: trades.total_completed },
              { label: 'As Seller',        value: trades.total_as_seller },
              { label: 'As Buyer',         value: trades.total_as_buyer },
              { label: 'Last Trade',       value: trades.last_trade_at ? new Date(trades.last_trade_at).toLocaleDateString() : '—' },
            ]} />
          </Section>

          {/* Badges */}
          <Section title={`Badges (${badges.total})`}>
            {badges.badges.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {badges.badges.map((b) => (
                  <span key={b.badge_id} className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded-full text-xs">
                    {b.badge_name}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No badges earned yet.</p>
            )}
          </Section>

          {/* Recent admin log */}
          <Section title="Recent Admin Activity">
            {activity_log.length > 0 ? (
              <ul className="space-y-2 text-sm">
                {activity_log.map((entry) => (
                  <li key={entry.id} className="border rounded p-2 bg-gray-50">
                    <span className="font-medium">{entry.action_type}</span>
                    {' · '}
                    <span className="text-gray-500">{entry.performed_by_email}</span>
                    {' · '}
                    <span className="text-gray-400">{new Date(entry.created_at).toLocaleString()}</span>
                    {entry.notes && <p className="text-gray-600 mt-0.5 italic">"{entry.notes}"</p>}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500">No admin actions recorded for this user.</p>
            )}
          </Section>

          {/* Admin Actions */}
          <Section title="Admin Actions">
            <div className="mb-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Reason (required for suspend / unsuspend / delete)
              </label>
              <textarea
                value={reasonInput}
                onChange={(e) => setReasonInput(e.target.value)}
                rows={2}
                placeholder="Enter a reason for this admin action…"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {user.account_status === 'active' ? (
                <ActionButton
                  label="Suspend User"
                  color="bg-orange-500 hover:bg-orange-600"
                  disabled={actionLoading}
                  onClick={handleSuspend}
                />
              ) : (
                <ActionButton
                  label="Unsuspend User"
                  color="bg-green-600 hover:bg-green-700"
                  disabled={actionLoading}
                  onClick={handleUnsuspend}
                />
              )}
              <ActionButton
                label="Send Password Reset"
                color="bg-blue-500 hover:bg-blue-600"
                disabled={actionLoading}
                onClick={handlePasswordReset}
              />
              <ActionButton
                label="Delete Account"
                color="bg-red-600 hover:bg-red-700"
                disabled={actionLoading}
                onClick={handleDelete}
              />
            </div>
          </Section>
        </div>
      </div>
    </div>
  );
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div>
    <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-2 border-b pb-1">{title}</h3>
    {children}
  </div>
);

const InfoGrid: React.FC<{ items: { label: string; value: React.ReactNode }[] }> = ({ items }) => (
  <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-4 gap-y-2">
    {items.map(({ label, value }) => (
      <div key={label}>
        <dt className="text-xs text-gray-500">{label}</dt>
        <dd className="text-sm font-medium text-gray-900 mt-0.5">{value}</dd>
      </div>
    ))}
  </dl>
);

const ActionButton: React.FC<{
  label: string;
  color: string;
  disabled: boolean;
  onClick: () => void;
}> = ({ label, color, disabled, onClick }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className={`${color} text-white text-sm px-4 py-2 rounded-md disabled:opacity-50 transition-colors`}
  >
    {label}
  </button>
);

// ─── Page entry ──────────────────────────────────────────────────────────────

export default function UsersPage() {
  const [analytics, setAnalytics] = useState<UserAnalytics | null>(null);
  const [listResult, setListResult] = useState<AdminUserListResult | null>(null);
  const [filters, setFilters] = useState<UserListFilters>({ page: 1, page_size: 20 });
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [analyticsData, listData] = await Promise.all([
        AdminUserManagementService.getAnalytics(),
        AdminUserManagementService.listUsers(filters),
      ]);
      setAnalytics(analyticsData);
      setListResult(listData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, [filters]);

  useEffect(() => { loadData(); }, [loadData]);

  if (error) return <div className="p-8 text-red-600">Error: {error}</div>;

  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">User Management</h1>

      {analytics && (
        <>
          <UserAnalyticsHeader analytics={analytics} />
          <SubscriptionBreakdown bySubscription={analytics.by_subscription} />
        </>
      )}

      <div className="bg-white rounded-xl shadow p-5">
        <FilterBar filters={filters} onChange={setFilters} />

        {isLoading ? (
          <div className="py-12 text-center text-gray-500">Loading users…</div>
        ) : listResult && listResult.users.length > 0 ? (
          <>
            <UserTable
              users={listResult.users}
              onSelectUser={(u) => setSelectedUserId(u.id)}
            />
            <Pagination
              page={listResult.page}
              totalPages={listResult.total_pages}
              total={listResult.total}
              pageSize={listResult.page_size}
              onChange={(p) => setFilters((f) => ({ ...f, page: p }))}
            />
          </>
        ) : (
          <div className="py-12 text-center text-gray-500">No users match the current filters.</div>
        )}
      </div>

      {selectedUserId && (
        <UserDetailPanel
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
          onRefresh={loadData}
        />
      )}
    </div>
  );
}
```

### Testing Checklist
- [ ] User analytics counts match raw DB counts (total, active, suspended, new this month)
- [ ] Subscription breakdown totals match subscription dashboard counts
- [ ] DAU / MAU derived from `auth.users.last_sign_in_at` correctly
- [ ] User table search matches on full_name, email, and phone (case-insensitive)
- [ ] Filtering by account_status returns only matching records
- [ ] Filtering by subscription_status includes 'none' (no subscription row)
- [ ] Pagination returns correct page size and total count
- [ ] User detail panel shows all sections: identity, subscription, SP, trades, badges, admin log
- [ ] Suspend action sets `account_status = 'suspended'` and logs in `admin_activity_log`
- [ ] Unsuspend action sets `account_status = 'active'` and clears suspension columns
- [ ] Delete action sets `deleted_at`, freezes SP wallet, and logs in `admin_activity_log`
- [ ] Password reset Edge Function rejects non-admin callers with 403
- [ ] Password reset Edge Function sends email and logs admin action
- [ ] Admin cannot delete their own account via the RPC
- [ ] Deleted users are excluded from the user list
- [ ] Non-admin callers receive EXCEPTION from all user-management RPCs

### Deployment Notes
1. Run `supabase db reset` locally and confirm migration `125_admin_user_management.sql` applies cleanly.
2. Deploy Edge Function: `supabase functions deploy admin-trigger-password-reset`.
3. Set `SUPABASE_SERVICE_ROLE_KEY` secret in Supabase dashboard for the Edge Function.
4. Add nav link to `/users` in admin sidebar (e.g., `AdminNav.tsx`).
5. Confirm `auth.users` is accessible from `SECURITY DEFINER` function context — if not, use service-role Edge Function for `last_sign_in_at`.
6. `// TODO(UX): refine user table column ordering and card layout once Figma design is available`
7. `// TODO(PERF): add DB indexes on sp_wallets(user_id) and transactions(seller_id, buyer_id, status) if not already present`

---

## TASK ADMIN-V2-007: Admin Panel UI Theme & Layout Redesign

**Duration:** 4 hours  
**Priority:** High  
**Dependencies:** ADMIN-V2-001 through ADMIN-V2-006 (feature pages must exist before styling them)  
**Target App:** `p2p-kids-admin/` (Next.js)  
**Design Reference:** Screenshot — CalmUI-style dashboard with deep purple sidebar, white topbar, light lavender content background, white metric cards, chart cards.

---

### Overview

Redesign the entire admin panel visual layer to match the provided reference design. The layout consists of:
- **Fixed left sidebar** (deep purple, collapsible) with icon + label navigation
- **Fixed top navbar** (white) with search, brand logo, notification bell, user profile
- **Scrollable main content** on a light lavender/gray background
- **Metric cards** (white, subtle shadow) with colored icons, large numbers, and trend labels
- **Chart cards** (white, subtle shadow) wrapping Recharts components
- **Consistent design tokens** enforced via Tailwind extended config + CSS variables

This task covers **only presentation and layout** — no business logic or DB changes.

---

### Design Tokens (Source of Truth)

All values below must be implemented as both **Tailwind config extensions** and **CSS custom properties** so they can be used interchangeably in Tailwind classes and in inline JSX `style={}` props.

```
Color palette:
  sidebar-bg:       #3D1073   (deep purple — sidebar background)
  sidebar-active:   #5A2D9C   (lighter purple — active/hover nav item)
  sidebar-text:     #FFFFFF   (sidebar text + icons)
  sidebar-muted:    #C4A8E8   (muted sidebar label)

  topbar-bg:        #FFFFFF   (top navbar background)
  topbar-border:    #F0EDF9   (bottom border of topbar)

  brand-primary:    #6C3CE1   (primary purple — buttons, badges, charts)
  brand-accent:     #FF6B35   (orange accent — icons, highlights, charts)
  brand-green:      #28A745   (positive trend labels)
  brand-blue:       #17A2B8   (neutral/online trend labels)

  content-bg:       #F2F0FB   (main content area background)
  card-bg:          #FFFFFF   (all metric and chart cards)
  card-border:      #F0EDF9   (card border, very subtle)

  text-primary:     #2D2D4E   (page headings, large numbers)
  text-secondary:   #6B6B8F   (subtext, labels)
  text-muted:       #9B97B5   (timestamps, placeholders)

Typography:
  font-sans:        'Inter', system-ui, sans-serif
  heading-xl:       2rem / 700   (metric numbers like "45679")
  heading-lg:       1.25rem / 600
  heading-md:       1rem / 600
  body-sm:          0.875rem / 400
  label:            0.75rem / 500 uppercase tracking-wide

Spacing scale (used consistently):
  card-padding:     p-6 (24px)
  section-gap:      gap-6 (24px)
  sidebar-width:    256px (w-64)
  topbar-height:    64px (h-16)

Shadows:
  card-shadow:      0 1px 3px rgba(109, 60, 225, 0.06), 0 4px 16px rgba(109, 60, 225, 0.04)
  sidebar-shadow:   2px 0 8px rgba(61, 16, 115, 0.12)
```

---

### File 1: `tailwind.config.js` (update — extend colors + fontFamily)

```javascript
// File: p2p-kids-admin/tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        sidebar: {
          bg:     '#3D1073',
          active: '#5A2D9C',
          text:   '#FFFFFF',
          muted:  '#C4A8E8',
        },
        brand: {
          primary: '#6C3CE1',
          accent:  '#FF6B35',
          green:   '#28A745',
          blue:    '#17A2B8',
        },
        content: {
          bg: '#F2F0FB',
        },
        card: {
          bg:     '#FFFFFF',
          border: '#F0EDF9',
        },
        text: {
          primary:   '#2D2D4E',
          secondary: '#6B6B8F',
          muted:     '#9B97B5',
        },
        topbar: {
          bg:     '#FFFFFF',
          border: '#F0EDF9',
        },
      },
      boxShadow: {
        card: '0 1px 3px rgba(109, 60, 225, 0.06), 0 4px 16px rgba(109, 60, 225, 0.04)',
        sidebar: '2px 0 8px rgba(61, 16, 115, 0.12)',
      },
      width: {
        sidebar: '256px',
      },
      height: {
        topbar: '64px',
      },
    },
  },
  plugins: [],
};
```

---

### File 2: `src/app/globals.css` (update — CSS variables + base resets)

```css
/* File: p2p-kids-admin/src/app/globals.css */
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  /* Sidebar */
  --sidebar-bg:       #3D1073;
  --sidebar-active:   #5A2D9C;
  --sidebar-text:     #FFFFFF;
  --sidebar-muted:    #C4A8E8;
  --sidebar-width:    256px;

  /* Topbar */
  --topbar-bg:        #FFFFFF;
  --topbar-border:    #F0EDF9;
  --topbar-height:    64px;

  /* Brand */
  --brand-primary:    #6C3CE1;
  --brand-accent:     #FF6B35;
  --brand-green:      #28A745;
  --brand-blue:       #17A2B8;

  /* Content */
  --content-bg:       #F2F0FB;

  /* Cards */
  --card-bg:          #FFFFFF;
  --card-border:      #F0EDF9;
  --card-shadow:      0 1px 3px rgba(109, 60, 225, 0.06), 0 4px 16px rgba(109, 60, 225, 0.04);

  /* Text */
  --text-primary:     #2D2D4E;
  --text-secondary:   #6B6B8F;
  --text-muted:       #9B97B5;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

html,
body {
  height: 100%;
  font-family: 'Inter', system-ui, sans-serif;
  background-color: var(--content-bg);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
}

/* Scrollbar styling (sidebar + main content) */
::-webkit-scrollbar {
  width: 4px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: var(--sidebar-muted);
  border-radius: 999px;
}

/* Sidebar transition */
.sidebar-collapsed {
  width: 64px !important;
}
.sidebar-collapsed .nav-label,
.sidebar-collapsed .nav-arrow,
.sidebar-collapsed .sidebar-brand-text {
  display: none;
}
```

---

### File 3: `src/styles/theme.ts` (create — TypeScript design tokens)

```typescript
// File: p2p-kids-admin/src/styles/theme.ts
// Single source of truth for design tokens.
// Use Tailwind classes first; use these when inline styles are needed.

export const theme = {
  colors: {
    sidebar: {
      bg:     '#3D1073',
      active: '#5A2D9C',
      text:   '#FFFFFF',
      muted:  '#C4A8E8',
    },
    brand: {
      primary: '#6C3CE1',
      accent:  '#FF6B35',
      green:   '#28A745',
      blue:    '#17A2B8',
    },
    content: {
      bg: '#F2F0FB',
    },
    card: {
      bg:     '#FFFFFF',
      border: '#F0EDF9',
    },
    text: {
      primary:   '#2D2D4E',
      secondary: '#6B6B8F',
      muted:     '#9B97B5',
    },
    topbar: {
      bg:     '#FFFFFF',
      border: '#F0EDF9',
    },
  },

  spacing: {
    sidebarWidth:  '256px',
    topbarHeight:  '64px',
    cardPadding:   '24px',
    sectionGap:    '24px',
  },

  shadow: {
    card:    '0 1px 3px rgba(109, 60, 225, 0.06), 0 4px 16px rgba(109, 60, 225, 0.04)',
    sidebar: '2px 0 8px rgba(61, 16, 115, 0.12)',
  },

  /** Metric card icon colors — maps to icon wrapper bg */
  iconColors: {
    purple: { bg: '#EDE7F6', icon: '#6C3CE1' },
    orange: { bg: '#FFF3EC', icon: '#FF6B35' },
    green:  { bg: '#E8F5E9', icon: '#28A745' },
    blue:   { bg: '#E3F2FD', icon: '#17A2B8' },
  },

  /** Subscription tier badge colors */
  subscriptionColors: {
    trial:        { bg: '#FFF8E1', text: '#F59E0B' },
    active:       { bg: '#E8F5E9', text: '#28A745' },
    grace_period: { bg: '#FFF3EC', text: '#FF6B35' },
    cancelled:    { bg: '#FEEBEE', text: '#E53935' },
    none:         { bg: '#F0EDF9', text: '#9B97B5' },
  },

  /** Account status colors */
  accountStatusColors: {
    active:    { bg: '#E8F5E9', text: '#28A745' },
    suspended: { bg: '#FFF3EC', text: '#FF6B35' },
    banned:    { bg: '#FEEBEE', text: '#E53935' },
  },
} as const;

export type ThemeColor = typeof theme.colors;
export type IconColorKey = keyof typeof theme.iconColors;
```

---

### File 4: `src/components/layout/Sidebar.tsx` (create)

The sidebar must:
- Be fixed to the left, full height
- Have a deep purple background (`var(--sidebar-bg)`)
- Show the app brand name at the top (with optional icon)
- Have a hamburger toggle button that collapses it to icon-only mode (`w-16`)
- Render navigation items, each with an SVG icon + text label
- Highlight the active route with `sidebar-active` background
- Support optional sub-menu arrows on expandable sections (collapsed = no expand)
- All nav items use `next/link` (no `router.push` hardcoding)

```typescript
// File: p2p-kids-admin/src/components/layout/Sidebar.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Coins,
  Award,
  BarChart2,
  MapPin,
  Settings,
  Menu,
  ChevronRight,
} from 'lucide-react';

interface NavItem {
  label:    string;
  href:     string;
  icon:     React.ReactNode;
  /** If true, show a chevron arrow (purely decorative for now) */
  hasSubmenu?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     href: '/',               icon: <LayoutDashboard size={18} /> },
  { label: 'Users',         href: '/users',           icon: <Users          size={18} /> },
  { label: 'Subscriptions', href: '/subscriptions',   icon: <CreditCard     size={18} /> },
  { label: 'SP Wallet',     href: '/sp-wallet',       icon: <Coins          size={18} /> },
  { label: 'Badges',        href: '/badges',          icon: <Award          size={18} /> },
  { label: 'Revenue',       href: '/revenue',         icon: <BarChart2      size={18} /> },
  { label: 'Nodes',         href: '/nodes',           icon: <MapPin         size={18} /> },
  { label: 'Config',        href: '/config',          icon: <Settings       size={18} />, hasSubmenu: true },
];

interface SidebarProps {
  collapsed:    boolean;
  onToggle:     () => void;
}

export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed top-0 left-0 h-screen flex flex-col z-30 transition-all duration-300"
      style={{
        width:      collapsed ? '64px' : 'var(--sidebar-width)',
        background: 'var(--sidebar-bg)',
        boxShadow:  'var(--card-shadow)',
      }}
    >
      {/* Brand header */}
      <div className="flex items-center h-16 px-4 flex-shrink-0 border-b border-white/10">
        <button
          onClick={onToggle}
          aria-label="Toggle sidebar"
          className="flex items-center justify-center w-8 h-8 rounded-md hover:bg-white/10 transition-colors text-white flex-shrink-0"
        >
          <Menu size={20} />
        </button>
        {!collapsed && (
          <div className="ml-3 flex items-center gap-2">
            {/* Brand logo circle — orange/purple gradient matching design */}
            <div className="w-7 h-7 rounded-full flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)' }}
            />
            <span className="nav-label font-semibold text-white text-sm tracking-wide">
              Kids Admin
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors group"
              style={{
                background: isActive ? 'var(--sidebar-active)' : 'transparent',
                color:      'var(--sidebar-text)',
              }}
              title={collapsed ? item.label : undefined}
              onMouseEnter={(e) => {
                if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                if (!isActive) e.currentTarget.style.background = 'transparent';
              }}
            >
              {/* Icon */}
              <span className="flex-shrink-0">{item.icon}</span>

              {/* Label — hidden when collapsed */}
              {!collapsed && (
                <>
                  <span className="nav-label flex-1 text-sm font-medium">{item.label}</span>
                  {item.hasSubmenu && (
                    <ChevronRight size={14} className="nav-arrow opacity-60" />
                  )}
                </>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer spacer */}
      <div className="h-4 flex-shrink-0" />
    </aside>
  );
}
```

---

### File 5: `src/components/layout/TopNavbar.tsx` (create)

The top navbar must:
- Be fixed to the top, spanning the full width minus the sidebar
- Have a white background with a subtle bottom border
- Show a search input on the left (search icon inside input)
- Show the brand name in the center (gradient circle + "Kids Admin")
- Show notification bell (with orange dot indicator) on the right
- Show admin user avatar + name + dropdown arrow
- Show a 3-dot "more" menu icon
- Use `next-auth` session or Supabase `useUser` to show the logged-in admin's name

```typescript
// File: p2p-kids-admin/src/components/layout/TopNavbar.tsx
'use client';

import { useState } from 'react';
import { Bell, Search, MoreHorizontal, ChevronDown } from 'lucide-react';

interface TopNavbarProps {
  /** Pixel offset from left to account for sidebar width */
  sidebarWidth: number;
  adminName?:   string;
  adminAvatar?: string;
}

export function TopNavbar({ sidebarWidth, adminName = 'Admin', adminAvatar }: TopNavbarProps) {
  const [searchValue, setSearchValue] = useState('');

  return (
    <header
      className="fixed top-0 right-0 z-20 flex items-center px-6 gap-4 transition-all duration-300"
      style={{
        left:        `${sidebarWidth}px`,
        height:      'var(--topbar-height)',
        background:  'var(--topbar-bg)',
        borderBottom: '1px solid var(--topbar-border)',
      }}
    >
      {/* Search */}
      <div className="relative flex-shrink-0">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2"
          style={{ color: 'var(--text-muted)' }}
        />
        <input
          type="text"
          placeholder="Search…"
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          className="pl-9 pr-4 py-2 rounded-full text-sm outline-none transition-shadow"
          style={{
            width:      '220px',
            background: 'var(--content-bg)',
            border:     '1px solid var(--card-border)',
            color:      'var(--text-primary)',
          }}
          // TODO(UX): wire to global search across users/subscriptions/badges
        />
      </div>

      {/* Spacer → push brand to center */}
      <div className="flex-1" />

      {/* Brand logo (center) */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <div
          className="w-7 h-7 rounded-full"
          style={{ background: 'linear-gradient(135deg, var(--brand-primary) 0%, var(--brand-accent) 100%)' }}
        />
        <span className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
          Kids<span style={{ color: 'var(--brand-primary)' }}>Admin</span>
        </span>
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Right actions */}
      <div className="flex items-center gap-3 flex-shrink-0">
        {/* Notification bell with orange dot */}
        <button
          className="relative w-9 h-9 rounded-full flex items-center justify-center hover:bg-content-bg transition-colors"
          style={{ background: 'var(--content-bg)' }}
          aria-label="Notifications"
          // TODO(NOTIF): hook to admin_activity_log unread count
        >
          <Bell size={18} style={{ color: 'var(--text-secondary)' }} />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: 'var(--brand-accent)' }}
          />
        </button>

        {/* User profile pill */}
        <button
          className="flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-content-bg transition-colors"
          style={{ background: 'var(--content-bg)' }}
          aria-label="Admin profile"
          // TODO(AUTH): wire to admin logout / profile dropdown
        >
          {adminAvatar ? (
            <img src={adminAvatar} alt={adminName} className="w-7 h-7 rounded-full object-cover" />
          ) : (
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ background: 'var(--brand-primary)' }}
            >
              {adminName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
            {adminName}
          </span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)' }} />
        </button>

        {/* 3-dot more menu */}
        <button
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-content-bg transition-colors"
          aria-label="More options"
        >
          <MoreHorizontal size={18} style={{ color: 'var(--text-secondary)' }} />
        </button>
      </div>
    </header>
  );
}
```

---

### File 6: `src/app/layout.tsx` (update — wrap content with sidebar + topbar shell)

This is the root layout that renders for every admin page. It:
- Renders `<Sidebar>` (fixed left) and `<TopNavbar>` (fixed top)
- Manages `collapsed` state via `useState`
- Passes dynamic `sidebarWidth` to both components
- Wraps `{children}` in a `<main>` that has left padding = sidebar width and top padding = topbar height
- Sources the logged-in admin's name from Supabase client session (`useUser`) and passes it to `TopNavbar`

```typescript
// File: p2p-kids-admin/src/app/layout.tsx
import type { Metadata } from 'next';
import './globals.css';
import { AdminShell } from '@/components/layout/AdminShell';

export const metadata: Metadata = {
  title:       'Kids Marketplace Admin',
  description: 'Admin panel for Kids P2P Marketplace',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AdminShell>{children}</AdminShell>
      </body>
    </html>
  );
}
```

**Note:** The `AdminShell` is a separate `'use client'` component that owns the collapsed state, because `layout.tsx` must be a Server Component for metadata export. This avoids the "useState in Server Component" error.

```typescript
// File: p2p-kids-admin/src/components/layout/AdminShell.tsx
'use client';

import { useState } from 'react';
import { Sidebar }    from './Sidebar';
import { TopNavbar }  from './TopNavbar';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

const COLLAPSED_WIDTH = 64;
const EXPANDED_WIDTH  = 256;

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const sidebarWidth = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  // TODO(AUTH): replace with proper admin session hook once auth is wired
  const adminName   = 'Admin';
  const adminAvatar = undefined;

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        onToggle={() => setCollapsed((c) => !c)}
      />
      <TopNavbar
        sidebarWidth={sidebarWidth}
        adminName={adminName}
        adminAvatar={adminAvatar}
      />
      <main
        className="min-h-screen transition-all duration-300"
        style={{
          paddingLeft: `${sidebarWidth}px`,
          paddingTop:  'var(--topbar-height)',
          background:  'var(--content-bg)',
        }}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </>
  );
}
```

---

### File 7: `src/components/ui/MetricCard.tsx` (create/update)

Each dashboard section (Users, Revenue, SP, Subscriptions) has a row of metric cards. This component must match the screenshot exactly:
- White card with `card-shadow`
- Colored icon in a soft-tinted rounded square at top-left
- Colored/bold category label beneath the icon
- Large number in `text-primary`
- Small subtitle (trend label or description) in `text-secondary`
- Optional trend indicator (+/- percentage with green/red coloring)

```typescript
// File: p2p-kids-admin/src/components/ui/MetricCard.tsx
import type { IconColorKey } from '@/styles/theme';
import { theme } from '@/styles/theme';

interface MetricCardProps {
  /** Label shown below icon in the card accent color */
  label:        string;
  /** The large primary number/value */
  value:        string | number;
  /** Supporting text below the value */
  subtitle?:    string;
  /** Icon element (Lucide icon or SVG) */
  icon:         React.ReactNode;
  /** Determines icon wrapper background and icon color */
  color:        IconColorKey;
  /** Optional: "+20%" → shown with green; "-2%" → shown with red */
  trend?:       string;
  trendDir?:    'up' | 'down' | 'neutral';
  className?:   string;
}

export function MetricCard({
  label,
  value,
  subtitle,
  icon,
  color,
  trend,
  trendDir = 'neutral',
  className = '',
}: MetricCardProps) {
  const iconStyle = theme.iconColors[color];

  const trendColor =
    trendDir === 'up'   ? theme.colors.brand.green  :
    trendDir === 'down' ? '#E53935'                  :
    theme.colors.text.muted;

  return (
    <div
      className={`rounded-xl p-6 flex flex-col gap-3 ${className}`}
      style={{
        background: theme.colors.card.bg,
        border:     `1px solid ${theme.colors.card.border}`,
        boxShadow:  theme.shadow.card,
      }}
    >
      {/* Icon wrapper */}
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: iconStyle.bg, color: iconStyle.icon }}
      >
        {icon}
      </div>

      {/* Colored label */}
      <span
        className="text-xs font-semibold uppercase tracking-wider"
        style={{ color: iconStyle.icon }}
      >
        {label}
      </span>

      {/* Large value */}
      <span
        className="text-3xl font-bold leading-none"
        style={{ color: theme.colors.text.primary }}
      >
        {value}
      </span>

      {/* Subtitle row */}
      <div className="flex items-center gap-2">
        {trend && (
          <span className="text-sm font-semibold" style={{ color: trendColor }}>
            {trend}
          </span>
        )}
        {subtitle && (
          <span className="text-xs" style={{ color: theme.colors.text.secondary }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
```

---

### File 8: `src/components/ui/ChartCard.tsx` (create)

Wrapper for any chart (Recharts `AreaChart`, `LineChart`, `PieChart`, etc.) that provides:
- White card with shadow, matching MetricCard visual style
- Card header row: title (bold, `text-primary`) + optional period filter dropdown on the right
- Configurable height for the chart content area
- Children rendered inside (caller passes the chart component)

```typescript
// File: p2p-kids-admin/src/components/ui/ChartCard.tsx
'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { theme } from '@/styles/theme';

type Period = 'Today' | 'This week' | 'This month' | 'This year';
const PERIODS: Period[] = ['Today', 'This week', 'This month', 'This year'];

interface ChartCardProps {
  title:             string;
  /** Show a period dropdown next to the title */
  showPeriodFilter?: boolean;
  onPeriodChange?:  (period: Period) => void;
  /** Height of the chart container in px (default 220) */
  chartHeight?:      number;
  children:          React.ReactNode;
  className?:        string;
}

export function ChartCard({
  title,
  showPeriodFilter = false,
  onPeriodChange,
  chartHeight = 220,
  children,
  className = '',
}: ChartCardProps) {
  const [period, setPeriod]   = useState<Period>('This week');
  const [open,   setOpen]     = useState(false);

  function selectPeriod(p: Period) {
    setPeriod(p);
    setOpen(false);
    onPeriodChange?.(p);
  }

  return (
    <div
      className={`rounded-xl p-6 flex flex-col gap-4 ${className}`}
      style={{
        background: theme.colors.card.bg,
        border:     `1px solid ${theme.colors.card.border}`,
        boxShadow:  theme.shadow.card,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold" style={{ color: theme.colors.text.primary }}>
          {title}
        </h3>

        {showPeriodFilter && (
          <div className="relative">
            <button
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:opacity-80"
              style={{
                border:     `1px solid ${theme.colors.card.border}`,
                color:      theme.colors.text.secondary,
                background: theme.colors.content.bg,
              }}
            >
              {period}
              <ChevronDown size={12} />
            </button>

            {open && (
              <ul
                className="absolute right-0 top-8 z-10 rounded-lg overflow-hidden"
                style={{
                  background: theme.colors.card.bg,
                  border:     `1px solid ${theme.colors.card.border}`,
                  boxShadow:  theme.shadow.card,
                  minWidth:   '120px',
                }}
              >
                {PERIODS.map((p) => (
                  <li key={p}>
                    <button
                      onClick={() => selectPeriod(p)}
                      className="w-full text-left px-4 py-2 text-xs transition-colors hover:opacity-80"
                      style={{
                        color:      p === period ? theme.colors.brand.primary : theme.colors.text.secondary,
                        fontWeight: p === period ? 600 : 400,
                        background: p === period ? '#EDE7F6' : 'transparent',
                      }}
                    >
                      {p}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* Chart area */}
      <div style={{ height: `${chartHeight}px` }}>
        {children}
      </div>
    </div>
  );
}
```

---

### File 9: `src/app/page.tsx` (update — Dashboard home page with new components)

The main dashboard (`/`) must show the "at a glance" view matching the screenshot layout:
- **Row 1** (4 metric cards): Total Users, Active Subscriptions, Total Revenue (this month), SP Circulating
- **Row 2** (2 wide + 1 panel): Trade Activity pie/donut chart, Platform Visits line chart, Revenue summary panel with area chart
- All data loaded via the existing admin RPCs (`admin_get_user_analytics`, `get_revenue_metrics`, `get_sp_economy_metrics`)
- Use `Promise.all` for parallel fetches
- Loading skeleton (pulsing gray blocks) while data loads
- Recharts used for all charts (`AreaChart`, `LineChart`, `PieChart` from `recharts`)

```typescript
// File: p2p-kids-admin/src/app/page.tsx
import 'server-only';
import { Suspense }          from 'react';
import { DashboardContent }  from '@/components/dashboard/DashboardContent';
import { DashboardSkeleton } from '@/components/dashboard/DashboardSkeleton';

export default function DashboardPage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <DashboardContent />
    </Suspense>
  );
}
```

```typescript
// File: p2p-kids-admin/src/components/dashboard/DashboardContent.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { Users, CreditCard, TrendingUp, Coins } from 'lucide-react';
import {
  AreaChart, Area, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts';

import { MetricCard } from '@/components/ui/MetricCard';
import { ChartCard  } from '@/components/ui/ChartCard';
import { theme      } from '@/styles/theme';

// ─── Types ───────────────────────────────────────────────────────────────────

interface DashboardMetrics {
  totalUsers:           number;
  activeSubscriptions:  number;
  revenueThisMonth:     number;
  spCirculating:        number;
  userTrend:            string;   // e.g. "+1900"
  subTrend:             string;   // e.g. "+12%"
  revenueTrend:         string;   // e.g. "+40%"
  spTrend:              string;   // e.g. "+23.6%"
  tradesBreakdown: Array<{ name: string; value: number; color: string }>;
  revenueTimeSeries:    Array<{ label: string; subscription: number; fees: number }>;
  visitTimeSeries:      Array<{ label: string; visits: number }>;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(n: number): string {
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function DashboardContent() {
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // TODO(API): replace with actual parallel RPC calls:
      //   admin_get_user_analytics, get_revenue_metrics, get_sp_economy_metrics
      // Placeholder stub data shown for UI completeness:
      const stub: DashboardMetrics = {
        totalUsers:          45679,
        activeSubscriptions: 80927,
        revenueThisMonth:    36568,
        spCirculating:       124300,
        userTrend:           '+1,900',
        subTrend:            '+60%',
        revenueTrend:        '+40%',
        spTrend:             '+23.6%',
        tradesBreakdown: [
          { name: 'Completed',  value: 542,  color: theme.colors.brand.primary },
          { name: 'Pending',    value: 211,  color: theme.colors.brand.accent  },
          { name: 'Cancelled',  value: 88,   color: '#C4A8E8' },
          { name: 'Disputed',   value: 34,   color: '#E0DCF0' },
        ],
        revenueTimeSeries: [
          { label: 'Mon', subscription: 900,  fees: 400  },
          { label: 'Tue', subscription: 1200, fees: 600  },
          { label: 'Wed', subscription: 800,  fees: 350  },
          { label: 'Thu', subscription: 1500, fees: 750  },
          { label: 'Fri', subscription: 1300, fees: 520  },
          { label: 'Sat', subscription: 700,  fees: 280  },
          { label: 'Sun', subscription: 1100, fees: 490  },
        ],
        visitTimeSeries: [
          { label: 'Mon', visits: 320 },
          { label: 'Tue', visits: 580 },
          { label: 'Wed', visits: 410 },
          { label: 'Thu', visits: 700 },
          { label: 'Fri', visits: 490 },
          { label: 'Sat', visits: 380 },
          { label: 'Sun', visits: 460 },
        ],
      };
      setMetrics(stub);
    } catch (err) {
      console.error('[DashboardContent] load error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading || !metrics) return <DashboardLoadingSkeleton />;

  return (
    <div className="flex flex-col gap-6">

      {/* ── Row 1: Metric cards ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        <MetricCard
          label="Total Users"
          value={metrics.totalUsers.toLocaleString()}
          subtitle="Steady growth"
          icon={<Users size={20} />}
          color="purple"
          trend={metrics.userTrend}
          trendDir="up"
        />
        <MetricCard
          label="Subscriptions"
          value={metrics.activeSubscriptions.toLocaleString()}
          icon={<CreditCard size={20} />}
          color="orange"
          trend={metrics.subTrend}
          trendDir="up"
        />
        <MetricCard
          label="Revenue"
          value={formatCurrency(metrics.revenueThisMonth)}
          subtitle="This month"
          icon={<TrendingUp size={20} />}
          color="green"
          trend={metrics.revenueTrend}
          trendDir="up"
        />
        <MetricCard
          label="SP Circulating"
          value={metrics.spCirculating.toLocaleString()}
          subtitle="Swap Points"
          icon={<Coins size={20} />}
          color="blue"
          trend={metrics.spTrend}
          trendDir="up"
        />
      </div>

      {/* ── Row 2: Charts ───────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Trade breakdown — donut/pie chart */}
        <ChartCard title="Trade Categories" chartHeight={240}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={metrics.tradesBreakdown}
                dataKey="value"
                nameKey="name"
                cx="40%"
                cy="50%"
                innerRadius={55}
                outerRadius={90}
                paddingAngle={3}
              >
                {metrics.tradesBreakdown.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: theme.colors.card.bg, border: `1px solid ${theme.colors.card.border}`, borderRadius: '8px', fontSize: '12px' }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {metrics.tradesBreakdown.map((item) => (
              <div key={item.name} className="flex items-center gap-1.5 text-xs" style={{ color: theme.colors.text.secondary }}>
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: item.color }} />
                {item.name}
              </div>
            ))}
          </div>
        </ChartCard>

        {/* Platform visits — line chart */}
        <ChartCard title="Platform Visits" showPeriodFilter chartHeight={200}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={metrics.visitTimeSeries} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="label"
                tick={{ fill: theme.colors.text.muted, fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fill: theme.colors.text.muted, fontSize: 11 }}
                axisLine={false} tickLine={false}
              />
              <Tooltip
                contentStyle={{ background: theme.colors.card.bg, border: `1px solid ${theme.colors.card.border}`, borderRadius: '8px', fontSize: '12px' }}
              />
              <Line
                type="monotone"
                dataKey="visits"
                stroke={theme.colors.brand.primary}
                strokeWidth={2.5}
                dot={{ r: 4, fill: theme.colors.brand.accent, strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Revenue area chart */}
        <ChartCard title="Revenue" showPeriodFilter chartHeight={200}>
          {/* Revenue summary stats */}
          <div className="mb-2">
            <div className="text-2xl font-bold" style={{ color: theme.colors.text.primary }}>
              {formatCurrency(metrics.revenueThisMonth)}
            </div>
            <div className="text-xs" style={{ color: theme.colors.text.secondary }}>Total revenue</div>
            <div className="flex gap-4 mt-2">
              <span className="text-xs font-semibold" style={{ color: theme.colors.brand.green  }}>{metrics.revenueTrend} Growth</span>
              <span className="text-xs font-semibold" style={{ color: theme.colors.brand.accent }}>2.5% Refund</span>
              <span className="text-xs font-semibold" style={{ color: theme.colors.brand.blue   }}>+23.6% Online</span>
            </div>
          </div>

          <ResponsiveContainer width="100%" height="120">
            <AreaChart data={metrics.revenueTimeSeries} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
              <defs>
                <linearGradient id="gradSub" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.colors.brand.primary} stopOpacity={0.4} />
                  <stop offset="95%" stopColor={theme.colors.brand.primary} stopOpacity={0.05} />
                </linearGradient>
                <linearGradient id="gradFees" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={theme.colors.brand.accent} stopOpacity={0.5} />
                  <stop offset="95%" stopColor={theme.colors.brand.accent} stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" hide />
              <YAxis hide />
              <Tooltip
                contentStyle={{ background: theme.colors.card.bg, border: `1px solid ${theme.colors.card.border}`, borderRadius: '8px', fontSize: '12px' }}
              />
              <Area type="monotone" dataKey="subscription" stroke={theme.colors.brand.primary} fill="url(#gradSub)"  strokeWidth={2} stackId="1" />
              <Area type="monotone" dataKey="fees"         stroke={theme.colors.brand.accent}  fill="url(#gradFees)" strokeWidth={2} stackId="1" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DashboardLoadingSkeleton() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-36 rounded-xl" style={{ background: '#EDE7F6' }} />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-72 rounded-xl" style={{ background: '#EDE7F6' }} />
        ))}
      </div>
    </div>
  );
}
```

*(The `DashboardSkeleton` server component referenced in `page.tsx` can be a re-export of `DashboardLoadingSkeleton` or a matching static placeholder.)*

---

### Package Dependencies

Ensure these packages are installed in `p2p-kids-admin/`:

```bash
# Chart library (already likely present — verify)
yarn add recharts

# Icon library (already likely present — verify)
yarn add lucide-react

# Supabase auth helpers for Next.js (already present — verify)
yarn add @supabase/auth-helpers-nextjs
```

Verify in `p2p-kids-admin/package.json`:
```json
{
  "dependencies": {
    "recharts":                     "^2.x",
    "lucide-react":                 "^0.x",
    "@supabase/auth-helpers-nextjs": "^0.x"
  }
}
```

If any are missing, add them before running the UI.

---

### Testing Checklist
- [ ] Sidebar renders with deep purple background (`#3D1073`) — visually verify
- [ ] Sidebar collapses to icon-only when hamburger is clicked
- [ ] Active route is visually highlighted in the sidebar (`#5A2D9C`)
- [ ] Sidebar hover state shows subtle white overlay
- [ ] All nav links navigate to correct routes without a full page reload
- [ ] Top navbar is fixed and does not scroll with content
- [ ] Top navbar shows search input, brand name, notification bell (with orange dot), admin name
- [ ] Content area background is light lavender (`#F2F0FB`)
- [ ] Metric cards have white background, `card-shadow`, rounded corners
- [ ] Metric card icons have soft-tinted backgrounds (muted purple/orange/green/blue)
- [ ] MetricCard trend colors: green for positive, red for negative
- [ ] ChartCard period filter dropdown opens and closes cleanly
- [ ] Donut/pie chart renders with correct color segments and legend
- [ ] Line chart renders platform visits data with orange dots on brand-primary line
- [ ] Area chart stacks subscription + fee revenue with gradient fills
- [ ] Loading skeleton shows pulsing placeholder blocks while data loads
- [ ] No layout shift when sidebar collapses/expands
- [ ] Sidebar collapsed width is exactly 64px; expanded is 256px
- [ ] Main content left-padding transitions smoothly with sidebar width change
- [ ] Design is responsive: on small screens, sidebar collapses by default
- [ ] Tailwind config `brand`, `sidebar`, `content`, `card`, `text`, `topbar` color keys are usable in all pages
- [ ] CSS custom properties (`--sidebar-bg`, `--brand-primary`, etc.) are available globally
- [ ] No TypeScript compile errors (`yarn typecheck` passes)
- [ ] No ESLint errors (`yarn lint` passes)

### Deployment Notes
1. Run `yarn lint && yarn typecheck` (or `npx tsc --noEmit`) in `p2p-kids-admin/` — must pass before any manual testing.
2. Run `yarn build` in `p2p-kids-admin/` to confirm Next.js SSR/SSG compile succeeds before deploying.
3. Verify Google Fonts (`Inter`) is loading — or swap to `next/font/google` for self-hosted font to avoid CORS/CSP issues.
4. Confirm `recharts` and `lucide-react` are in `package.json` (not just `devDependencies`).
5. Remove any existing hardcoded color values (e.g., `bg-gray-100`, `text-gray-700`) from pre-existing admin pages — replace with new design tokens.
6. `// TODO(UX): Apply MetricCard and ChartCard components to all existing feature pages (users, subscriptions, sp-wallet, badges, revenue) once base layout is confirmed`
7. `// TODO(RESP): Add mobile-responsive sidebar drawer (slide-in overlay) for screens < 768px`
8. `// TODO(A11Y): Ensure keyboard focus styles are visible against the purple sidebar background`
9. `// TODO(THEME): Consider adding a light/dark mode toggle using CSS custom property overrides`

---

## MODULE SUMMARY

### Total Tasks: 7
1. **ADMIN-V2-001**: Admin role schema & authentication ✅
2. **ADMIN-V2-002**: Subscription management dashboard ✅
3. **ADMIN-V2-003**: SP wallet admin operations ✅
4. **ADMIN-V2-004**: Badge administration ✅
5. **ADMIN-V2-005**: Revenue & analytics dashboard ✅
6. **ADMIN-V2-006**: User management dashboard ✅
7. **ADMIN-V2-007**: Admin panel UI theme & layout redesign ✅

### Key Features Delivered
- **Admin Authentication**: Role-based access control with activity logging
- **Subscription Management**: Manual trial extension, cancellation, refund processing
- **SP Wallet Operations**: Manual adjustments, wallet freeze/unfreeze, economy metrics
- **Badge Administration**: Manual award/revoke, distribution analytics, rarity tracking
- **Revenue Dashboard**: MRR/ARR, transaction fees, ARPU, DAU/MAU with cohort analysis
- **User Management**: Paginated user directory with search/filter, full detail panel, suspend/unsuspend/delete, password reset trigger, and user analytics (total, active, suspended, new this month, DAU/MAU, by-subscription breakdown)
- **UI Theme & Layout**: Deep purple collapsible sidebar, white fixed topbar, light lavender content background, MetricCard and ChartCard design system, Recharts integration, full design token system (Tailwind config + CSS custom properties)

### Cross-Module Integration
- **MODULE-11 (Subscriptions)**: Admin can extend trial, cancel, view analytics; user detail shows subscription status
- **MODULE-09 (Swap Points)**: Admin can adjust wallets, view economy metrics; user detail shows SP balance and wallet status
- **MODULE-08 (Badges)**: Admin can award/revoke, view distribution; user detail shows all earned badges
- **MODULE-06 (Trade Flow)**: Transaction fee revenue tracking; user detail shows trade counts (as buyer/seller)
- **MODULE-03 (Authentication)**: Admin role verification for all operations; user management uses `auth.users.last_sign_in_at` for last login tracking

### Security Considerations
- All admin RPCs verify role before execution
- All admin actions logged in admin_activity_log
- Soft delete for badge revocations and user deletions (audit trail preserved)
- Admin metadata stored in ledger/badge entries
- Separate admin authentication flow from mobile app
- Password reset Edge Function uses service role key only after verifying caller is admin via JWT + DB role check
- Admin self-delete is explicitly blocked at the RPC level
- Mandatory reason required for suspend, unsuspend, and delete actions

### Performance Notes
- Badge distribution query optimized with GROUP BY
- Revenue metrics use COALESCE for null handling
- Admin activity log indexed by admin_id, entity_type, created_at
- SP wallet queries indexed by user_id and status
- User list query uses correlated subquery to join only the latest subscription per user; add index on `subscriptions(user_id, created_at DESC)` if volume is high
- `admin_list_users` runs a dual-pass (COUNT + paginated SELECT); consider materialized view for very large user bases

### Next Steps
1. Implement time-series charts for revenue trends
2. Add CSV export functionality for all analytics dashboards (users, subscriptions, revenue)
3. Create admin notification system for critical events
4. Build scheduled reports (weekly/monthly) via email
5. Add bulk admin actions to user table (e.g., bulk suspend selected users)
6. Add node/location column and filter to user management table once node assignment is fully wired

