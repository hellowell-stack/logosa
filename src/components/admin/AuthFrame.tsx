import Image from "next/image";
import Link from "next/link";

/** The centred card that sign-in and first-run setup sit in. */
export default function AuthFrame({
  title,
  intro,
  children,
}: {
  title: string;
  intro?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="paper-grain flex min-h-svh items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <Link href="/" className="inline-block" aria-label="Logosa — back to the website">
          <Image src="/brand/logosa-mark.png" alt="" width={459} height={260} className="h-auto w-24" />
        </Link>
        <p className="label mt-8 text-gold-deep">Logosa · Booking desk</p>
        <h1 className="mt-3 font-[family-name:var(--font-display)] text-display-s leading-tight">{title}</h1>
        {intro && <div className="mt-4 text-small leading-relaxed text-ink-soft">{intro}</div>}
        <div className="mt-8">{children}</div>
      </div>
    </main>
  );
}
