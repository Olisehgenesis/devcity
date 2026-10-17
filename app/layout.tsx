import type { Metadata, Viewport } from "next";
import { Open_Sans } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Open_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
  fallback: ["system-ui", "sans-serif"],
});

export const metadata: Metadata = {
  title: "DEVCITY26",
  description: "Enter the city. Find your people. Claim something worth sharing.",
  applicationName: "DEVCITY26",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "DEVCITY26",
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
  themeColor: "#e9e4d5",
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
    <html lang="en" className={`${inter.variable} h-full`}>
      <body className="h-full antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
