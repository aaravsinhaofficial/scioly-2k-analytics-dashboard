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

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { id } = await params;
  const { currentUser, player } = await getProfileData(id);

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
