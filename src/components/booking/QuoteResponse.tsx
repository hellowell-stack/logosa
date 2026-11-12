"use client";

import { useActionState, useState } from "react";
import { answerQuote, type AnswerState } from "@/app/(site)/booking/[token]/actions";

/**
 * Accept or decline a quote. Accepting is one click, because it commits the
 * traveller to nothing but a deposit conversation; declining asks once more,
 * because it is the answer people most often give by accident.
 */
export default function QuoteResponse({ token }: { token: string }) {
  const [state, action, pending] = useActionState<AnswerState, FormData>(answerQuote, undefined);
  const [confirmDecline, setConfirmDecline] = useState(false);

  return (
    <form action={action} className="mt-8">
      <input type="hidden" name="token" value={token} />

      {state?.error && (
        <p role="alert" className="mb-5 border-l-2 border-[var(--color-terracotta)] pl-4 text-small leading-relaxed text-ink">
          {state.error}
        </p>
      )}

      {!confirmDecline ? (
        <div className="flex flex-wrap items-center gap-4">
          <button type="submit" name="answer" value="accept" className="btn" disabled={pending}>
            {pending ? "Sending…" : "Accept this quote"}
          </button>
          <button
            type="button"
            className="btn btn-ghost"
            disabled={pending}
            onClick={() => setConfirmDecline(true)}
          >
            Decline
          </button>
        </div>
      ) : (
        <div className="border border-[var(--color-rule)] p-5">
          <p className="text-small text-ink">
            Decline this quote? We will not hold anything for you. If it is the price or the
            arrangements, replying to our email usually gets you a revised one instead.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button type="submit" name="answer" value="decline" className="btn btn-ghost" disabled={pending}>
              {pending ? "Sending…" : "Yes, decline it"}
            </button>
            <button type="button" className="link-rule" onClick={() => setConfirmDecline(false)}>
              <span className="label">Keep it</span>
            </button>
          </div>
        </div>
      )}
    </form>
  );
}
