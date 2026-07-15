import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: ReactNode;
  label?: string;
  actions?: ReactNode;
}

export function PageHeader({ title, description, label, actions }: PageHeaderProps) {
  return (
    <header
      className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
      aria-labelledby="page-title"
      aria-describedby={description ? "page-description" : undefined}
    >
      <div className="max-w-3xl">
        {label ? <p className="text-sm font-medium text-cyan-300">{label}</p> : null}
        <h1 id="page-title" className="mt-1 text-3xl font-semibold tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        {description ? (
          <div id="page-description" className="mt-2 text-sm leading-6 text-zinc-500 md:text-base">
            {description}
          </div>
        ) : null}
      </div>
      {actions ? (
        <div className="w-full shrink-0 sm:w-auto" role="group" aria-label="Page actions">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
