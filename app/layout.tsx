import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Atherton Open Play | Live Court & Queue Board",
  description: "Good games. Better company. The Atherton Pickleball Club live open-play queue, court timers, and fair social rotations.",
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
