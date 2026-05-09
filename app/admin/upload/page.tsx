import { TournamentUpload } from "@/components/admin/TournamentUpload";
import { AppShell } from "@/components/layout/AppShell";
import { getUploadPageData } from "@/lib/data";

export default async function UploadPage() {
  const { currentUser } = await getUploadPageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase text-cyan-300">AI Import</div>
          <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-5xl">
            Tournament Upload
          </h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Paste Duosmium results, copied spreadsheet text, or official result text. The parser extracts schools,
            events, ranks, teams, SOS, and placement scores.
          </p>
        </section>
        <TournamentUpload />
      </div>
    </AppShell>
  );
}
