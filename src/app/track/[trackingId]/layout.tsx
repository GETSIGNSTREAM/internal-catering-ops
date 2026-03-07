import type { Metadata, Viewport } from "next";

export const metadata: Metadata = {
  title: "Track Your Order | WILDBIRD Catering",
  description: "Track your WILDBIRD catering order in real time",
};

export const viewport: Viewport = {
  themeColor: "#1a1a1a",
  width: "device-width",
  initialScale: 1,
};

export default function TrackingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
