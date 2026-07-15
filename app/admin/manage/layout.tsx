import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team management"
};

export default function ManageLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
