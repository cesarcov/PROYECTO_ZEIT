export default function StatCard({ title, value, icon, borderColor = "border-w-dark", loading, subtitle }) {
  return (
    <div className={`bg-white rounded-2xl border-l-4 ${borderColor} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-semibold text-w-mid uppercase tracking-wider">{title}</p>
        <span className="text-xl opacity-70">{icon}</span>
      </div>
      {loading ? (
        <div className="mt-3 space-y-2 animate-pulse">
          <div className="h-8 bg-w-light/50 rounded-lg w-2/3" />
          <div className="h-3 bg-w-light/30 rounded w-1/2" />
        </div>
      ) : (
        <div className="mt-2">
          <p className="text-3xl font-bold text-w-deep">{value ?? "—"}</p>
          {subtitle && <p className="text-xs text-w-mid mt-1">{subtitle}</p>}
        </div>
      )}
    </div>
  );
}
