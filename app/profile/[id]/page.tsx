import { AppShell } from "@/components/layout/AppShell";
import { PlayerProfile } from "@/components/profile/PlayerProfile";
import { getProfileData } from "@/lib/data";
import { mockStudents } from "@/lib/seed";

export const dynamicParams = false;

export function generateStaticParams() {
  return mockStudents.map((student) => ({
    id: student.id
  }));
}

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
      <PlayerProfile player={player} />
    </AppShell>
  );
}
