import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SciOly 2K Analytics",
  description: "2K-style Science Olympiad performance dashboard for Obra D Tompkins High School"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
