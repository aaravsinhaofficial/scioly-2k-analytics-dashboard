import Link from "next/link";
import { FileSearch, Filter, RotateCcw } from "lucide-react";
import { ReportActions } from "@/components/admin/ReportActions";
import styles from "@/components/admin/ReportCenter.module.css";
import { adminReportTypes, type AdminReportCell, type AdminReportData } from "@/lib/admin-reports";
import { cn } from "@/lib/utils";

function apiCsvHref(report: AdminReportData) {
  const params = new URLSearchParams({ type: report.filters.type, format: "csv" });
  if (report.filters.from) params.set("from", report.filters.from);
  if (report.filters.to) params.set("to", report.filters.to);
  if (report.filters.studentId) params.set("student", report.filters.studentId);
  if (report.filters.teamId) params.set("team", report.filters.teamId);
  return `/api/admin/reports?${params.toString()}`;
}

const toneClasses: Record<NonNullable<AdminReportCell["tone"]>, string> = {
  default: "text-white",
  muted: "text-zinc-500",
  accent: "font-semibold text-cyan-300",
  success: "font-semibold text-emerald-300",
  warning: "font-semibold text-amber-300",
  danger: "font-semibold text-red-300"
};

function CellValue({ cell }: { cell: AdminReportCell | undefined }) {
  if (!cell) return <span className="text-zinc-500">—</span>;
  const className = cn("break-words", toneClasses[cell.tone ?? "default"]);
  return cell.href ? (
    <Link href={cell.href} className={cn(className, "underline decoration-court-control underline-offset-4 hover:text-cyan-300 hover:decoration-cyan-400")}>
      {cell.value}
    </Link>
  ) : <span className={className}>{cell.value}</span>;
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(value));
}

