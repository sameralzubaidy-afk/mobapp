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

## MODULE SUMMARY

### Total Tasks: 5
1. **ADMIN-V2-001**: Admin role schema & authentication ✅
2. **ADMIN-V2-002**: Subscription management dashboard ✅
3. **ADMIN-V2-003**: SP wallet admin operations ✅
4. **ADMIN-V2-004**: Badge administration ✅
5. **ADMIN-V2-005**: Revenue & analytics dashboard ✅

### Key Features Delivered
- **Admin Authentication**: Role-based access control with activity logging
- **Subscription Management**: Manual trial extension, cancellation, refund processing
- **SP Wallet Operations**: Manual adjustments, wallet freeze/unfreeze, economy metrics
- **Badge Administration**: Manual award/revoke, distribution analytics, rarity tracking
- **Revenue Dashboard**: MRR/ARR, transaction fees, ARPU, DAU/MAU with cohort analysis

### Cross-Module Integration
- **MODULE-11 (Subscriptions)**: Admin can extend trial, cancel, view analytics
- **MODULE-09 (Swap Points)**: Admin can adjust wallets, view economy metrics
- **MODULE-08 (Badges)**: Admin can award/revoke, view distribution
- **MODULE-06 (Trade Flow)**: Transaction fee revenue tracking
- **MODULE-03 (Authentication)**: Admin role verification for all operations

### Security Considerations
- All admin RPCs verify role before execution
- All admin actions logged in admin_activity_log
- Soft delete for badge revocations (audit trail preserved)
- Admin metadata stored in ledger/badge entries
- Separate admin authentication flow from mobile app

### Performance Notes
- Badge distribution query optimized with GROUP BY
- Revenue metrics use COALESCE for null handling
- Admin activity log indexed by admin_id, entity_type, created_at
- SP wallet queries indexed by user_id and status

### Next Steps
1. Implement time-series charts for revenue trends
2. Add CSV export functionality for analytics
3. Create admin notification system for critical events
4. Build scheduled reports (weekly/monthly) via email

