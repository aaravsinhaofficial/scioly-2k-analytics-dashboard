import { TournamentUpload } from "@/components/admin/TournamentUpload";
import { AppShell } from "@/components/layout/AppShell";
import { getUploadPageData } from "@/lib/data";

export default async function UploadPage() {
  const { currentUser } = await getUploadPageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase text-cyan-300">Duosmium Import</div>
          <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-5xl">
            Tournament Upload
          </h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Upload a Duosmium CSV or, for admins, paste a manual tournament dump. Rows update only the students listed
            as participants for that specific event and tournament.
          </p>
        </section>
        <TournamentUpload currentUser={currentUser} />
      </div>
    </AppShell>
  );
}
