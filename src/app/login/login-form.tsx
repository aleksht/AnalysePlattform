"use client";

import { useActionState } from "react";
import { signIn, type LoginState } from "@/lib/actions/auth";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(signIn, initial);

  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">
          E-postadresse
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          className="input"
          placeholder="navn@eksempel.no"
          defaultValue={state.email}
          required
        />
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="password">
          Passord
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="input"
          required
        />
      </div>
      {state.error && (
        <p className="text-sm text-neg" role="alert">
          {state.error}
        </p>
      )}
      <button className="btn-primary w-full" disabled={pending}>
        {pending ? "Logger inn …" : "Logg inn"}
      </button>
    </form>
  );
}
