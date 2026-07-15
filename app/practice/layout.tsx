import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Practice tests"
};

export default function PracticeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