export function ReportCenter({ report }: { report: AdminReportData }) {
  return (
    <div className="min-w-0 space-y-5">
      <style>{"@media print { body * { visibility: hidden !important; } }"}</style>
      <section className="rounded-md border border-court-line bg-court-panel p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md bg-court-elevated text-cyan-300">
            <Filter className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 id="report-filters-heading" className="text-xl font-semibold text-white">Choose what to include</h2>
            <p className="mt-1 text-sm leading-6 text-zinc-500">Generate an on-screen report first, then print it or download the same filtered rows as a CSV.</p>
          </div>
        </div>

        <form action="/admin/reports" method="get" aria-labelledby="report-filters-heading" aria-describedby="report-filter-help" className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600 md:col-span-2 xl:col-span-1">
            Report type
            <select name="type" defaultValue={report.filters.type} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white">
              {adminReportTypes.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Student
            <select name="student" defaultValue={report.filters.studentId} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white">
              <option value="">All students</option>
              {report.studentOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Team
            <select name="team" defaultValue={report.filters.teamId} className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white">
              <option value="">All teams</option>
              {report.teamOptions.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
            </select>
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            From date
            <input name="from" type="date" defaultValue={report.filters.from} aria-describedby="report-filter-help" className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
          </label>
          <label className="grid min-w-0 gap-2 text-sm font-medium text-zinc-600">
            Through date
            <input name="to" type="date" defaultValue={report.filters.to} aria-describedby="report-filter-help" className="w-full min-w-0 rounded-md border border-court-line bg-court-elevated px-3 text-white" />
          </label>
          <div className="flex min-w-0 flex-col gap-2 md:col-span-2 md:flex-row xl:col-span-5 xl:items-center xl:justify-between">
            <p id="report-filter-help" className="text-xs leading-5 text-zinc-500">
              {report.dateFilterApplies
                ? "The date range applies to this report. Leave either date blank for an open-ended range."
                : "Readiness and team reports are current snapshots, so the date fields are ignored for this report type."}
            </p>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
              <Link href="/admin/reports" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-court-line px-4 text-sm font-medium text-zinc-600 hover:border-cyan-400 hover:text-white">
                <RotateCcw className="h-4 w-4" aria-hidden="true" /> Reset filters
              </Link>
              <button type="submit" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-white px-4 text-sm font-semibold text-black hover:bg-cyan-200">
                <FileSearch className="h-4 w-4" aria-hidden="true" /> Generate report
              </button>
            </div>
          </div>
        </form>
      </section>

      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-zinc-500"><span className="font-semibold text-white">{report.rows.length}</span> rows generated · {report.filterDescription}</p>
        <ReportActions csvHref={apiCsvHref(report)} />
      </div>

      <section className={cn(styles.printArea, "min-w-0 overflow-hidden rounded-md border border-court-line bg-court-panel shadow-sm")} aria-labelledby="generated-report-heading">
        <header className="border-b border-court-line p-4 sm:p-5">
          <p className="text-sm font-medium text-cyan-300">SciOly Tracker report</p>
          <h2 id="generated-report-heading" className="mt-1 text-2xl font-semibold tracking-tight text-white">{report.title}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-zinc-500">{report.description}</p>
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-zinc-500">
            <span>Generated {formatGeneratedAt(report.generatedAt)}</span>
            <span>{report.filterDescription}</span>
          </div>
        </header>

        <div className="grid gap-px border-b border-court-line bg-court-line sm:grid-cols-2 xl:grid-cols-4">
          {report.summary.map((item) => (
            <div key={item.label} className="min-w-0 bg-court-panel p-4">
              <p className="text-xs font-medium text-zinc-500">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-white">{item.value}</p>
              <p className="mt-1 text-xs text-zinc-500">{item.detail}</p>
            </div>
          ))}
        </div>

        {report.rows.length ? (
          <>
            <div className={cn(styles.desktopTable, "hidden max-h-[760px] overflow-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-cyan-400 md:block")} role="region" aria-labelledby="generated-report-heading" tabIndex={0}>
              <table className="w-full min-w-[960px] border-collapse text-left text-sm">
                <caption className="sr-only">{report.title}: {report.filterDescription}</caption>
                <thead className="sticky top-0 z-10 bg-court-elevated text-xs font-medium text-zinc-500">
                  <tr>
                    {report.columns.map((column) => (
                      <th key={column.key} scope="col" className={cn("whitespace-nowrap px-4 py-3", column.align === "right" && "text-right")}>{column.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((row) => (
                    <tr key={row.id} className="border-t border-court-line align-top hover:bg-court-elevated">
                      {report.columns.map((column, index) => index === 0 ? (
                        <th key={column.key} scope="row" className={cn("max-w-72 px-4 py-3 text-left font-normal", column.align === "right" && "text-right tabular-nums")}>
                          <CellValue cell={row.cells[column.key]} />
                        </th>
                      ) : (
                        <td key={column.key} className={cn("max-w-72 px-4 py-3", column.align === "right" && "text-right tabular-nums")}>
                          <CellValue cell={row.cells[column.key]} />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className={cn(styles.mobileCards, "divide-y divide-court-line md:hidden")}>
              {report.rows.map((row) => {
                const [primary, ...secondary] = report.columns;
                return (
                  <article key={row.id} className="min-w-0 p-4">
                    <p className="text-xs font-medium text-zinc-500">{primary.label}</p>
                    <div className="mt-1 text-base font-semibold"><CellValue cell={row.cells[primary.key]} /></div>
                    <dl className="mt-4 grid min-w-0 grid-cols-2 gap-x-4 gap-y-3">
                      {secondary.map((column) => (
                        <div key={column.key} className="min-w-0">
                          <dt className="text-xs font-medium text-zinc-500">{column.label}</dt>
                          <dd className="mt-1 text-sm"><CellValue cell={row.cells[column.key]} /></dd>
                        </div>
                      ))}
                    </dl>
                  </article>
                );
              })}
            </div>
          </>
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="font-semibold text-white">Nothing to include</p>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-zinc-500">{report.emptyMessage}</p>
          </div>
        )}
      </section>
    </div>
  );
}
