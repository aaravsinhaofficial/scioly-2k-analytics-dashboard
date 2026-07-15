import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tournament import"
};

export default function UploadLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
