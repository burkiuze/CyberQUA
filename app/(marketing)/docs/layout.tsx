import { DOC_PAGES } from "@/lib/docs/content";
import { getI18n } from "@/lib/i18n/server";
import { DocsSidebar } from "@/components/docs/sidebar";

export default async function DocsLayout({ children }: { children: React.ReactNode }) {
  const { locale } = await getI18n();
  const toItem = (p: (typeof DOC_PAGES)[number]) => ({ slug: p.slug, title: p.title[locale], method: p.method });
  return (
    <div className="frame grid md:grid-cols-[250px_1fr]">
      <aside className="border-line md:border-r">
        <DocsSidebar guides={DOC_PAGES.filter((p) => p.group === "guide").map(toItem)} endpoints={DOC_PAGES.filter((p) => p.group === "endpoint").map(toItem)} />
      </aside>
      <div className="min-w-0 px-4 py-10 md:px-10">{children}</div>
    </div>
  );
}
