import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

// useInbox — fetches the current user's inbox items + badge counts.
// Subscribes to InboxItem realtime events so the list + badges live-refresh
// when new approvals arrive or items are actioned.
export function useInbox() {
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['my-inbox'],
    queryFn: async () => {
      const res = await base44.functions.invoke('getMyInbox');
      return res.data;
    },
    staleTime: 30_000,
  });

  useEffect(() => {
    const unsubscribe = base44.entities.InboxItem.subscribe((event) => {
      // Any create/update/delete to inbox items invalidates our cache
      queryClient.invalidateQueries({ queryKey: ['my-inbox'] });
    });
    return unsubscribe;
  }, [queryClient]);

  return {
    items: data?.items || [],
    counts: data?.counts || { total: 0, approvals: 0, alerts: 0, notices: 0, urgent: 0, overdue: 0 },
    isLoading,
    error,
    refetch,
  };
}