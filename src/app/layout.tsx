import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { Providers } from './providers';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-sans',
  preload: true,
});

export const metadata: Metadata = {
  title: 'DEVCITY26 — A Living Onchain City',
  description: 'Enter the city. Find your people. Claim something worth sharing.',
  keywords: ['crypto', 'web3', 'tokens', 'social', 'map', 'events', 'base', 'ethereum'],
  authors: [{ name: 'DEVCITY26' }],
  creator: 'DEVCITY26',
  publisher: 'DEVCITY26',
  formatDetection: {
    telephone: false,
    address: false,
    email: false,
  },
  metadataBase: new URL('https://devcity26.xyz'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://devcity26.xyz',
    siteName: 'DEVCITY26',
    title: 'DEVCITY26 — A Living Onchain City',
    description: 'Enter the city. Find your people. Claim something worth sharing.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'DEVCITY26 — A Living Onchain City',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'DEVCITY26',
    description: 'Enter the city. Find your people. Claim something worth sharing.',
    images: ['/og-image.png'],
    creator: '@devcity26',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  icons: {
    icon: '/favicon.ico',
    shortcut: '/favicon-16x16.png',
    apple: '/apple-touch-icon.png',
    other: [
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '32x32',
        url: '/favicon-32x32.png',
      },
      {
        rel: 'icon',
        type: 'image/png',
        sizes: '16x16',
        url: '/favicon-16x16.png',
      },
      {
        rel: 'manifest',
        url: '/manifest.json',
      },
    ],
  },
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'DEVCITY26',
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f0f0f' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://api.maptiler.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://sepolia.base.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://api.dicebear.com" />
      </head>
      <body className="h-full bg-white text-gray-900 dark:bg-gray-950 dark:text-gray-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}