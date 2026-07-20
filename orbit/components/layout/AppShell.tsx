'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useOrbitStore } from '@/store/orbitStore';
import type { AppScreen } from '@/types/orbit';

const ROUTE_TO_SCREEN: Record<string, AppScreen> = {
  '/connect':        'connect',
  '/role':           'role',
  '/solar-system':   'solar-system',
  '/mission-complete': 'mission-complete',
  '/mission-control': 'mission-control',
};

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { setCurrentScreen } = useOrbitStore();

  useEffect(() => {
    const screen = ROUTE_TO_SCREEN[pathname];
    if (screen) setCurrentScreen(screen);
  }, [pathname]);

  return <>{children}</>;
}
