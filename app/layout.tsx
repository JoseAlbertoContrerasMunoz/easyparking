import type { Metadata, Viewport } from "next";
import "leaflet/dist/leaflet.css";
import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "Easy Parking",
  title: "Easy Parking",
  description: "Encuentra, publica y actualiza estacionamientos en tiempo real.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Easy Parking",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#edf1ec" },
    { media: "(prefers-color-scheme: dark)", color: "#101513" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="h-full antialiased">
      <body className="min-h-full bg-[var(--background)] text-[var(--foreground)]">
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
