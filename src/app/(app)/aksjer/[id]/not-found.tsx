import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-xl font-semibold">Fant ikke aksjen</h1>
      <p className="mt-1 text-sm text-muted">Den kan ha blitt slettet.</p>
      <Link href="/" className="btn-secondary mt-6">Til oversikten</Link>
    </div>
  );
}
