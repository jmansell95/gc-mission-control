/**
 * KpiSkeleton — shared loading placeholder for enterprise hub KPI rows.
 * Shows pulsing skeleton tiles with the same dimensions as the real KPI tiles
 * so the layout doesn't jump when data arrives. Prevents the misleading
 * "£0 / 0" flash that looks like real (bad) data while stats are loading.
 */
export default function KpiSkeleton({ count = 4, cols = 'sm:grid-cols-4' }) {
  return (
    <div className={`grid grid-cols-2 ${cols} gap-2 sm:gap-2.5`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="rounded-xl sm:rounded-2xl p-3 sm:p-4 bg-slate-200/70 animate-pulse h-[64px] sm:h-[72px]"
        />
      ))}
    </div>
  );
}