import type { Metadata, Viewport } from "next";
import { DM_Sans, Nunito } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { PwaRegister } from "./components/PwaRegister";

const display = Nunito({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  display: "swap",
  variable: "--font-nunito",
});

const body = DM_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
  variable: "--font-dm",
});

export const metadata: Metadata = {
  title: "DEVCITY 26: Mumbai Edition",
  description: "Enter the city. Find your people. Claim something worth sharing.",
  applicationName: "DEVCITY 26",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DEVCITY 26",
    statusBarStyle: "default",
  },
  icons: {
    icon: [
      { url: "/devcity-mark.svg", type: "image/svg+xml" },
      { url: "/devcity-mark.svg", sizes: "192x192", type: "image/svg+xml" },
      { url: "/devcity-mark.svg", sizes: "512x512", type: "image/svg+xml" },
    ],
    apple: [
      { url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  themeColor: "#D01265",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} h-full`}>
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
        <PwaRegister />
      </body>
    </html>
  );
}
