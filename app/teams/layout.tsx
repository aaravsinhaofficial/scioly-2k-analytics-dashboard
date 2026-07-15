import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team rosters"
};

export default function TeamsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
