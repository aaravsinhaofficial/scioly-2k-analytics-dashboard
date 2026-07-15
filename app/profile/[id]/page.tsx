import type { Metadata } from "next";
import { cache } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { PlayerProfile } from "@/components/profile/PlayerProfile";
import { getProfileData } from "@/lib/data";
import { hasSupabaseAdminConfig, hasSupabaseConfig } from "@/lib/supabase";

export const dynamic = "force-dynamic";

interface ProfilePageProps {
  params: Promise<{
    id: string;
  }>;
}

const getCachedProfileData = cache(getProfileData);

export async function generateMetadata({ params }: ProfilePageProps): Promise<Metadata> {
  const { id } = await params;
  const { player } = await getCachedProfileData(id);
  return {
    title: player.name,
    description: `${player.name}'s readiness, practice, and competition history.`
  };
}

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  const { currentUser, player } = await getCachedProfileData(id);

  return (
    <AppShell currentUser={currentUser}>
      <PlayerProfile
        player={player}
        canWithdrawPoints={currentUser.id === player.id}
        canRemovePoints={currentUser.role === "admin"}
        canDeleteAccount={currentUser.id === player.id && hasSupabaseConfig() && hasSupabaseAdminConfig()}
        accountEmail={currentUser.id === player.id ? currentUser.email : undefined}
      />
    </AppShell>
  );
}
