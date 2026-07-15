import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event library"
};

export default function LibraryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
