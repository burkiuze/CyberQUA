import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getDocPage } from "@/lib/docs/content";
import { getI18n } from "@/lib/i18n/server";
import { siteUrl } from "@/lib/env";
import { DocRenderer } from "@/components/docs/doc-renderer";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slug } = await params;
  const { locale } = await getI18n();
  const page = getDocPage(slug);
  return page ? { title: page.title[locale], description: page.summary[locale] } : {};
}

export default async function DocPageRoute({ params }: { params: Params }) {
  const { slug } = await params;
  if (slug === "getting-started") redirect("/docs");
  const page = getDocPage(slug);
  if (!page) notFound();
  const { locale } = await getI18n();
  return <DocRenderer page={page} locale={locale} baseUrl={siteUrl()} />;
}
