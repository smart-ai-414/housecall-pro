import type { ReactNode } from "react";

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-col gap-1.5">
        <h1 className="font-display text-brand-950 text-[1.625rem] font-bold tracking-[-0.018em]">
          {title}
        </h1>
        <p className="max-w-3xl text-[14.5px] leading-6 text-slate-600">
          {description}
        </p>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
