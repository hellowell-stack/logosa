/**
 * A labelled form control: label and hint on one line, the control, then the
 * error beneath it. Shared by the enquiry form, the booking request and the
 * admin, so a field looks and reads the same wherever it appears.
 */
export default function Field({
  label,
  hint,
  required,
  error,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`block ${className ?? ""}`}>
      <span className="flex items-baseline justify-between gap-3">
        <span className="label-slim text-ink">
          {label}
          {required && <span className="ml-1 text-gold-deep">*</span>}
        </span>
        {hint && <span className="text-micro text-ink-faint">{hint}</span>}
      </span>
      <span className="mt-1.5 block">{children}</span>
      {error && <span className="mt-1.5 block text-micro text-terracotta">{error}</span>}
    </label>
  );
}
