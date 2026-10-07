import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <h1 className="text-xl font-semibold">Fant ikke siden</h1>
      <p className="mt-1 text-sm text-muted">Adressen finnes ikke, eller siden er flyttet.</p>
      <Link href="/" className="btn-secondary mt-6">
        Til oversikten
      </Link>
    </main>
  );
}
