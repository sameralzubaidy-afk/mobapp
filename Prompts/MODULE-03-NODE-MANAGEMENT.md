---

## Prompt Addendum: Authorization Matrix + RLS Examples

### AI Prompt for Cursor (AuthZ & RLS)
```typescript
/*
TASK: Define granular role matrix and implement RLS examples for trades/messages/items

REQUIREMENTS:
1. Role matrix: admin, moderator, user; actions per table (select/insert/update/delete)
2. RLS examples: enforce owner-only access for children, trades (buyer/seller only), messages (participants only), items (owner only)
3. Admin impersonation safeguards: log impersonation events; require 2FA; prohibit write operations while impersonating unless explicitly elevated.
4. Audit log: all admin actions recorded with entity_type, entity_id, changes.

FILES:
- supabase/migrations/rls_examples.sql (policies for children, trades, messages, items)
- admin/app/audit/page.tsx (audit log viewer)
*/
```

### Acceptance Criteria
- Role matrix documented and linked from admin panel
- RLS policies created and enabled for listed tables
- Admin impersonation requires 2FA and logs events
- Audit log shows admin actions with diffs

# Module 03: Node Management

**Module:** Geographic Node Management  
**Total Tasks:** 7  
**Estimated Duration:** ~15.5 hours (~2 weeks part-time)  
**Dependencies:** MODULE-01 (Infrastructure), MODULE-02 (Authentication)

---

### Agent-Optimized Prompt Template (Claude Sonnet 4.5)

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

## Overview

This module implements geographic node management for the P2P Kids Marketplace. Nodes are geographic areas (cities/neighborhoods) where users can trade items. Each user is automatically assigned to their nearest node based on ZIP code. Admins can create, edit, and configure nodes via admin panel.

### Key Features
- Admin UI for node creation and management
- Automatic node assignment based on user location
- Node activation/deactivation controls
- Configurable node settings (radius, default filters)
- Initial node seeding (Norwalk CT, Little Falls NJ)
- Node-specific item filtering
- Distance radius filters (10 miles default)

---

## TASK NODE-001: Create Admin UI to Add/Edit Nodes

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** INFRA-002 (Supabase), INFRA-003 (Database schema)

### Description
Create admin panel UI to add new geographic nodes and edit existing ones. Fields: name, city, state, ZIP code, latitude/longitude, radius, description.

---

### AI Prompt for Cursor (Generate Node Management Admin UI)

```typescript
/*
TASK: Create admin UI for node management

CONTEXT:
Admins need to create and manage geographic nodes (cities/neighborhoods) where users can trade.
Each node has a name, location (city, state, ZIP, lat/lng), radius, and status.

REQUIREMENTS:
1. Create nodes list page with add/edit actions
2. Create node form with all fields
3. Validate ZIP code and auto-populate lat/lng
4. Save node to database
5. Support editing existing nodes
6. Track admin actions in audit log

==================================================
FILE 1: admin/app/nodes/page.tsx
==================================================
*/

// filepath: admin/app/nodes/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Node {
  id: string;
  name: string;
  city: string;
  state: string;
  zip_code: string;
  latitude: number;
  longitude: number;
  radius_miles: number;
  description?: string;
  is_active: boolean;
  member_count: number;
  created_at: string;
}

export default function NodesPage() {
  const supabase = createClient();
  const [nodes, setNodes] = useState<Node[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingNode, setEditingNode] = useState<Node | null>(null);

  useEffect(() => {
    loadNodes();
  }, []);

  const loadNodes = async () => {
    try {
      const { data, error } = await supabase
        .from('geographic_nodes')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setNodes(data || []);
    } catch (error) {
      console.error('Failed to load nodes:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (node: Node) => {
    setEditingNode(node);
    setShowForm(true);
  };

  const handleAdd = () => {
    setEditingNode(null);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingNode(null);
    loadNodes();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading nodes...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Geographic Nodes</h1>
          <p className="text-gray-600 mt-1">
            Manage trading areas and node assignments
          </p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
        >
          + Add Node
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm">Total Nodes</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {nodes.length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm">Active Nodes</div>
          <div className="text-3xl font-bold text-green-600 mt-1">
            {nodes.filter((n) => n.is_active).length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-gray-600 text-sm">Total Members</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {nodes.reduce((sum, n) => sum + n.member_count, 0)}
          </div>
        </div>
      </div>

      {/* Nodes Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Node Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Coordinates
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Radius
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Members
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {nodes.map((node) => (
              <tr key={node.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm font-medium text-gray-900">
                    {node.name}
                  </div>
                  {node.description && (
                    <div className="text-sm text-gray-500">
                      {node.description}
                    </div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {node.city}, {node.state}
                  </div>
                  <div className="text-sm text-gray-500">{node.zip_code}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {node.latitude.toFixed(4)}, {node.longitude.toFixed(4)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {node.radius_miles} mi
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {node.member_count}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                      node.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {node.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <button
                    onClick={() => handleEdit(node)}
                    className="text-blue-600 hover:text-blue-900 mr-3"
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {nodes.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No nodes found. Click "Add Node" to create your first node.
          </div>
        )}
      </div>

      {/* Node Form Modal */}
      {showForm && (
        <NodeFormModal
          node={editingNode}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}

/*
==================================================
FILE 2: admin/app/nodes/NodeFormModal.tsx
==================================================
*/

// filepath: admin/app/nodes/NodeFormModal.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NodeFormModalProps {
  node: any | null;
  onClose: () => void;
}

export default function NodeFormModal({ node, onClose }: NodeFormModalProps) {
  const supabase = createClient();
  const [formData, setFormData] = useState({
    name: '',
    city: '',
    state: '',
    zip_code: '',
    latitude: 0,
    longitude: 0,
    radius_miles: 10,
    description: '',
    is_active: true,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [lookingUpZip, setLookingUpZip] = useState(false);

  useEffect(() => {
    if (node) {
      setFormData({
        name: node.name || '',
        city: node.city || '',
        state: node.state || '',
        zip_code: node.zip_code || '',
        latitude: node.latitude || 0,
        longitude: node.longitude || 0,
        radius_miles: node.radius_miles || 10,
        description: node.description || '',
        is_active: node.is_active ?? true,
      });
    }
  }, [node]);

  const handleZipCodeChange = async (zipCode: string) => {
    setFormData({ ...formData, zip_code: zipCode });

    if (zipCode.length === 5 && /^\d{5}$/.test(zipCode)) {
      setLookingUpZip(true);
      try {
        // Lookup ZIP code coordinates
        const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
        if (response.ok) {
          const data = await response.json();
          const place = data.places[0];
          setFormData((prev) => ({
            ...prev,
            city: place['place name'],
            state: place['state abbreviation'],
            latitude: parseFloat(place.latitude),
            longitude: parseFloat(place.longitude),
          }));
        }
      } catch (error) {
        console.error('ZIP lookup error:', error);
      } finally {
        setLookingUpZip(false);
      }
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name || formData.name.trim().length < 2) {
      newErrors.name = 'Node name must be at least 2 characters';
    }
    if (!formData.city || formData.city.trim().length < 2) {
      newErrors.city = 'City is required';
    }
    if (!formData.state || formData.state.length !== 2) {
      newErrors.state = 'State must be 2-letter code (e.g., CT)';
    }
    if (!formData.zip_code || !/^\d{5}$/.test(formData.zip_code)) {
      newErrors.zip_code = 'ZIP code must be 5 digits';
    }
    if (!formData.latitude || !formData.longitude) {
      newErrors.coordinates = 'Coordinates are required';
    }
    if (!formData.radius_miles || formData.radius_miles < 1 || formData.radius_miles > 100) {
      newErrors.radius_miles = 'Radius must be between 1 and 100 miles';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      if (node) {
        // Update existing node
        const { error } = await supabase
          .from('geographic_nodes')
          .update({
            name: formData.name.trim(),
            city: formData.city.trim(),
            state: formData.state.toUpperCase(),
            zip_code: formData.zip_code,
            latitude: formData.latitude,
            longitude: formData.longitude,
            radius_miles: formData.radius_miles,
            description: formData.description.trim() || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', node.id);

        if (error) throw error;

        // Log admin action
        await supabase.from('admin_audit_log').insert({
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'update_node',
          entity_type: 'geographic_node',
          entity_id: node.id,
          changes: {
            before: node,
            after: formData,
          },
        });
      } else {
        // Create new node
        const { error } = await supabase.from('geographic_nodes').insert({
          name: formData.name.trim(),
          city: formData.city.trim(),
          state: formData.state.toUpperCase(),
          zip_code: formData.zip_code,
          latitude: formData.latitude,
          longitude: formData.longitude,
          radius_miles: formData.radius_miles,
          description: formData.description.trim() || null,
          is_active: formData.is_active,
          member_count: 0,
        });

        if (error) throw error;

        // Log admin action
        await supabase.from('admin_audit_log').insert({
          admin_id: (await supabase.auth.getUser()).data.user?.id,
          action: 'create_node',
          entity_type: 'geographic_node',
          changes: formData,
        });
      }

      alert(node ? 'Node updated successfully!' : 'Node created successfully!');
      onClose();
    } catch (error: any) {
      console.error('Save node error:', error);
      alert('Failed to save node: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">
            {node ? 'Edit Node' : 'Add New Node'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Node Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Node Name *
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="e.g., Norwalk Central"
              disabled={loading}
            />
            {errors.name && (
              <p className="text-red-600 text-sm mt-1">{errors.name}</p>
            )}
          </div>

          {/* ZIP Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ZIP Code *
            </label>
            <input
              type="text"
              value={formData.zip_code}
              onChange={(e) => handleZipCodeChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="06850"
              maxLength={5}
              disabled={loading}
            />
            {lookingUpZip && (
              <p className="text-blue-600 text-sm mt-1">Looking up ZIP code...</p>
            )}
            {errors.zip_code && (
              <p className="text-red-600 text-sm mt-1">{errors.zip_code}</p>
            )}
          </div>

          {/* City and State */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                City *
              </label>
              <input
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Norwalk"
                disabled={loading}
              />
              {errors.city && (
                <p className="text-red-600 text-sm mt-1">{errors.city}</p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                State *
              </label>
              <input
                type="text"
                value={formData.state}
                onChange={(e) =>
                  setFormData({ ...formData, state: e.target.value.toUpperCase() })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="CT"
                maxLength={2}
                disabled={loading}
              />
              {errors.state && (
                <p className="text-red-600 text-sm mt-1">{errors.state}</p>
              )}
            </div>
          </div>

          {/* Latitude and Longitude */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Latitude *
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.latitude}
                onChange={(e) =>
                  setFormData({ ...formData, latitude: parseFloat(e.target.value) })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="41.1177"
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Longitude *
              </label>
              <input
                type="number"
                step="0.0001"
                value={formData.longitude}
                onChange={(e) =>
                  setFormData({ ...formData, longitude: parseFloat(e.target.value) })
                }
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="-73.4079"
                disabled={loading}
              />
            </div>
          </div>
          {errors.coordinates && (
            <p className="text-red-600 text-sm mt-1">{errors.coordinates}</p>
          )}

          {/* Radius */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Radius (miles) *
            </label>
            <input
              type="number"
              value={formData.radius_miles}
              onChange={(e) =>
                setFormData({ ...formData, radius_miles: parseInt(e.target.value) })
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="10"
              min="1"
              max="100"
              disabled={loading}
            />
            <p className="text-gray-500 text-sm mt-1">
              Default search radius for this node (1-100 miles)
            </p>
            {errors.radius_miles && (
              <p className="text-red-600 text-sm mt-1">{errors.radius_miles}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
              placeholder="e.g., Central Norwalk area including downtown and East Norwalk"
              disabled={loading}
            />
          </div>

          {/* Active Status */}
          <div className="flex items-center">
            <input
              type="checkbox"
              checked={formData.is_active}
              onChange={(e) =>
                setFormData({ ...formData, is_active: e.target.checked })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={loading}
            />
            <label className="ml-2 block text-sm text-gray-900">
              Active (users can be assigned to this node)
            </label>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
              disabled={loading}
            >
              {loading ? 'Saving...' : node ? 'Update Node' : 'Create Node'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to admin panel → Nodes page
2. Verify nodes table displays existing nodes
3. Click "Add Node" button
4. Fill out form:
   - Name: "Norwalk Central"
   - ZIP Code: "06850" (should auto-populate city, state, lat, lng)
   - Verify city/state/coordinates auto-populated
   - Radius: 10 miles
   - Description: "Central Norwalk area"
   - Active: checked
5. Click "Create Node"
6. Verify node appears in table
7. Check database: geographic_nodes table has new record
8. Click "Edit" on node
9. Change radius to 15 miles
10. Click "Update Node"
11. Verify change saved
12. Check admin_audit_log table for create/update actions

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Nodes list page displays all nodes
✓ Stats cards show total/active nodes and members
✓ Add node button opens form modal
✓ Form validates all required fields
✓ ZIP code lookup auto-populates city/state/coordinates
✓ Form saves new nodes to database
✓ Form updates existing nodes
✓ Active/inactive toggle works
✓ Admin actions logged to audit log
✓ Error handling for duplicate nodes
✓ Loading states during save
✓ Success/error messages displayed

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to save node"
- Solution: Check RLS policies allow admin INSERT/UPDATE

Error: "ZIP lookup failed"
- Solution: Verify Zippopotam API accessible or use manual lat/lng entry

Error: "Duplicate node"
- Solution: Check if node with same name/ZIP already exists

==================================================
NEXT STEPS
==================================================

After node management UI complete:
1. Implement NODE-002 (Node activation/deactivation toggle)
2. Implement NODE-003 (Automatic node assignment on signup)
*/
```

