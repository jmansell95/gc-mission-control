/**
 * Enterprise Scope Resolver — the single source of truth for determining
 * which Business Unit / Business Stream division IDs a user can see and act on.
 *
 * Role Hierarchy:
 *  - enterprise_admin: sees every BU and stream (no filter)
 *  - bu_admin: sees all streams under their parent Business Unit
 *  - stream_manager: sees their own stream only
 *  - user: sees their own stream only
 *
 * Permission Groups (module-level access) are layered ON TOP of this scope —
 * they control which hubs/tabs/modules are visible, independent of data scope.
 *
 * Used by:
 *  - RLS rules on every entity (via user_condition + data.division_id filters)
 *  - The DivisionSwitcher (which divisions to show)
 *  - The global search (which scope to search)
 *  - The enterprise dashboard rollup
 */

export type EnterpriseRole = 'enterprise_admin' | 'bu_admin' | 'stream_manager' | 'user';

export type ScopeType = 'enterprise' | 'bu' | 'stream';

export interface ScopeResult {
  scopeType: ScopeType;
  /** null = unrestricted (enterprise admin sees all). Otherwise the list of division IDs the user can access. */
  divisionIds: string[] | null;
  /** The user's home division ID (their primary stream). */
  homeDivisionId: string | null;
  /** The user's enterprise role. */
  role: EnterpriseRole;
}

interface DivisionLike {
  id: string;
  parent_division_id?: string | null;
  hierarchy_level?: string;
  is_active?: boolean;
}

interface UserLike {
  id: string;
  role?: string;
  data?: {
    division_id?: string | null;
    managed_division_ids?: string[];
    enterprise_role?: EnterpriseRole;
    is_enterprise_admin?: boolean;
  };
}

/**
 * Resolve the user's enterprise scope from their user object and the full
 * division list. Returns a ScopeResult that can be used to filter entity queries.
 *
 * Backward compatibility: if enterprise_role is not set, falls back to the
 * legacy is_enterprise_admin flag and managed_division_ids array.
 */
export function resolveUserScope(user: UserLike | null, allDivisions: DivisionLike[]): ScopeResult {
  if (!user) {
    return { scopeType: 'stream', divisionIds: [], homeDivisionId: null, role: 'user' };
  }

  // Platform admins always get enterprise scope
  if (user.role === 'admin') {
    return {
      scopeType: 'enterprise',
      divisionIds: null,
      homeDivisionId: user.data?.division_id || null,
      role: 'enterprise_admin',
    };
  }

  const enterpriseRole: EnterpriseRole = user.data?.enterprise_role || 'user';
  const homeDivisionId = user.data?.division_id || null;
  const managedIds = user.data?.managed_division_ids || [];

  // Legacy: is_enterprise_admin flag maps to enterprise_admin
  if (user.data?.is_enterprise_admin && !user.data?.enterprise_role) {
    return {
      scopeType: 'enterprise',
      divisionIds: null,
      homeDivisionId,
      role: 'enterprise_admin',
    };
  }

  if (enterpriseRole === 'enterprise_admin') {
    return {
      scopeType: 'enterprise',
      divisionIds: null,
      homeDivisionId,
      role: 'enterprise_admin',
    };
  }

  if (enterpriseRole === 'bu_admin') {
    // BU Admin: find their BU. If their home division IS a BU (no parent), use it.
    // If their home division is a stream, use its parent.
    const homeDiv = allDivisions.find(d => d.id === homeDivisionId);
    const buId = homeDiv?.parent_division_id || homeDivisionId;

    if (!buId) {
      // No BU found — fall back to managed IDs only
      return {
        scopeType: 'bu',
        divisionIds: [...new Set([...managedIds])].filter(Boolean),
        homeDivisionId,
        role: 'bu_admin',
      };
    }

    // All streams under this BU (including the BU itself if it has data)
    const streamIds = allDivisions
      .filter(d => d.parent_division_id === buId || d.id === buId)
      .map(d => d.id);

    return {
      scopeType: 'bu',
      divisionIds: [...new Set([...streamIds, ...managedIds])].filter(Boolean),
      homeDivisionId,
      role: 'bu_admin',
    };
  }

  // stream_manager or user: their own stream + any managed IDs
  return {
    scopeType: 'stream',
    divisionIds: [...new Set([homeDivisionId, ...managedIds])].filter(Boolean),
    homeDivisionId,
    role: enterpriseRole,
  };
}

/**
 * Check whether a user can access a specific division ID.
 */
export function canAccessDivision(scope: ScopeResult, divisionId: string): boolean {
  if (scope.divisionIds === null) return true; // enterprise admin
  return scope.divisionIds.includes(divisionId);
}

/**
 * Get the RLS filter condition for a user's scope.
 * Returns a Mongo-style filter object to use with base44.entities.X.filter().
 *
 * For enterprise admins: returns {} (no filter — sees all).
 * For BU/stream: returns { division_id: { $in: [...] } } or { $or: [...] } to
 * also include records with null division_id (shared/enterprise-wide records).
 */
export function getScopeFilter(scope: ScopeResult): Record<string, unknown> {
  if (scope.divisionIds === null || scope.divisionIds.length === 0) {
    return {};
  }
  return {
    $or: [
      { division_id: { $in: scope.divisionIds } },
      { division_id: null },
      { division_id: { $exists: false } },
    ],
  };
}

/**
 * Group divisions into Business Units (parents) and their Streams (children).
 * Returns an array of { bu: Division, streams: Division[] } for easy rendering.
 */
export function groupByBusinessUnit(divisions: DivisionLike[]): Array<{ bu: DivisionLike | null; streams: DivisionLike[] }> {
  const bus = divisions.filter(d => !d.parent_division_id);
  const streams = divisions.filter(d => d.parent_division_id);

  // Streams with no parent (orphan) get their own group with bu=null
  const orphanStreams = streams.filter(s => !bus.find(b => b.id === s.parent_division_id));

  const groups = bus.map(bu => ({
    bu,
    streams: streams.filter(s => s.parent_division_id === bu.id).sort((a, b) =>
      (a.sort_order || 0) - (b.sort_order || 0)
    ),
  }));

  if (orphanStreams.length > 0) {
    groups.push({ bu: null, streams: orphanStreams });
  }

  return groups.sort((a, b) => ((a.bu?.sort_order || 0) - (b.bu?.sort_order || 0)));
}