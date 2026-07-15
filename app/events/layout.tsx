import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team event library"
};

export default function EventsLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