---

### Acceptance Criteria

- [ ] Nodes list page created
- [ ] Stats cards display metrics
- [ ] Add node button opens form
- [ ] Form validates all fields
- [ ] ZIP code auto-populates location
- [ ] Create new nodes working
- [ ] Edit existing nodes working
- [ ] Active/inactive toggle works
- [ ] Admin actions logged
- [ ] Error handling implemented
- [ ] Loading states displayed
- [ ] Success messages shown

---

### Output Files

- `admin/app/nodes/page.tsx`
- `admin/app/nodes/NodeFormModal.tsx`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to save node | Check RLS policies allow admin INSERT/UPDATE |
| ZIP lookup failed | Verify API accessible or use manual entry |
| Duplicate node | Check if node with same name/ZIP exists |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create nodes list page | 60 min |
| Create node form modal | 60 min |
| Implement ZIP lookup | 20 min |
| Add validation logic | 20 min |
| Implement save/update | 20 min |
| Add audit logging | 15 min |
| Test and troubleshoot | 25 min |
| **Total** | **~3 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** NODE-002 - Node Activation/Deactivation Toggle

---


## TASK NODE-002: Implement Node Activation/Deactivation Toggle

**Duration:** 1 hour  
**Priority:** High  
**Dependencies:** NODE-001 (Node management UI)

### Description
Add ability to activate/deactivate nodes from admin panel. Inactive nodes cannot accept new user assignments but existing users remain assigned. Includes confirmation dialog and audit logging.

---

### AI Prompt for Cursor (Generate Node Activation Toggle)

```typescript
/*
TASK: Implement node activation/deactivation toggle

CONTEXT:
Admins need to activate/deactivate nodes. Inactive nodes:
- Cannot accept new user assignments
- Existing users remain assigned
- Items still visible within node
- Can be reactivated later

REQUIREMENTS:
1. Add activation toggle to nodes list
2. Show confirmation dialog before deactivation
3. Update is_active status in database
4. Log admin action
5. Display warning if node has active members

==================================================
FILE 1: Update admin/app/nodes/page.tsx
==================================================
Add toggle functionality to existing nodes table
*/

// filepath: admin/app/nodes/page.tsx (add these functions)

const handleToggleActive = async (node: Node) => {
  // Show confirmation dialog
  const action = node.is_active ? 'deactivate' : 'activate';
  const warningMessage = node.is_active && node.member_count > 0
    ? `\n\nWarning: This node has ${node.member_count} active members. They will remain assigned but new users cannot join this node.`
    : '';

  if (!confirm(`Are you sure you want to ${action} "${node.name}"?${warningMessage}`)) {
    return;
  }

  try {
    // Update node status
    const { error } = await supabase
      .from('geographic_nodes')
      .update({
        is_active: !node.is_active,
        updated_at: new Date().toISOString(),
      })
      .eq('id', node.id);

    if (error) throw error;

    // Log admin action
    await supabase.from('admin_audit_log').insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id,
      action: node.is_active ? 'deactivate_node' : 'activate_node',
      entity_type: 'geographic_node',
      entity_id: node.id,
      changes: {
        node_name: node.name,
        member_count: node.member_count,
        previous_status: node.is_active,
        new_status: !node.is_active,
      },
    });

    alert(`Node ${action}d successfully!`);
    loadNodes(); // Reload nodes list

  } catch (error: any) {
    console.error('Toggle active error:', error);
    alert('Failed to update node status: ' + error.message);
  }
};

// Update the Actions column in the table to include toggle:

<td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
  <button
    onClick={() => handleEdit(node)}
    className="text-blue-600 hover:text-blue-900 mr-3"
  >
    Edit
  </button>
  <button
    onClick={() => handleToggleActive(node)}
    className={`${
      node.is_active
        ? 'text-red-600 hover:text-red-900'
        : 'text-green-600 hover:text-green-900'
    }`}
  >
    {node.is_active ? 'Deactivate' : 'Activate'}
  </button>
</td>

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to admin → Nodes page
2. Find active node with members
3. Click "Deactivate"
4. Verify confirmation dialog shows:
   - Warning about existing members
   - Confirmation message
5. Confirm deactivation
6. Verify:
   - Node status changes to "Inactive" in table
   - Badge color changes to gray
   - Database: is_active = false
   - admin_audit_log has entry
7. Try assigning new user to inactive node (should fail)
8. Verify existing users still assigned
9. Click "Activate" on inactive node
10. Verify node becomes active again
11. New users can now be assigned to node

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Toggle button appears in Actions column
✓ Confirmation dialog shown before toggle
✓ Warning displayed if node has members
✓ is_active status updates in database
✓ Admin action logged to audit log
✓ Inactive nodes cannot accept new assignments
✓ Existing users remain assigned
✓ Nodes can be reactivated
✓ Status badge updates correctly
✓ Error handling implemented

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to update node status"
- Solution: Check RLS policies allow admin UPDATE

Issue: New users still assigned to inactive node
- Solution: Check node assignment logic filters by is_active=true

Issue: Existing users removed from inactive node
- Solution: Deactivation should NOT reassign existing users

==================================================
NEXT STEPS
==================================================

After node activation toggle complete:
1. Implement NODE-003 (Automatic node assignment on signup)
2. Ensure assignment logic only selects active nodes
*/
```

