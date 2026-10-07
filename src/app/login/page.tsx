import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logg inn" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { feil } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-accent text-lg font-semibold text-accent-fg">
            A
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Aksjeinnsikt</h1>
          <p className="mt-1 text-sm text-muted">
            Hva kunder, ansatte og markedet faktisk mener.
          </p>
        </div>
        {feil === "lenke" && (
          <p className="mb-4 rounded-md bg-neg-bg px-3 py-2 text-sm text-neg">
            Lenken er ugyldig eller utløpt. Be om en ny.
          </p>
        )}
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
