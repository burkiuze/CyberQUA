import Link from "next/link";

export function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`inline-flex min-h-11 items-center gap-2 font-mono text-sm font-semibold tracking-[0.2em] ${className}`}>
      <svg aria-hidden viewBox="0 0 32 32" className="h-6 w-6">
        <path d="M8 6h16v4H12v12h12v4H8z" fill="var(--accent)" />
        <rect x="18" y="14" width="6" height="4" fill="var(--purple)" />
      </svg>
      <span>
        CYBER<span className="text-accent">QUA</span>
      </span>
    </Link>
  );
}