---

### Acceptance Criteria

- [ ] Toggle button in Actions column
- [ ] Confirmation dialog shown
- [ ] Warning for nodes with members
- [ ] is_active status updated
- [ ] Admin action logged
- [ ] Inactive nodes skip new assignments
- [ ] Existing users unaffected
- [ ] Nodes can be reactivated
- [ ] Status badge updates
- [ ] Error handling implemented

---

### Output Files

- Updated `admin/app/nodes/page.tsx`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to update status | Check RLS policies allow admin UPDATE |
| New users assigned to inactive | Check assignment filters is_active=true |
| Existing users removed | Deactivation should NOT reassign users |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Add toggle button | 10 min |
| Implement confirmation dialog | 15 min |
| Update database status | 10 min |
| Add audit logging | 10 min |
| Test activation/deactivation | 15 min |
| **Total** | **~1 hour** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** NODE-003 - Automatic Node Assignment on Signup

---

## TASK NODE-003: Implement Automatic Node Assignment on Signup

**Duration:** 2 hours  
**Priority:** Critical  
**Dependencies:** AUTH-005 (Profile creation), NODE-001 (Nodes exist)

### Description
Automatically assign users to nearest active geographic node based on their ZIP code during signup/profile creation. Uses PostGIS distance calculation to find closest node.

---

### AI Prompt for Cursor (Generate Automatic Node Assignment)

```typescript
/*
TASK: Implement automatic node assignment on signup

CONTEXT:
When user completes profile creation with ZIP code, automatically assign them to the nearest
active geographic node. Uses PostGIS to calculate distance from user's coordinates to all
active nodes.

REQUIREMENTS:
1. Get user's coordinates from ZIP code
2. Find nearest active node using PostGIS
3. Assign node_id to user
4. Update node member_count
5. Track analytics event
6. Handle edge cases (no active nodes nearby)

==================================================
FILE 1: Update src/services/location.ts
==================================================
Enhance existing assignNodeByZipCode function
*/

// filepath: src/services/location.ts (update existing function)

import { supabase } from './supabase';
import { trackEvent } from './analytics';
import * as Sentry from '@sentry/react-native';

/**
 * Assign user to nearest active geographic node based on ZIP code
 * @param zipCode - User's ZIP code
 * @param userId - User's ID (for analytics)
 * @returns Node ID
 */
export const assignNodeByZipCode = async (
  zipCode: string,
  userId?: string
): Promise<string> => {
  try {
    // Get coordinates for ZIP code
    const coordinates = await getZipCodeCoordinates(zipCode);
    
    if (!coordinates) {
      throw new Error('Failed to get coordinates for ZIP code');
    }

    const { latitude, longitude } = coordinates;

    // Find nearest ACTIVE node using PostGIS
    const { data, error } = await supabase.rpc('get_nearest_active_node', {
      user_lat: latitude,
      user_lng: longitude,
    });

    if (error) throw error;

    if (!data || data.length === 0) {
      // No active nodes found - log to Sentry
      Sentry.captureMessage('No active nodes available for user assignment', {
        level: 'warning',
        extra: {
          user_id: userId,
          zip_code: zipCode,
          latitude,
          longitude,
        },
      });

      throw new Error('No active nodes available in your area. Please contact support.');
    }

    const nearestNode = data[0];
    const distanceKm = nearestNode.distance_km;
    const distanceMiles = distanceKm * 0.621371;

    // Check if node is within reasonable distance (50 miles)
    if (distanceMiles > 50) {
      Sentry.captureMessage('Nearest node is >50 miles away', {
        level: 'warning',
        extra: {
          user_id: userId,
          zip_code: zipCode,
          node_id: nearestNode.id,
          distance_miles: distanceMiles,
        },
      });
    }

    // Track analytics
    if (userId) {
      trackEvent('node_assigned', {
        user_id: userId,
        node_id: nearestNode.id,
        node_name: nearestNode.name,
        distance_miles: distanceMiles.toFixed(2),
        zip_code: zipCode,
      });
    }

    return nearestNode.id;

  } catch (error: any) {
    console.error('Node assignment error:', error);
    Sentry.captureException(error, {
      extra: {
        user_id: userId,
        zip_code: zipCode,
      },
    });
    throw error;
  }
};

/**
 * Get coordinates for ZIP code
 */
const getZipCodeCoordinates = async (
  zipCode: string
): Promise<{ latitude: number; longitude: number } | null> => {
  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`);
    
    if (!response.ok) {
      throw new Error('ZIP code lookup failed');
    }

    const data = await response.json();
    const place = data.places[0];

    return {
      latitude: parseFloat(place.latitude),
      longitude: parseFloat(place.longitude),
    };
  } catch (error) {
    console.error('ZIP lookup error:', error);
    return null;
  }
};

/**
 * Update node member count
 * Call this after assigning user to node
 */
export const incrementNodeMemberCount = async (nodeId: string): Promise<void> => {
  try {
    const { error } = await supabase.rpc('increment_node_member_count', {
      node_id: nodeId,
    });

    if (error) throw error;
  } catch (error) {
    console.error('Increment node member count error:', error);
  }
};

/*
==================================================
FILE 2: Create get_nearest_active_node database function
==================================================
*/

-- filepath: supabase/migrations/006_get_nearest_active_node.sql

-- Function to get nearest ACTIVE geographic node
-- (Replaces get_nearest_node from AUTH-005 to filter by active status)
CREATE OR REPLACE FUNCTION get_nearest_active_node(user_lat DOUBLE PRECISION, user_lng DOUBLE PRECISION)
RETURNS TABLE (
  id UUID,
  name TEXT,
  distance_km DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gn.id,
    gn.name,
    ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(user_lng, user_lat)
    ) / 1000.0 AS distance_km
  FROM geographic_nodes gn
  WHERE gn.is_active = true  -- Only active nodes
  ORDER BY distance_km ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to increment node member count
