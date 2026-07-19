import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Financial Compass",
  description: "Private, local-first personal finance decision support.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
