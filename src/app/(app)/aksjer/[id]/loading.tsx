export default function Loading() {
  return (
    <div className="animate-pulse space-y-6" aria-label="Laster aksje">
      <div className="space-y-3">
        <div className="h-4 w-32 rounded bg-surface-2" />
        <div className="h-8 w-56 rounded bg-surface-2" />
        <div className="h-4 w-40 rounded bg-surface-2" />
      </div>
      <div className="h-10 rounded bg-surface-2" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="h-48 rounded-lg bg-surface-2 lg:col-span-2" />
        <div className="h-48 rounded-lg bg-surface-2" />
      </div>
    </div>
  );
}
