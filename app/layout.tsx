import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Heliq",
  description: "Scheduleplanlegger og scheduleviser for helikopteroperasjoner",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="no">
      <body>{children}</body>
    </html>
  );
}
