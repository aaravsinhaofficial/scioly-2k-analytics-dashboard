import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event resources"
};

export default function ResourcesLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
