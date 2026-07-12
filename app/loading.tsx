export default function Loading() {
  return (
    <div className="min-h-screen bg-court-black p-4 lg:pl-72 lg:pr-8 lg:pt-24" aria-label="Loading page" role="status">
      <div className="mx-auto max-w-[1220px] animate-pulse space-y-6">
        <div className="h-9 w-64 rounded-md bg-court-elevated" />
        <div className="h-5 w-full max-w-xl rounded-md bg-court-elevated" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => <div key={item} className="h-28 rounded-md border border-court-line bg-court-panel" />)}
        </div>
        <div className="h-[420px] rounded-md border border-court-line bg-court-panel" />
        <span className="sr-only">Loading SciOly Tracker</span>
      </div>
    </div>
  );
}
