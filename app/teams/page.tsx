import { AppShell } from "@/components/layout/AppShell";
import { TeamComparisonView } from "@/components/teams/TeamComparisonView";
import { getTeamsPageData } from "@/lib/data";

export default async function TeamsPage() {
  const { currentUser, teams } = await getTeamsPageData();

  return (
    <AppShell currentUser={currentUser}>
      <div className="space-y-6">
        <section className="rounded-md border border-court-line bg-court-panel p-5 md:p-6">
          <div className="text-xs font-black uppercase text-cyan-300">Team Comparison</div>
          <h1 className="mt-2 text-4xl font-black italic uppercase leading-none text-white md:text-5xl">
            Rosters Side by Side
          </h1>
          <p className="mt-3 max-w-3xl text-zinc-400">
            Team OVR uses the top 15 member ratings with 60 OVR baseline slots for open roster spots.
          </p>
        </section>
        <TeamComparisonView teams={teams} />
      </div>
    </AppShell>
  );
}
