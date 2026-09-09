import React from 'react';
import { Clock, X, ChevronRight } from 'lucide-react';
import { getRecentlyViewedAssets, clearRecentlyViewedAssets } from '@/components/assethub/recentlyViewed';
import AssetColourDot from '@/components/assethub/AssetColourDot';
import { TYPE_ICON } from '@/components/assethub/AssetInventoryGrid';

/**
 * Horizontal strip of recently-viewed asset chips shown at the top of the
 * AssetHub inventory tab. Lets users jump straight back to an asset they
 * were just looking at without scrolling through the full grid.
 */
export default function RecentlyViewedStrip({ onOpen, currentAssetId }) {
  const [items, setItems] = React.useState(() => getRecentlyViewedAssets());

  // Refresh from localStorage whenever the component mounts (e.g. after
  // returning from a detail page).
  React.useEffect(() => {
    setItems(getRecentlyViewedAssets());
  }, []);

  // Don't show the current asset in the strip (you're already on it in the
  // detail page, and in the hub there's no "current" so all show).
  const visible = items.filter(a => a.id !== currentAssetId);

  if (visible.length === 0) return null;

  return (
    <div className="insight-card rounded-hub px-hub-card-pad-sm py-2.5">
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1.5 flex-shrink-0 pr-2 border-r border-slate-200">
          <Clock className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide whitespace-nowrap">Recent</span>
        </div>
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 min-w-0">
          {visible.map(asset => {
            const Icon = TYPE_ICON?.[asset.asset_type] || null;
            return (
              <button
                key={asset.id}
                onClick={() => onOpen(asset)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 transition flex-shrink-0 group"
                title={asset.name}
              >
                <AssetColourDot colour={asset.colour} size={10} />
                {Icon && <Icon className="w-3 h-3 text-slate-400" />}
                <span className="truncate max-w-[120px]">{asset.name}</span>
                <ChevronRight className="w-3 h-3 text-slate-300 group-hover:text-slate-500 transition" />
              </button>
            );
          })}
        </div>
        <button
          onClick={() => { clearRecentlyViewedAssets(); setItems([]); }}
          className="flex-shrink-0 p-1 rounded-md hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"
          title="Clear recently viewed"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}