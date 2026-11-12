"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef } from "react";
import type { FormResult } from "@/lib/form-result";

/**
 * Every admin form. Wraps a server action, shows its error or notice, and
 * tells its submit buttons when it is busy.
 *
 * It submits by hand rather than through `<form action>`, on purpose: React
 * resets a form after an action-prop submission, so a quote rejected for a
 * typo in the deposit would come back with every field emptied. Here fields
 * keep what was typed, and are cleared only when `resetOnSuccess` asks for it
 * — right for "add a note" or "record a payment", wrong for "edit details".
 */

const Pending = createContext(false);

export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
}: {
  action: (prev: FormResult, fd: FormData) => Promise<FormResult>;
  children: React.ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
}) {
  const [state, dispatch, pending] = useActionState(action, undefined);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (resetOnSuccess && state?.notice && !state.error) ref.current?.reset();
  }, [state, resetOnSuccess]);

  return (
    <form
      ref={ref}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        // The submitter carries name/value, so one form can hold several
        // buttons that each mean something different.
        const fd = new FormData(e.currentTarget, (e.nativeEvent as SubmitEvent).submitter);
        startTransition(() => dispatch(fd));
      }}
    >
      <Pending.Provider value={pending}>{children}</Pending.Provider>
      {state?.error && (
        <p role="alert" className="mt-4 border-l-2 border-terracotta pl-3 text-small leading-relaxed text-ink">
          {state.error}
        </p>
      )}
      {state?.notice && !state.error && (
        <p role="status" className="mt-4 border-l-2 border-pine pl-3 text-small leading-relaxed text-ink-soft">
          {state.notice}
        </p>
      )}
    </form>
  );
}

export function Submit({
  children,
  busy = "Saving…",
  ghost,
  small,
  name,
  value,
  danger,
}: {
  children: React.ReactNode;
  busy?: string;
  ghost?: boolean;
  small?: boolean;
  name?: string;
  value?: string;
  danger?: boolean;
}) {
  const pending = useContext(Pending);
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={[
        "btn",
        ghost && "btn-ghost",
        small && "!px-4 !py-2.5",
        danger && "!border-terracotta !bg-transparent !text-terracotta hover:!bg-terracotta hover:!text-paper",
        "disabled:cursor-wait disabled:opacity-60",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {pending ? busy : children}
    </button>
  );
}
