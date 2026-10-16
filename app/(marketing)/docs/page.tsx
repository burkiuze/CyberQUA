import type { Metadata } from "next";
import { getDocPage } from "@/lib/docs/content";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/env";
import { DocRenderer } from "@/components/docs/doc-renderer";

export async function generateMetadata(): Promise<Metadata> {
  const { locale } = await getI18n();
  return { title: getDocPage("getting-started")!.title[locale] };
}

export default async function DocsIndexPage() {
  const { locale } = await getI18n();
  return <DocRenderer page={getDocPage("getting-started")!} locale={locale} baseUrl={siteUrl()} />;
}
