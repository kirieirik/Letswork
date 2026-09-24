import type { Metadata, Viewport } from "next";
import "./globals.css";
import "./progress.css";

export const metadata: Metadata = {
  title: "Company Tasks",
  description: "A simple shared task list for your company.",
  applicationName: "Company Tasks",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  themeColor: "#f6f7fb",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}