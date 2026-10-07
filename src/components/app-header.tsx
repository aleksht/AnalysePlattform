import Link from "next/link";
import { signOut } from "@/lib/actions/auth";
import { ThemeToggle } from "./theme-toggle";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="flex h-7 w-7 items-center justify-center rounded bg-accent text-sm text-accent-fg">
            A
          </span>
          <span>Aksjeinnsikt</span>
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/" className="rounded-md px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-fg">
            Aksjer
          </Link>
          <Link
            href="/innstillinger"
            className="rounded-md px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-fg"
          >
            Innstillinger
          </Link>
          <ThemeToggle />
          <form action={signOut}>
            <button className="rounded-md px-2.5 py-1.5 text-muted hover:bg-surface-2 hover:text-fg">
              Logg ut
            </button>
          </form>
        </nav>
      </div>
    </header>
  );
}
