export default function Loading() {
  return (
    <div className="animate-pulse space-y-4" aria-label="Laster">
      <div className="h-8 w-48 rounded bg-surface-2" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="h-24 rounded-lg bg-surface-2" />)}
      </div>
    </div>
  );
}
