import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice approvals"
};

export default function ApprovalsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