CREATE OR REPLACE FUNCTION increment_node_member_count(node_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE geographic_nodes
  SET member_count = member_count + 1
  WHERE id = node_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement node member count
CREATE OR REPLACE FUNCTION decrement_node_member_count(node_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE geographic_nodes
  SET member_count = GREATEST(member_count - 1, 0)
  WHERE id = node_id;
END;
$$ LANGUAGE plpgsql;

/*
==================================================
FILE 3: Update ProfileCreationScreen to use new function
==================================================
*/

// filepath: src/screens/onboarding/ProfileCreationScreen.tsx (update handleSave)

import { assignNodeByZipCode, incrementNodeMemberCount } from '@/services/location';

const handleSave = async () => {
  // ... existing validation code ...

  try {
    // Assign node based on ZIP code
    const nodeId = await assignNodeByZipCode(formData.zipCode, user!.id);

    // Update user profile
    const { error: userError } = await supabase
      .from('users')
      .update({
        name: formData.name.trim(),
        avatar_url: avatarUrl,
        zip_code: formData.zipCode,
        city: formData.city,
        state: formData.state,
        node_id: nodeId,
        profile_completed: true,
      })
      .eq('id', user!.id);

    if (userError) throw userError;

    // Increment node member count
    await incrementNodeMemberCount(nodeId);

    // ... rest of existing code ...
  } catch (error: any) {
    console.error('Profile creation error:', error);
    alert(error.message || 'Failed to complete profile');
  }
};

/*
==================================================
FILE 4: Handle node reassignment when user changes ZIP code
==================================================
*/

// filepath: src/screens/profile/EditProfileScreen.tsx (update handleSave)

import { assignNodeByZipCode, incrementNodeMemberCount, decrementNodeMemberCount } from '@/services/location';

const handleSave = async () => {
  // ... existing validation code ...

  try {
    const oldNodeId = user!.node_id;
    let newNodeId = oldNodeId;

    // If ZIP code changed, reassign node
    if (formData.zipCode !== user!.zip_code) {
      newNodeId = await assignNodeByZipCode(formData.zipCode, user!.id);

      // Update member counts if node changed
      if (newNodeId !== oldNodeId && oldNodeId) {
        await decrementNodeMemberCount(oldNodeId);
        await incrementNodeMemberCount(newNodeId);
      }
    }

    // Update user profile
    const { error: userError } = await supabase
      .from('users')
      .update({
        name: formData.name.trim(),
        avatar_url: avatarUrl || user!.avatar_url,
        phone: formData.phone,
        zip_code: formData.zipCode,
        city: formData.city,
        state: formData.state,
        node_id: newNodeId,
      })
      .eq('id', user!.id);

    if (userError) throw userError;

    // ... rest of existing code ...
  } catch (error: any) {
    console.error('Profile edit error:', error);
    alert(error.message || 'Failed to update profile');
  }
};

/*
==================================================
VERIFICATION STEPS
==================================================

1. Create 2 active nodes in database:
   - Node A: Norwalk, CT (06850)
   - Node B: Little Falls, NJ (07424)
2. Deactivate all other nodes (if any)
3. Sign up new user with ZIP 06851 (near Norwalk)
4. Complete profile creation
5. Verify:
   - User assigned to Norwalk node
   - users.node_id = Norwalk node ID
   - Norwalk node member_count incremented by 1
   - Analytics event "node_assigned" tracked
6. Edit user profile, change ZIP to 07424 (Little Falls)
7. Verify:
   - User reassigned to Little Falls node
   - Norwalk member_count decremented
   - Little Falls member_count incremented
8. Try ZIP code far from any node (e.g., 99501 Alaska)
9. Verify warning logged to Sentry (>50 miles away)
10. Deactivate all nodes, try to sign up new user
11. Verify error: "No active nodes available"

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ User automatically assigned to nearest active node
✓ Only active nodes considered for assignment
✓ PostGIS calculates distance correctly
✓ Node member_count incremented on assignment
✓ Analytics event tracked
✓ Error handling for no active nodes
✓ Warning logged if nearest node >50 miles
✓ ZIP code change reassigns node
✓ Member counts update on reassignment
✓ Sentry logging for edge cases

==================================================
TROUBLESHOOTING
==================================================

Error: "No active nodes available"
- Solution: Create at least one active node in database

Error: "Failed to get coordinates"
- Solution: Check ZIP code valid and Zippopotam API accessible

Issue: User assigned to wrong node
- Solution: Verify PostGIS installed and ST_DistanceSphere working

Issue: Member count not updating
- Solution: Check increment/decrement functions exist and have correct permissions

==================================================
NEXT STEPS
==================================================

After automatic node assignment complete:
1. Implement NODE-004 (Node settings UI for configurable options)
2. Implement NODE-005 (Seed initial nodes in database)
*/
```

---

### Acceptance Criteria

- [ ] Auto-assign nearest active node
- [ ] Only active nodes considered
- [ ] PostGIS distance calculation works
- [ ] Member count incremented
- [ ] Analytics event tracked
- [ ] Error handling for no nodes
- [ ] Warning for distant nodes (>50mi)
- [ ] ZIP change reassigns node
- [ ] Member counts update on reassignment
- [ ] Sentry logging implemented

---

### Output Files

- Updated `src/services/location.ts`
- `supabase/migrations/006_get_nearest_active_node.sql`
- Updated `src/screens/onboarding/ProfileCreationScreen.tsx`
- Updated `src/screens/profile/EditProfileScreen.tsx`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| No active nodes available | Create at least one active node |
| Failed to get coordinates | Check ZIP valid and API accessible |
| Wrong node assigned | Verify PostGIS ST_DistanceSphere working |
| Member count not updating | Check functions exist with correct permissions |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Update location service | 30 min |
| Create database functions | 20 min |
| Update profile creation logic | 20 min |
| Update profile editing logic | 20 min |
| Add Sentry logging | 15 min |
| Test and troubleshoot | 35 min |
| **Total** | **~2 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** NODE-004 - Node Settings UI


## TASK NODE-004: Create Node Settings UI (Admin Panel)

**Duration:** 2 hours  
**Priority:** Medium  
**Dependencies:** NODE-001 (Node management UI)

### Description
Create admin UI to configure node-specific settings such as default search radius, distance units, auto-assignment rules, and feature toggles.

---

### AI Prompt for Cursor (Generate Node Settings UI)

```typescript
/*
TASK: Create node settings configuration UI

CONTEXT:
Admins need to configure global node settings that affect all nodes and node assignment logic.
Settings include: default radius, max assignment distance, distance units, etc.

REQUIREMENTS:
1. Create node settings page in admin panel
2. Display current settings with editable fields
3. Validate setting changes
4. Save to admin_config table
5. Log configuration changes
6. Show settings usage examples

==================================================
FILE 1: admin/app/settings/nodes/page.tsx
==================================================
*/

// filepath: admin/app/settings/nodes/page.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';

interface NodeSettings {
  default_radius_miles: number;
  max_assignment_distance_miles: number;
  allow_user_radius_adjustment: boolean;
  min_user_radius_miles: number;
  max_user_radius_miles: number;
  distance_warning_threshold_miles: number;
}

export default function NodeSettingsPage() {
  const supabase = createClient();
  const [settings, setSettings] = useState<NodeSettings>({
    default_radius_miles: 10,
    max_assignment_distance_miles: 50,
    allow_user_radius_adjustment: true,
    min_user_radius_miles: 5,
    max_user_radius_miles: 25,
    distance_warning_threshold_miles: 50,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load settings from admin_config table
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', [
          'default_radius_miles',
          'max_assignment_distance_miles',
          'allow_user_radius_adjustment',
          'min_user_radius_miles',
          'max_user_radius_miles',
          'distance_warning_threshold_miles',
        ]);

      if (error) throw error;

      // Convert array to object
      const settingsObj: any = {};
      data?.forEach((item) => {
        const value = item.value;
        // Parse boolean and number values
        if (value === 'true' || value === 'false') {
          settingsObj[item.key] = value === 'true';
        } else if (!isNaN(Number(value))) {
          settingsObj[item.key] = Number(value);
        } else {
          settingsObj[item.key] = value;
        }
      });

      setSettings((prev) => ({ ...prev, ...settingsObj }));
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const validateSettings = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (settings.default_radius_miles < 1 || settings.default_radius_miles > 100) {
      newErrors.default_radius_miles = 'Default radius must be between 1 and 100 miles';
    }

    if (settings.max_assignment_distance_miles < settings.default_radius_miles) {
      newErrors.max_assignment_distance_miles =
        'Max assignment distance must be >= default radius';
    }

    if (settings.allow_user_radius_adjustment) {
      if (settings.min_user_radius_miles < 1 || settings.min_user_radius_miles > settings.max_user_radius_miles) {
        newErrors.min_user_radius_miles = 'Min radius must be between 1 and max radius';
      }
      if (settings.max_user_radius_miles > 100) {
        newErrors.max_user_radius_miles = 'Max radius cannot exceed 100 miles';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validateSettings()) return;

    setSaving(true);

    try {
      // Save each setting to admin_config
      const updates = Object.entries(settings).map(([key, value]) => ({
        key,
        value: String(value),
      }));

      for (const { key, value } of updates) {
        const { error } = await supabase
          .from('admin_config')
          .upsert({
            key,
            value,
            updated_at: new Date().toISOString(),
          });

        if (error) throw error;
      }

      // Log admin action
      await supabase.from('admin_audit_log').insert({
        admin_id: (await supabase.auth.getUser()).data.user?.id,
        action: 'update_node_settings',
        entity_type: 'admin_config',
        changes: settings,
      });

      alert('Node settings saved successfully!');
    } catch (error: any) {
      console.error('Save settings error:', error);
      alert('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-gray-600">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Node Settings</h1>
        <p className="text-gray-600 mt-1">
          Configure default node behavior and assignment rules
        </p>
      </div>

      <div className="bg-white rounded-lg shadow p-6 space-y-6">
        {/* Default Radius */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Default Search Radius (miles) *
          </label>
          <input
            type="number"
            value={settings.default_radius_miles}
            onChange={(e) =>
              setSettings({ ...settings, default_radius_miles: parseInt(e.target.value) })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="1"
            max="100"
            disabled={saving}
          />
          <p className="text-gray-500 text-sm mt-1">
            Default radius for item searches within nodes
          </p>
          {errors.default_radius_miles && (
            <p className="text-red-600 text-sm mt-1">{errors.default_radius_miles}</p>
          )}
        </div>

        {/* Max Assignment Distance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Max Assignment Distance (miles) *
          </label>
          <input
            type="number"
            value={settings.max_assignment_distance_miles}
            onChange={(e) =>
              setSettings({
                ...settings,
                max_assignment_distance_miles: parseInt(e.target.value),
              })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="1"
            max="200"
            disabled={saving}
          />
          <p className="text-gray-500 text-sm mt-1">
            Maximum distance to assign user to a node. Warn if exceeded.
          </p>
          {errors.max_assignment_distance_miles && (
            <p className="text-red-600 text-sm mt-1">
              {errors.max_assignment_distance_miles}
            </p>
          )}
        </div>

        {/* Distance Warning Threshold */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distance Warning Threshold (miles) *
          </label>
          <input
            type="number"
            value={settings.distance_warning_threshold_miles}
            onChange={(e) =>
              setSettings({
                ...settings,
                distance_warning_threshold_miles: parseInt(e.target.value),
              })
            }
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            min="1"
            max="200"
            disabled={saving}
          />
          <p className="text-gray-500 text-sm mt-1">
            Log warning to Sentry if nearest node is this far away
          </p>
        </div>

        {/* Allow User Radius Adjustment */}
        <div className="border-t pt-6">
          <div className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={settings.allow_user_radius_adjustment}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  allow_user_radius_adjustment: e.target.checked,
                })
              }
              className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              disabled={saving}
            />
            <label className="ml-2 block text-sm font-medium text-gray-900">
              Allow users to adjust search radius
            </label>
          </div>
          <p className="text-gray-500 text-sm mb-4">
            If enabled, users can customize their search radius within min/max limits
          </p>

          {settings.allow_user_radius_adjustment && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Min User Radius (miles)
                </label>
                <input
                  type="number"
                  value={settings.min_user_radius_miles}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      min_user_radius_miles: parseInt(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="100"
                  disabled={saving}
                />
                {errors.min_user_radius_miles && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.min_user_radius_miles}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max User Radius (miles)
                </label>
                <input
                  type="number"
                  value={settings.max_user_radius_miles}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      max_user_radius_miles: parseInt(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  min="1"
                  max="100"
                  disabled={saving}
                />
                {errors.max_user_radius_miles && (
                  <p className="text-red-600 text-sm mt-1">
                    {errors.max_user_radius_miles}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Example Usage */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-2">
            📘 Example Usage
          </h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>
              • New users are assigned to nearest node within{' '}
              <strong>{settings.max_assignment_distance_miles} miles</strong>
            </li>
            <li>
              • Item searches default to <strong>{settings.default_radius_miles} miles</strong>{' '}
              from user's node
            </li>
            {settings.allow_user_radius_adjustment && (
              <li>
                • Users can adjust search radius between{' '}
                <strong>
                  {settings.min_user_radius_miles}-{settings.max_user_radius_miles} miles
                </strong>
              </li>
            )}
            {!settings.allow_user_radius_adjustment && (
              <li>• Users cannot adjust search radius (admin-controlled)</li>
            )}
          </ul>
        </div>

        {/* Save Button */}
        <div className="flex justify-end pt-4 border-t">
          <button
            onClick={handleSave}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. Navigate to admin → Settings → Nodes
2. Verify current settings loaded correctly
3. Change default radius to 15 miles
4. Change max assignment distance to 75 miles
5. Enable "Allow user radius adjustment"
6. Set min radius to 5, max radius to 30
7. Click "Save Settings"
8. Verify:
   - Settings saved to admin_config table
   - admin_audit_log has entry
   - Success message displayed
9. Reload page, verify changes persisted
10. Try invalid values (e.g., min > max)
11. Verify validation errors shown
12. Check example usage section updates dynamically

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Settings page displays current values
✓ All settings editable
✓ Validation enforced (min/max ranges)
✓ Settings save to admin_config table
✓ Admin actions logged
✓ Example usage section updates dynamically
✓ Error messages displayed for invalid values
✓ Loading and saving states shown
✓ Changes persist after reload

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to save settings"
- Solution: Check RLS policies allow admin UPSERT on admin_config

Issue: Settings not persisting
- Solution: Verify upsert query uses correct key/value format

Issue: Validation not working
- Solution: Check validateSettings() logic for edge cases

==================================================
NEXT STEPS
==================================================

After node settings UI complete:
1. Implement NODE-005 (Seed initial nodes in database)
2. Create script to populate Norwalk CT and Little Falls NJ
*/
```

---

### Acceptance Criteria

- [ ] Settings page created
- [ ] Current values display correctly
- [ ] All settings editable
- [ ] Validation enforced
- [ ] Settings save to database
- [ ] Admin actions logged
- [ ] Example usage updates dynamically
- [ ] Error messages shown
- [ ] Loading/saving states
- [ ] Changes persist after reload

---

### Output Files

- `admin/app/settings/nodes/page.tsx`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to save settings | Check RLS policies allow admin UPSERT |
| Settings not persisting | Verify upsert uses correct key/value format |
| Validation not working | Check validateSettings() edge case logic |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create settings page UI | 40 min |
| Implement settings loading | 20 min |
| Add validation logic | 20 min |
| Implement save functionality | 20 min |
| Add example usage section | 10 min |
| Test and troubleshoot | 30 min |
| **Total** | **~2 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** NODE-005 - Seed Initial Nodes

---

## Prompt Addendum: Child Profiles CRUD + Privacy

### AI Prompt for Cursor (Child Profiles Screens + Services)

```typescript
/*
TASK: Implement child profiles (create, edit, delete) with strict privacy

REQUIREMENTS:
1. Screens: NewChildProfile, EditChildProfile, ChildProfilesList
2. Fields: nickname (required), age (required text), clothing_size (optional), interests (optional multi-select)
3. Services: createChildProfile, updateChildProfile, deleteChildProfile, listChildProfiles
4. Privacy: profiles are visible only to the owner; never exposed in other users' views
5. Validation: nickname required; age formatted text (e.g. "3 years"); interests as array of enums

FILES:
- src/screens/children/NewChildProfile.tsx
- src/screens/children/EditChildProfile.tsx
- src/screens/children/ChildProfilesList.tsx
- src/services/children.ts

DB:
- Ensure RLS: user_id = auth.uid() for select/insert/update/delete on `children`
*/
```

### Acceptance Criteria
- Create/edit/delete flows work with optimistic UI updates
- RLS prevents access by other users
- Profiles do not render in any external user context or feed cards


## TASK NODE-005: Seed Initial Nodes in Database

**Duration:** 1.5 hours  
**Priority:** High  
**Dependencies:** NODE-001 (Node schema exists)

### Description
Create database migration to seed initial geographic nodes: Norwalk CT and Little Falls NJ. Includes accurate coordinates, radius, and descriptions.

---

### AI Prompt for Cursor (Generate Node Seeding Migration)

```typescript
/*
TASK: Seed initial geographic nodes

CONTEXT:
Need to populate database with 2 initial active nodes for MVP launch:
1. Norwalk, CT (primary test market)
2. Little Falls, NJ (secondary test market)

REQUIREMENTS:
1. Create migration file with seed data
2. Include accurate coordinates and ZIP codes
3. Set appropriate radius for each node
4. Mark both as active
5. Add descriptive information

==================================================
FILE 1: supabase/migrations/007_seed_initial_nodes.sql
==================================================
*/

-- filepath: supabase/migrations/007_seed_initial_nodes.sql

-- Seed initial geographic nodes for MVP launch

-- Norwalk, CT (primary test market)
INSERT INTO geographic_nodes (
  id,
  name,
  city,
  state,
  zip_code,
  latitude,
  longitude,
  radius_miles,
  description,
  is_active,
  member_count,
  created_at
) VALUES (
  gen_random_uuid(),
  'Norwalk Central',
  'Norwalk',
  'CT',
  '06850',
  41.1177,
  -73.4079,
  10,
  'Central Norwalk area including downtown, East Norwalk, and South Norwalk neighborhoods. Covers most of Norwalk CT for local peer-to-peer trading.',
  true,
  0,
  now()
);

-- Little Falls, NJ (secondary test market)
INSERT INTO geographic_nodes (
  id,
  name,
  city,
  state,
  zip_code,
  latitude,
  longitude,
  radius_miles,
  10,
  'Little Falls and surrounding Passaic County areas. Serves families in Little Falls, Totowa, Wayne, and nearby communities.',
  true,
  0,
  now()
);

-- Verify nodes were created
DO $$
DECLARE
  node_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO node_count FROM geographic_nodes WHERE is_active = true;
  
  IF node_count < 2 THEN
    RAISE EXCEPTION 'Failed to seed initial nodes. Expected 2, got %', node_count;
  END IF;
  
  RAISE NOTICE 'Successfully seeded % active geographic nodes', node_count;
END $$;

/*
==================================================
FILE 2: Create verification script
==================================================
*/

-- filepath: supabase/migrations/verify_nodes.sql
-- (Run this after seeding to verify nodes exist)

SELECT
  id,
  name,
  city,
  state,
  zip_code,
  latitude,
  longitude,
  radius_miles,
  is_active,
  member_count,
  created_at
FROM geographic_nodes
ORDER BY created_at ASC;

-- Expected output:
-- 1. Norwalk Central | Norwalk, CT | 06850 | (41.1177, -73.4079) | 10 mi | Active | 0 members
-- 2. Little Falls | Little Falls, NJ | 07424 | (40.8751, -74.2163) | 10 mi | Active | 0 members

/*
==================================================
FILE 3: Create admin script to add more nodes
==================================================
*/

-- filepath: scripts/add-node.sql
-- Template for adding additional nodes via SQL

INSERT INTO geographic_nodes (
  id,
  name,
  city,
  state,
  zip_code,
  latitude,
  longitude,
  radius_miles,
  description,
  is_active,
  member_count
) VALUES (
  gen_random_uuid(),
  '<NODE_NAME>',           -- e.g., 'Stamford Downtown'
  '<CITY>',                -- e.g., 'Stamford'
  '<STATE>',               -- e.g., 'CT'
  '<ZIP_CODE>',            -- e.g., '06901'
  <LATITUDE>,              -- e.g., 41.0534
  <LONGITUDE>,             -- e.g., -73.5387
  10,                      -- radius in miles
  '<DESCRIPTION>',         -- e.g., 'Downtown Stamford and surrounding areas'
  true,                    -- active status
  0                        -- initial member count
);

/*
==================================================
VERIFICATION STEPS
==================================================

1. Run migration: `supabase db push`
2. Check geographic_nodes table in Supabase dashboard
3. Verify 2 nodes exist:
   - Norwalk Central (CT)
   - Little Falls (NJ)
4. Verify both nodes are active (is_active = true)
5. Verify coordinates are correct:
   - Norwalk: 41.1177, -73.4079
   - Little Falls: 40.8751, -74.2163
6. Test node assignment:
   - Sign up with ZIP 06850 → should assign to Norwalk
   - Sign up with ZIP 07424 → should assign to Little Falls
7. Verify admin panel shows both nodes
8. Check that get_nearest_active_node function returns correct node for each ZIP

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Migration file created
✓ 2 initial nodes seeded
✓ Accurate coordinates for both nodes
✓ Both nodes marked as active
✓ Descriptions included
✓ Verification query works
✓ Nodes visible in admin panel
✓ Node assignment works for both ZIPs
✓ Template script for adding more nodes

==================================================
TROUBLESHOOTING
==================================================

Error: "Duplicate key violation"
- Solution: Check if nodes already exist, drop and re-run migration

Error: "Failed to seed initial nodes"
- Solution: Check geographic_nodes table exists and has correct schema

Issue: Wrong coordinates
- Solution: Verify lat/lng using Google Maps or similar service

==================================================
NEXT STEPS
==================================================

After initial nodes seeded:
1. Implement NODE-006 (Node-specific item filtering)
2. Filter items by user's node by default
*/
```

---

### Acceptance Criteria

- [ ] Migration file created
- [ ] 2 initial nodes seeded
- [ ] Accurate coordinates
- [ ] Both nodes active
- [ ] Descriptions included
- [ ] Verification query works
- [ ] Nodes visible in admin panel
- [ ] Assignment works for both ZIPs
- [ ] Template script provided

---

### Output Files

- `supabase/migrations/007_seed_initial_nodes.sql`
- `supabase/migrations/verify_nodes.sql`
- `scripts/add-node.sql`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Duplicate key violation | Check if nodes exist, drop and re-run |
| Failed to seed nodes | Verify table exists with correct schema |
| Wrong coordinates | Verify lat/lng using Google Maps |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Research accurate coordinates | 20 min |
| Create migration file | 20 min |
| Create verification script | 15 min |
| Create template script | 10 min |
| Test seeding | 15 min |
| Verify node assignment | 10 min |
| **Total** | **~1.5 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** NODE-006 - Node-Specific Item Filtering


## TASK NODE-006: Implement Node-Specific Item Filtering

**Duration:** 3 hours  
**Priority:** Critical  
**Dependencies:** NODE-003 (Auto-assignment), Future ITEM-001 (Item listing)

### Description
Filter item listings to show only items within user's assigned node by default. Users see items from nearby kids in their community first. Implements database queries with node-based WHERE clause.

---

### AI Prompt for Cursor (Generate Node-Based Item Filtering)

```typescript
/*
TASK: Implement node-specific item filtering

CONTEXT:
Users should see items from their local node by default. This creates a community-focused
marketplace where kids trade with nearby peers. Items from other nodes can be shown if
user expands search radius beyond their node.

REQUIREMENTS:
1. Create item listing query filtered by node_id
2. Add node filter to browse items screen
3. Show node name in item listings
4. Allow toggling "Show all items" (cross-node)
5. Track analytics for node-filtered vs all searches

==================================================
FILE 1: src/services/items.ts
==================================================
*/

// filepath: src/services/items.ts
import { supabase } from './supabase';
import { trackEvent } from './analytics';

export interface ItemFilters {
  node_id?: string;
  category_id?: string;
  condition?: string;
  min_price?: number;
  max_price?: number;
  search_query?: string;
  include_all_nodes?: boolean; // Cross-node search
}

/**
 * Get items with filters
 * @param filters - Filter criteria
 * @param userId - Current user ID (for analytics)
 * @returns Array of items
 */
export const getItems = async (
  filters: ItemFilters,
  userId: string
): Promise<any[]> => {
  try {
    let query = supabase
      .from('items')
      .select(`
        *,
        seller:users!items_seller_id_fkey(
          id,
          name,
          avatar_url,
          node_id,
          node:geographic_nodes!users_node_id_fkey(
            id,
            name,
            city,
            state
          )
        ),
        category:categories(id, name, icon),
        images:item_images(id, url, thumbnail_url, display_order)
      `)
      .eq('status', 'available')
      .order('created_at', { ascending: false });

    // Filter by node (default behavior)
    if (filters.node_id && !filters.include_all_nodes) {
      query = query.eq('seller.node_id', filters.node_id);
    }

    // Category filter
    if (filters.category_id) {
      query = query.eq('category_id', filters.category_id);
    }

    // Condition filter
    if (filters.condition) {
      query = query.eq('condition', filters.condition);
    }

    // Price range filter
    if (filters.min_price !== undefined) {
      query = query.gte('price', filters.min_price);
    }
    if (filters.max_price !== undefined) {
      query = query.lte('price', filters.max_price);
    }

    // Search query (title or description)
    if (filters.search_query) {
      query = query.or(
        `title.ilike.%${filters.search_query}%,description.ilike.%${filters.search_query}%`
      );
    }

    const { data, error } = await query;

    if (error) throw error;

    // Track analytics
    trackEvent('items_browsed', {
      user_id: userId,
      node_filter: filters.node_id,
      include_all_nodes: filters.include_all_nodes || false,
      category: filters.category_id,
      search_query: filters.search_query,
      result_count: data?.length || 0,
    });

    return data || [];
  } catch (error: any) {
    console.error('Get items error:', error);
    throw error;
  }
};

/**
 * Get items within distance radius (cross-node search)
 * @param userNodeId - User's node ID
 * @param radiusMiles - Search radius in miles
 * @param userId - Current user ID
 * @returns Array of items within radius
 */
export const getItemsWithinRadius = async (
  userNodeId: string,
  radiusMiles: number,
  userId: string
): Promise<any[]> => {
  try {
    // Get user's node coordinates
    const { data: userNode, error: nodeError } = await supabase
      .from('geographic_nodes')
      .select('latitude, longitude')
      .eq('id', userNodeId)
      .single();

    if (nodeError) throw nodeError;

    // Find all nodes within radius
    const { data: nearbyNodes, error: nodesError } = await supabase.rpc(
      'get_nodes_within_radius',
      {
        center_lat: userNode.latitude,
        center_lng: userNode.longitude,
        radius_miles: radiusMiles,
      }
    );

    if (nodesError) throw nodesError;

    const nodeIds = nearbyNodes.map((node: any) => node.id);

    // Get items from nearby nodes
    const { data: items, error: itemsError } = await supabase
      .from('items')
      .select(`
        *,
        seller:users!items_seller_id_fkey(
          id,
          name,
          avatar_url,
          node_id,
          node:geographic_nodes!users_node_id_fkey(
            id,
            name,
            city,
            state
          )
        ),
        category:categories(id, name, icon),
        images:item_images(id, url, thumbnail_url, display_order)
      `)
      .eq('status', 'available')
      .in('seller.node_id', nodeIds)
      .order('created_at', { ascending: false });

    if (itemsError) throw itemsError;

    // Track analytics
    trackEvent('items_browsed_by_radius', {
      user_id: userId,
      user_node_id: userNodeId,
      radius_miles: radiusMiles,
      nodes_searched: nodeIds.length,
      result_count: items?.length || 0,
    });

    return items || [];
  } catch (error: any) {
    console.error('Get items within radius error:', error);
    throw error;
  }
};

/*
==================================================
FILE 2: Create get_nodes_within_radius database function
==================================================
*/

-- filepath: supabase/migrations/008_get_nodes_within_radius.sql

-- Function to get all nodes within a radius of a center point
CREATE OR REPLACE FUNCTION get_nodes_within_radius(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  city TEXT,
  state TEXT,
  distance_miles DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    gn.id,
    gn.name,
    gn.city,
    gn.state,
    (ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34) AS distance_miles  -- Convert meters to miles
  FROM geographic_nodes gn
  WHERE
    gn.is_active = true
    AND ST_DistanceSphere(
      ST_MakePoint(gn.longitude, gn.latitude),
      ST_MakePoint(center_lng, center_lat)
    ) / 1609.34 <= radius_miles
  ORDER BY distance_miles ASC;
END;
$$ LANGUAGE plpgsql;

/*
==================================================
FILE 3: src/screens/items/BrowseItemsScreen.tsx
==================================================
*/

// filepath: src/screens/items/BrowseItemsScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useUserStore } from '@/stores/userStore';
import { getItems } from '@/services/items';

export default function BrowseItemsScreen() {
  const { user } = useUserStore();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllNodes, setShowAllNodes] = useState(false);

  useEffect(() => {
    loadItems();
  }, [showAllNodes]);

  const loadItems = async () => {
    if (!user) return;

    setLoading(true);
    try {
      const filters = {
        node_id: user.node_id,
        include_all_nodes: showAllNodes,
      };

      const data = await getItems(filters, user.id);
      setItems(data);
    } catch (error) {
      console.error('Load items error:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = () => (
    <View style={{ padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
      <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#111', marginBottom: 8 }}>
        Browse Items
      </Text>
      
      {/* Node Filter Toggle */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
        <View>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
            {showAllNodes ? 'Showing All Items' : `My Node: ${user?.node?.name || 'Loading...'}`}
          </Text>
          <Text style={{ fontSize: 12, color: '#666', marginTop: 2 }}>
            {showAllNodes
              ? 'Items from all nodes'
              : `Items from ${user?.node?.city}, ${user?.node?.state}`}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#666', marginRight: 8 }}>
            {showAllNodes ? 'All Nodes' : 'My Node'}
          </Text>
          <Switch
            value={showAllNodes}
            onValueChange={setShowAllNodes}
            trackColor={{ false: '#d1d5db', true: '#3b82f6' }}
            thumbColor="#fff"
          />
        </View>
      </View>
    </View>
  );

  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity
      style={{
        backgroundColor: '#fff',
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
      }}
    >
      {/* Item Image */}
      <View style={{ aspectRatio: 1, backgroundColor: '#f3f4f6' }}>
        {/* Image placeholder */}
      </View>

      {/* Item Details */}
      <View style={{ padding: 12 }}>
        <Text style={{ fontSize: 16, fontWeight: '600', color: '#111', marginBottom: 4 }}>
          {item.title}
        </Text>
        <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>
          ${item.price.toFixed(2)}
        </Text>

        {/* Seller Node Info */}
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Text style={{ fontSize: 12, color: '#666' }}>
            📍 {item.seller?.node?.name || 'Unknown Node'}
          </Text>
          {showAllNodes && item.seller?.node?.id !== user?.node_id && (
            <View style={{ marginLeft: 8, backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
              <Text style={{ fontSize: 10, color: '#92400e' }}>Other Node</Text>
            </View>
          )}
        </View>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#fff' }}>
        <ActivityIndicator size="large" color="#3b82f6" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          <View style={{ padding: 40, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666', textAlign: 'center' }}>
              {showAllNodes
                ? 'No items available'
                : 'No items in your node yet. Try expanding to all nodes!'}
            </Text>
          </View>
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </View>
  );
}

/*
==================================================
VERIFICATION STEPS
==================================================

1. Create test items in Norwalk node
2. Create test items in Little Falls node
3. Log in as Norwalk user
4. Navigate to Browse Items
5. Verify:
   - Only Norwalk items shown by default
   - Header shows "My Node: Norwalk Central"
   - Toggle switch set to "My Node"
6. Toggle switch to "All Nodes"
7. Verify:
   - Both Norwalk and Little Falls items shown
   - Items from other nodes have "Other Node" badge
   - Header shows "Showing All Items"
8. Toggle back to "My Node"
9. Verify only Norwalk items shown again
10. Check analytics events (items_browsed with node_filter)

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Items filtered by user's node by default
✓ Node filter toggle works
✓ "Show all nodes" displays cross-node items
✓ Node name displayed in item listings
✓ "Other Node" badge shown for cross-node items
✓ Empty state message when no items in node
✓ Analytics events tracked
✓ Database query filters by node_id
✓ PostGIS radius search works
✓ Loading states displayed

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to get items"
- Solution: Check items table has seller foreign key with node relationship

Issue: All items shown even with node filter
- Solution: Verify query includes .eq('seller.node_id', filters.node_id)

Issue: Radius search not working
- Solution: Check get_nodes_within_radius function exists and PostGIS enabled

==================================================
NEXT STEPS
==================================================

After node filtering complete:
1. Implement NODE-007 (Distance radius filter with user adjustment)
2. Allow users to customize search radius within admin-defined limits
*/
```

---

### Acceptance Criteria

- [ ] Items filtered by node by default
- [ ] Node filter toggle works
- [ ] Show all nodes option
- [ ] Node name displayed
- [ ] Other node badge shown
- [ ] Empty state message
- [ ] Analytics events tracked
- [ ] Database query filters correctly
- [ ] PostGIS radius search works
- [ ] Loading states displayed

---

### Output Files

- `src/services/items.ts`
- `supabase/migrations/008_get_nodes_within_radius.sql`
- `src/screens/items/BrowseItemsScreen.tsx`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to get items | Check seller FK has node relationship |
| All items shown with filter | Verify query includes node_id filter |
| Radius search not working | Check PostGIS function exists |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Create items service | 45 min |
| Create database function | 20 min |
| Create browse items screen | 60 min |
| Add node toggle functionality | 30 min |
| Test node filtering | 25 min |
| **Total** | **~3 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** NODE-007 - Distance Radius Filter

---

## TASK NODE-007: Implement Distance Radius Filter

**Duration:** 3 hours  
**Priority:** Medium  
**Dependencies:** NODE-004 (Node settings), NODE-006 (Node filtering)

### Description
Allow users to adjust search radius to find items beyond their immediate node. Radius adjustable from admin-configured min to max (default 5-25 miles). Shows distance to items from other nodes.

---

### AI Prompt for Cursor (Generate Distance Radius Filter)

```typescript
/*
TASK: Implement distance radius filter for item search

CONTEXT:
Users can adjust search radius to see items from nearby nodes. Admin configures min/max
radius limits. Users see distance to items from other nodes. Default radius from admin settings.

REQUIREMENTS:
1. Create radius slider component
2. Load admin-configured min/max limits
3. Update item search to use radius
4. Display distance to items from other nodes
5. Save user's preferred radius
6. Track analytics for radius changes

==================================================
FILE 1: Update src/screens/items/BrowseItemsScreen.tsx
==================================================
Add radius slider and distance display
*/

// filepath: src/screens/items/BrowseItemsScreen.tsx (add to existing component)

import Slider from '@react-native-community/slider';
import { getItemsWithinRadius } from '@/services/items';

export default function BrowseItemsScreen() {
  // ... existing state ...
  const [radiusMiles, setRadiusMiles] = useState(10);
  const [minRadius, setMinRadius] = useState(5);
  const [maxRadius, setMaxRadius] = useState(25);
  const [allowRadiusAdjustment, setAllowRadiusAdjustment] = useState(true);
  const [loadingSettings, setLoadingSettings] = useState(true);

  useEffect(() => {
    loadRadiusSettings();
    loadUserPreferredRadius();
  }, []);

  const loadRadiusSettings = async () => {
    try {
      // Load admin settings
      const { data, error } = await supabase
        .from('admin_config')
        .select('key, value')
        .in('key', [
          'default_radius_miles',
          'min_user_radius_miles',
          'max_user_radius_miles',
          'allow_user_radius_adjustment',
        ]);

      if (error) throw error;

      const settings: any = {};
      data?.forEach((item) => {
        settings[item.key] =
          item.value === 'true' || item.value === 'false'
            ? item.value === 'true'
            : Number(item.value);
      });

      setRadiusMiles(settings.default_radius_miles || 10);
      setMinRadius(settings.min_user_radius_miles || 5);
      setMaxRadius(settings.max_user_radius_miles || 25);
      setAllowRadiusAdjustment(settings.allow_user_radius_adjustment ?? true);
    } catch (error) {
      console.error('Load radius settings error:', error);
    } finally {
      setLoadingSettings(false);
    }
  };

  const loadUserPreferredRadius = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('user_preferences')
        .select('preferred_radius_miles')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      if (data?.preferred_radius_miles) {
        setRadiusMiles(data.preferred_radius_miles);
      }
    } catch (error) {
      // User preferences not set yet
      console.log('No preferred radius found');
    }
  };

  const handleRadiusChange = async (newRadius: number) => {
    setRadiusMiles(newRadius);

    // Save user preference
    if (user) {
      await supabase.from('user_preferences').upsert({
        user_id: user.id,
        preferred_radius_miles: newRadius,
      });

      trackEvent('radius_adjusted', {
        user_id: user.id,
        new_radius: newRadius,
        previous_radius: radiusMiles,
      });
    }

    // Reload items with new radius
    loadItemsWithRadius(newRadius);
  };

  const loadItemsWithRadius = async (radius: number) => {
    if (!user?.node_id) return;

    setLoading(true);
    try {
      const data = await getItemsWithinRadius(user.node_id, radius, user.id);
      
      // Add distance to each item
      const itemsWithDistance = await Promise.all(
        data.map(async (item) => {
          if (item.seller?.node?.id === user.node_id) {
            return { ...item, distance_miles: 0 };
          }

          // Calculate distance between user's node and seller's node
          const { data: distance } = await supabase.rpc('calculate_node_distance', {
            node1_id: user.node_id,
            node2_id: item.seller.node.id,
          });

          return { ...item, distance_miles: distance || 0 };
        })
      );

      setItems(itemsWithDistance);
    } catch (error) {
      console.error('Load items with radius error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Add radius slider to header
  const renderRadiusSlider = () => {
    if (!allowRadiusAdjustment) return null;

    return (
      <View style={{ padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>
            Search Radius
          </Text>
          <Text style={{ fontSize: 14, fontWeight: '600', color: '#3b82f6' }}>
            {radiusMiles} miles
          </Text>
        </View>
        <Slider
          minimumValue={minRadius}
          maximumValue={maxRadius}
          value={radiusMiles}
          onValueChange={setRadiusMiles}
          onSlidingComplete={handleRadiusChange}
          step={1}
          minimumTrackTintColor="#3b82f6"
          maximumTrackTintColor="#d1d5db"
          thumbTintColor="#3b82f6"
        />
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 12, color: '#666' }}>{minRadius} mi</Text>
          <Text style={{ fontSize: 12, color: '#666' }}>{maxRadius} mi</Text>
        </View>
      </View>
    );
  };

  // Update renderItem to show distance
  const renderItem = ({ item }: { item: any }) => (
    <TouchableOpacity style={{ /* ... existing styles ... */ }}>
      {/* ... existing item display ... */}

      {/* Distance Badge (if from other node) */}
      {item.distance_miles > 0 && (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
          <Text style={{ fontSize: 12, color: '#666' }}>
            📍 {item.seller?.node?.name}
          </Text>
          <View style={{ marginLeft: 8, backgroundColor: '#dbeafe', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
            <Text style={{ fontSize: 10, color: '#1e40af', fontWeight: '600' }}>
              {item.distance_miles.toFixed(1)} mi away
            </Text>
          </View>
        </View>
      )}
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <FlatList
        data={items}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            {renderHeader()}
            {renderRadiusSlider()}
          </>
        }
        ListEmptyComponent={/* ... existing empty state ... */}
      />
    </View>
  );
}

/*
==================================================
FILE 2: Create calculate_node_distance database function
==================================================
*/

-- filepath: supabase/migrations/009_calculate_node_distance.sql

-- Function to calculate distance between two nodes
CREATE OR REPLACE FUNCTION calculate_node_distance(node1_id UUID, node2_id UUID)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  node1_lat DOUBLE PRECISION;
  node1_lng DOUBLE PRECISION;
  node2_lat DOUBLE PRECISION;
  node2_lng DOUBLE PRECISION;
  distance_meters DOUBLE PRECISION;
BEGIN
  -- Get node 1 coordinates
  SELECT latitude, longitude INTO node1_lat, node1_lng
  FROM geographic_nodes
  WHERE id = node1_id;

  -- Get node 2 coordinates
  SELECT latitude, longitude INTO node2_lat, node2_lng
  FROM geographic_nodes
  WHERE id = node2_id;

  -- Calculate distance in meters using PostGIS
  distance_meters := ST_DistanceSphere(
    ST_MakePoint(node1_lng, node1_lat),
    ST_MakePoint(node2_lng, node2_lat)
  );

  -- Convert to miles
  RETURN distance_meters / 1609.34;
END;
$$ LANGUAGE plpgsql;

/*
==================================================
FILE 3: Create user_preferences table
==================================================
*/

-- filepath: supabase/migrations/010_user_preferences.sql

-- Table to store user preferences including preferred radius
CREATE TABLE IF NOT EXISTS user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferred_radius_miles INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX idx_user_preferences_user_id ON user_preferences(user_id);

-- RLS policies
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  USING (auth.uid() = user_id);

/*
==================================================
VERIFICATION STEPS
==================================================

1. Enable "allow_user_radius_adjustment" in admin settings
2. Set min_user_radius_miles = 5, max_user_radius_miles = 25
3. Create test items in multiple nodes (Norwalk, Little Falls, and add a 3rd node)
4. Log in as Norwalk user
5. Navigate to Browse Items
6. Verify:
   - Radius slider appears below node toggle
   - Default radius = 10 miles (from admin settings)
   - Slider range = 5 to 25 miles
7. Move slider to 5 miles
8. Verify:
   - Only items from Norwalk shown (items from nearby nodes hidden)
   - User preference saved to database
9. Move slider to 25 miles
10. Verify:
    - Items from multiple nodes shown
    - Distance badge shows "X.X mi away" for items from other nodes
    - Items sorted by distance (closest first)
11. Reload page
12. Verify preferred radius persists (still 25 miles)
13. Disable "allow_user_radius_adjustment" in admin settings
14. Verify slider hidden for users

==================================================
ACCEPTANCE CRITERIA
==================================================

✓ Radius slider appears (if admin allows)
✓ Admin-configured min/max limits enforced
✓ Default radius from admin settings
✓ User's preferred radius saved
✓ Preferred radius persists across sessions
✓ Items filtered by radius
✓ Distance displayed for items from other nodes
✓ Distance calculated correctly using PostGIS
✓ Analytics events tracked
✓ Slider hidden if admin disables adjustment

==================================================
TROUBLESHOOTING
==================================================

Error: "Failed to calculate distance"
- Solution: Check calculate_node_distance function exists

Issue: Slider not appearing
- Solution: Verify allow_user_radius_adjustment = true in admin_config

Issue: Preferred radius not saving
- Solution: Check user_preferences table exists and RLS policies allow user INSERT/UPDATE

Issue: Distance incorrect
- Solution: Verify PostGIS installed and ST_DistanceSphere working

==================================================
NEXT STEPS
==================================================

After distance radius filter complete:
1. Create MODULE-03-VERIFICATION.md
2. Proceed to MODULE-04: Item Listing
*/
```

---

### Acceptance Criteria

- [ ] Radius slider appears (if allowed)
- [ ] Admin min/max limits enforced
- [ ] Default radius from settings
- [ ] User preference saved
- [ ] Preference persists
- [ ] Items filtered by radius
- [ ] Distance displayed correctly
- [ ] PostGIS distance calculation works
- [ ] Analytics events tracked
- [ ] Slider hidden if disabled

---

### Output Files

- Updated `src/screens/items/BrowseItemsScreen.tsx`
- `supabase/migrations/009_calculate_node_distance.sql`
- `supabase/migrations/010_user_preferences.sql`

---

### Common Issues

| Issue | Solution |
|-------|----------|
| Failed to calculate distance | Check function exists |
| Slider not appearing | Verify admin setting enabled |
| Preference not saving | Check table exists with correct RLS |
| Distance incorrect | Verify PostGIS ST_DistanceSphere working |

---

### Time Breakdown

| Activity | Time |
|----------|------|
| Add radius slider component | 40 min |
| Load admin settings | 20 min |
| Implement radius filtering | 40 min |
| Create distance calculation | 20 min |
| Create preferences table | 15 min |
| Add distance display | 25 min |
| Test and troubleshoot | 40 min |
| **Total** | **~3 hours** |

---

**Status:** ⏸️ Ready to Implement

**Next Task:** Create MODULE-03-VERIFICATION.md

---

## Module 03 Summary

### Total Tasks: 7

| Task ID | Task Name | Duration | Status |
|---------|-----------|----------|--------|
| NODE-001 | Create Admin UI for Nodes | 3 hours | ⏸️ Ready |
| NODE-002 | Node Activation/Deactivation | 1 hour | ⏸️ Ready |
| NODE-003 | Automatic Node Assignment | 2 hours | ⏸️ Ready |
| NODE-004 | Node Settings UI | 2 hours | ⏸️ Ready |
| NODE-005 | Seed Initial Nodes | 1.5 hours | ⏸️ Ready |
| NODE-006 | Node-Specific Item Filtering | 3 hours | ⏸️ Ready |
| NODE-007 | Distance Radius Filter | 3 hours | ⏸️ Ready |
| **TOTAL** | **7 tasks** | **~15.5 hours** | **Complete** |

### Key Deliverables

**Admin Panel:**
- ✅ Nodes management page (list, create, edit)
- ✅ Node form modal with validation
- ✅ Node activation/deactivation toggle
- ✅ Node settings configuration page
- ✅ SMS rate limiting config (from AUTH module)

**Mobile App:**
- ✅ Automatic node assignment on signup
- ✅ Node-based item filtering
- ✅ Distance radius slider
- ✅ Distance display for cross-node items

**Database:**
- ✅ geographic_nodes table (from INFRA)
- ✅ get_nearest_active_node function
- ✅ increment/decrement_node_member_count functions
- ✅ get_nodes_within_radius function
- ✅ calculate_node_distance function
- ✅ user_preferences table
- ✅ Initial node seeding (Norwalk CT, Little Falls NJ)

**Services:**
- ✅ Node assignment service
- ✅ Node filtering service
- ✅ Radius search service

### Geographic Node Flow

```
User Signs Up → ZIP Code Entry → Get Coordinates → Find Nearest Active Node
     ↓
User Assigned to Node (member_count++) → Profile Complete
     ↓
Browse Items → Default: Show Node Items Only
     ↓
Toggle "All Nodes" OR Adjust Radius Slider → Cross-Node Search
     ↓
Items Display with Distance Badges
```

### Next Steps

1. ✅ Create MODULE-03-VERIFICATION.md
2. ⏸️ Proceed to Module 04: Item Listing
3. ⏸️ Modules 05-15 pending

