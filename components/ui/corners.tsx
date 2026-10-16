/** e2b-style "+" markers at the four corners of a framed box. */
export function Corners({ className = "text-line-strong" }: { className?: string }) {
  const base = `pointer-events-none absolute z-10 select-none font-mono text-[13px] leading-none ${className}`;
  return (
    <>
      <span aria-hidden className={`${base} -left-[5px] -top-[7px]`}>+</span>
      <span aria-hidden className={`${base} -right-[5px] -top-[7px]`}>+</span>
      <span aria-hidden className={`${base} -bottom-[6px] -left-[5px]`}>+</span>
      <span aria-hidden className={`${base} -bottom-[6px] -right-[5px]`}>+</span>
    </>
  );
}

export function SectionLabel({ index, children }: { index?: string; children: React.ReactNode }) {
  return (
    <div className="eyebrow flex items-center gap-3">
      {index ? <span className="text-accent">[{index}]</span> : null}
      <span>{children}</span>
      <span aria-hidden className="h-px flex-1 bg-line" />
    </div>
  );
}
