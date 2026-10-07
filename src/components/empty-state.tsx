export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="px-6 py-12 text-center">
      <p className="text-2xl font-bold tracking-[-0.01em] sm:text-[28px]">{title}</p>
      {children && <div className="mx-auto mt-3 max-w-[560px] text-[17px] leading-relaxed text-muted">{children}</div>}
    </div>
  );
}
