import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import SupabaseAuthProvider from "@/components/providers/supabase-auth-provider";
import I18nProvider from "@/components/providers/i18n-provider";
import { ServiceWorkerRegister } from "@/components/providers/sw-register";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "WILDBIRD Catering",
  description: "Catering operations management for WILDBIRD",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WILDBIRD",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased bg-dark-900`}>
        <SupabaseAuthProvider>
          <I18nProvider>{children}</I18nProvider>
        </SupabaseAuthProvider>
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
