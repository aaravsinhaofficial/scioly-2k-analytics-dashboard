import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Testoff score entry"
};

export default function TestoffAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
