/**
 * SectionTitle — shared section heading for enterprise hub pages.
 *
 * Icon tile + title + subtitle, used by every enterprise hub (Financial,
 * Operations, Compliance, Dashboard) so section headings are visually
 * identical across all enterprise pages. Previously duplicated in each
 * hub file; extracted here so a single edit updates all hubs at once.
 */
export default function SectionTitle({ icon: Icon, title, subtitle, gradient }) {
  return (
    <div className="flex items-center gap-2.5 mb-3 sm:mb-4">
      <div className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg sm:rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-md flex-shrink-0`}>
        <Icon className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
      </div>
      <div className="min-w-0">
        <h2 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">{title}</h2>
        {subtitle && <p className="text-[11px] sm:text-xs text-slate-500 truncate">{subtitle}</p>}
      </div>
    </div>
  );
}