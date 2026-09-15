import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useDivision } from '@/contexts/DivisionContext';

/**
 * useScopedEntity — the frontend entry point to the server-side division
 * isolation read layer (getDivisionScopedData).
 *
 * Drop-in replacement for the pattern:
 *   useQuery({ queryKey: ['jobs'], queryFn: () => base44.entities.Job.list() })
 * becomes:
 *   useScopedEntity('Job', { queryKey: ['jobs'], sort, limit })
 *
 * The active division_id from DivisionContext is passed to the backend
 * function, which enforces { division_id } (or job_id $in) server-side with
 * asServiceRole — so isolation cannot be bypassed by a missed client-side
 * filter, and admins are isolated too once they enter a division.
 *
 * In the Enterprise Overview (no active division), enterprise admins receive
 * cross-division aggregates; the hook is still enabled there so global
 * widgets keep working.
 *
 * @param {string} entity      Entity name (e.g. 'Job', 'RotaAssignment', 'Invoice')
 * @param {object} options
 *   filter    — Mongo filter merged with the server-side scope
 *   sort      — sort spec (e.g. '-created_date')
 *   limit     — max records
 *   queryKey  — extra query-key segments for cache invalidation
 *   enabled   — gate the query (default true)
 */
export function useScopedEntity(entity, options = {}) {
  const { activeDivisionId } = useDivision();
  const { filter, sort, limit, queryKey = [], enabled = true } = options;

  return useQuery({
    queryKey: ['scoped', entity, activeDivisionId || 'overview', ...(queryKey || [])],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke('getDivisionScopedData', {
          entity,
          division_id: activeDivisionId,
          filter: filter || {},
          sort,
          limit,
        });
        // The function returns { data: items }; res.data is the Axios body,
        // so the array lives at res.data.data.
        return res.data?.data || [];
      } catch {
        // Fallback to direct entity query with client-side division filter.
        // Used when the backend function is unavailable (plan restriction).
        const directFilter = { ...(filter || {}) };
        if (activeDivisionId) directFilter.division_id = activeDivisionId;
        const items = await base44.entities[entity].filter(directFilter, sort, limit);
        return items || [];
      }
    },
    enabled,
  });
}