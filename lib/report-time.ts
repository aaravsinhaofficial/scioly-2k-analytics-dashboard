// Reports use the school's local time, independent of the server/browser timezone.
export function formatReportGeneratedAt(value: string) {
  return `${new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Chicago"
  }).format(new Date(value))} CT`;
}
