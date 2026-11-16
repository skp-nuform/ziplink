import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shortly — a little link goes a long way",
  description: "Create, organize and share short links from your personal workspace.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
