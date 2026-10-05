"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { login, type LoginState } from "./actions";

export function LoginForm() {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("email")}
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          dir="ltr"
          className="min-h-12 rounded-xl border border-line bg-surface px-3 text-base"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium">
        {t("password")}
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          dir="ltr"
          className="min-h-12 rounded-xl border border-line bg-surface px-3 text-base"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">
          {t(`errors.${state.error}`)}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="min-h-12 rounded-xl bg-primary px-4 font-semibold text-primary-ink disabled:opacity-60"
      >
        {pending ? t("signingIn") : t("signIn")}
      </button>
    </form>
  );
}
