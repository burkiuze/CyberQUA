export interface LegalSection {
  title: string;
  paragraphs?: string[];
  items?: string[];
}

export function LegalPage({ eyebrow, title, updated, intro, sections }: { eyebrow: string; title: string; updated: string; intro: string; sections: LegalSection[] }) {
  return (
    <div className="frame px-4 py-12 md:px-10">
      <article className="prose-cq max-w-3xl">
        <p className="eyebrow-accent">[ {eyebrow} ]</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-fg md:text-4xl">{title}</h1>
        <p className="font-mono text-[12px] text-fg-dim">{updated}</p>
        <p>{intro}</p>
        {sections.map((s) => (
          <section key={s.title}>
            <h2>{s.title}</h2>
            {s.paragraphs?.map((p) => <p key={p}>{p}</p>)}
            {s.items ? (
              <ul>
                {s.items.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
      </article>
    </div>
  );
}
