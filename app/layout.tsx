import type { Metadata, Viewport } from 'next';
import { JetBrains_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';

// The design language uses JetBrains Mono for ENS handles, timers, and counts.
// Loaded here (hoisted, self-hosted, no render-blocking <link>) and wired to
// Tailwind's --font-mono in globals.css, so every `font-mono` use picks it up.
const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-jetbrains-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Daemonium · Ignis',
  description:
    'Summon Ignis — a living flame companion that speaks and acts onchain.',
  applicationName: 'Daemonium',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'Ignis',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#050505',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
