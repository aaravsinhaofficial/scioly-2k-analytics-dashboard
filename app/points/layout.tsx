import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log practice"
};

export default function PointsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
