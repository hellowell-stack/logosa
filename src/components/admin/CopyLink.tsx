"use client";

import { useState } from "react";

/** A traveller's private link, with a button that copies it. */
export default function CopyLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-stretch gap-2">
      <input
        readOnly
        value={url}
        onFocus={(e) => e.currentTarget.select()}
        className="field min-w-0 flex-1 !py-2 font-mono text-micro"
        aria-label="Traveller link"
      />
      <button
        type="button"
        className="btn btn-ghost !px-3 !py-2"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1600);
          } catch {
            // Clipboard refused (permissions, insecure origin): the field is
            // selectable, so copying by hand still works.
          }
        }}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
