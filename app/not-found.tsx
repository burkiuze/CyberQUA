import Link from "next/link";

export default function NotFound() {
  return (
    <main className="frame flex min-h-dvh flex-col items-start justify-center px-6">
      <p className="eyebrow-accent">[ 404 ]</p>
      <h1 className="mt-4 font-mono text-5xl font-semibold">not_found</h1>
      <p className="mt-3 text-fg-muted">Sayfa bulunamadı · Page not found</p>
      <Link href="/" className="btn-primary mt-8">← CyberQUA</Link>
    </main>
  );
}
