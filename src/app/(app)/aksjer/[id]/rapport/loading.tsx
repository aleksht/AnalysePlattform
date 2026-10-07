export default function Loading() {
  return (
    <div className="mx-auto max-w-[760px] animate-pulse space-y-6 px-[22px] py-16" aria-label="Laster rapport">
      <div className="h-8 w-64 rounded bg-surface-2" />
      <div className="h-6 w-full rounded bg-surface-2" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-32 rounded-lg bg-surface-2" />
      ))}
    </div>
  );
}
