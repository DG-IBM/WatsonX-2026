import type { Metadata } from 'next';
import '../styles/globals.css';
import AppShell from '@/components/layout/AppShell';

export const metadata: Metadata = {
  title: 'IBM Bluebook — AI-Powered Project Onboarding',
  description: 'AI-powered onboarding that maps your project into an explorable knowledge graph.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
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
