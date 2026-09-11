import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			// 30s stale time — prevents refetch storms on every component mount
			// and tab switch. The realtime hook still invalidates immediately
			// when data actually changes, so freshness is preserved.
			staleTime: 30 * 1000,
			gcTime: 5 * 60 * 1000,
			refetchOnMount: false,
			refetchOnWindowFocus: false,
			retry: 1,
		},
	},
});