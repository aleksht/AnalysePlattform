import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Logg inn" };

export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-[40px] font-bold leading-tight tracking-[-0.03em]">Aksjeinnsikt.</h1>
          <p className="mt-2 text-[17px] text-muted">Hva kunder, ansatte og markedet faktisk mener.</p>
        </div>
        <div className="rounded-[22px] bg-surface-2 p-7">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
