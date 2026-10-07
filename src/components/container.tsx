/** Innholdsbredde som på apple.no: maks 1024 px med 22 px marg. */
export function Container({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1024px] px-[22px] ${className}`}>{children}</div>;
}

/** Overskrift i stil med apple.no: stor, tett og med punktum. */
export function SectionTitle({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <h2 className={`text-[32px] font-bold leading-tight tracking-[-0.02em] sm:text-[40px] ${className}`}>{children}</h2>
  );
}
