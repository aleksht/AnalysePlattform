"use client";

import { useActionState } from "react";
import { sendMagicLink, verifyCode, type LoginState } from "@/lib/actions/auth";

const initial: LoginState = { step: "email" };

export function LoginForm() {
  const [sendState, send, sending] = useActionState(sendMagicLink, initial);
  const [codeState, verify, verifying] = useActionState(verifyCode, initial);

  if (sendState.step === "code") {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">{sendState.message}</p>
        <form action={verify} className="space-y-3">
          <input type="hidden" name="email" value={sendState.email} />
          <label className="block text-sm font-medium" htmlFor="token">
            Kode fra e-posten
          </label>
          <input
            id="token"
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            className="input tracking-widest"
            placeholder="123456"
            required
          />
          {codeState.error && <p className="text-sm text-neg">{codeState.error}</p>}
          <button className="btn-primary w-full" disabled={verifying}>
            {verifying ? "Logger inn …" : "Logg inn med kode"}
          </button>
        </form>
        <form action={send}>
          <input type="hidden" name="email" value={sendState.email} />
          <button className="text-sm text-accent hover:underline" disabled={sending}>
            Send ny e-post
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={send} className="space-y-3">
      <label className="block text-sm font-medium" htmlFor="email">
        E-postadresse
      </label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="email"
        className="input"
        placeholder="navn@eksempel.no"
        defaultValue={sendState.email}
        required
      />
      {sendState.error && <p className="text-sm text-neg">{sendState.error}</p>}
      <button className="btn-primary w-full" disabled={sending}>
        {sending ? "Sender …" : "Send innloggingslenke"}
      </button>
      <p className="text-xs text-muted">Du får en lenke og en kode på e-post. Ingen passord.</p>
    </form>
  );
}
