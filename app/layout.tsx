import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Thought Cloud",
  description: "Speech-reactive orb for stage use",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
