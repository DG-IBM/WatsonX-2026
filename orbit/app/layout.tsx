import type { Metadata } from 'next';
import '../styles/globals.css';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'ORBIT — AI-Powered Project Onboarding',
  description: 'Gamified AI onboarding that maps your project into an explorable solar system.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Space+Mono:ital,wght@0,400;0,700;1,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <AppShell>
          {children}
        </AppShell>
      </body>
    </html>
  );
}
