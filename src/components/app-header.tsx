import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "./theme-toggle";

/** Gjennomsiktig toppmeny med uskarp bakgrunn, i stil med apple.no. */
export function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-black/[0.08] bg-nav backdrop-blur-xl backdrop-saturate-[1.8] print:hidden dark:border-white/[0.08]">
      <nav
        aria-label="Hovedmeny"
        className="mx-auto flex h-12 max-w-[1024px] items-center justify-between gap-3 whitespace-nowrap px-[22px] text-[13px]"
      >
        <Link href="/" className="text-[15px] font-semibold tracking-tight text-fg">
          Aksjeinnsikt
        </Link>
        <div className="flex items-center gap-4 sm:gap-8">
          <Link href="/" className="text-fg/80 hover:text-fg">
            Aksjer
          </Link>
          <Link href="/innstillinger" className="text-fg/80 hover:text-fg">
            Innstillinger
          </Link>
          <ThemeToggle />
          <form action={signOut}>
            <button className="text-fg/80 hover:text-fg">Logg ut</button>
          </form>
        </div>
      </nav>
    </header>
  );
}
