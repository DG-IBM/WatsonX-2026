# Frontend Architecture — Helios

> **Location:** Confluence → Helios Engineering Space → Architecture → Frontend  
> **Owner:** Ana Lima (Senior Engineer, Grid UI) · @ana.lima  
> **Co-authored:** Sofia Marchetti · @sofia.marchetti (Customer Portal sections)  
> **Last Updated:** 2024-09-30  
> **Status:** Current — reflects v4.7 architecture  
> **Related:** [System Overview](/02-architecture/system-overview.md) · [API Standards](/05-engineering/api-standards.md) · [Authentication](/05-engineering/authentication.md) · [Coding Standards](/05-engineering/coding-standards.md)

---

## Overview

Helios has three frontend applications, each with different users, requirements, and engineering constraints. They share a design system and component library but are independently deployed:

| Application | Repo | Framework | Primary Users | Key Constraint |
|---|---|---|---|---|
| Grid Operations Portal | `helios-portal` | Next.js 14 (App Router) | Grid operators, control room | Density, real-time data, reliability |
| Customer Portal | `helios-customer-portal` | React 18 (Vite SPA) | Residential/commercial customers | Mobile-first, simplicity, accessibility |
| Technician Mobile App | `helios-tech-mobile` | React Native 0.73 | Field technicians | Offline-first, low bandwidth |

This document focuses on the **Grid Operations Portal** and **Customer Portal**. The mobile app is documented separately in [Technician Dispatch System](/03-services/technician-dispatch-system.md#mobile-app).

The shared component library (`@helios/ui`) is documented in the [Shared Component Library](#shared-component-library) section below.

---

## Grid Operations Portal (`helios-portal`)

### Technology Stack

```
Next.js 14 (App Router)
React 18
TypeScript 5.3
Zustand 4 (global state)
TanStack Query 5 (server state)
TanStack Table (data grids)
MapLibre GL JS 4 (GIS maps)
Recharts 2 (time-series charts)
@helios/ui (shared component library)
Apollo Client 3 (GraphQL)
Socket.IO client (WebSocket for real-time)
date-fns (date manipulation — not moment.js, not day.js)
Vitest + React Testing Library (unit/component tests)
Playwright (E2E tests)
```

### Project Structure

```
helios-portal/
├── app/                          Next.js App Router pages
│   ├── (auth)/                   Auth-required route group
│   │   ├── dashboard/            Main grid dashboard
│   │   ├── grid/                 Grid topology viewer
│   │   │   └── [regionId]/       Dynamic region pages
│   │   ├── alerts/               Alert management
│   │   ├── outages/              Outage management
│   │   ├── dispatch/             Work order management
│   │   ├── forecasting/          Demand forecasting views
│   │   ├── assets/               Asset management
│   │   ├── reports/              Regulatory reporting
│   │   └── settings/             Tenant and user settings
│   ├── (public)/                 Public routes (login, error pages)
│   ├── api/                      API route handlers (BFF layer)
│   └── layout.tsx                Root layout
├── components/
│   ├── grid/                     Grid-domain components
│   ├── alerts/                   Alert components
│   ├── charts/                   Chart wrappers
│   ├── maps/                     MapLibre wrappers
│   └── shared/                   Portal-specific shared components
├── lib/
│   ├── api/                      API client (Apollo + REST wrappers)
│   ├── auth/                     Auth helpers
│   ├── realtime/                 WebSocket connection management
│   └── utils/                    Utility functions
├── store/                        Zustand store modules
│   ├── gridState.ts              Live grid state slice
│   ├── alertsStore.ts            Alert list and filter state
│   ├── uiStore.ts                UI preferences (sidebar, theme)
│   └── tenantStore.ts            Current tenant context
├── types/                        TypeScript type definitions
│   ├── api.ts                    API response types (generated from GraphQL schema)
│   ├── grid.ts                   Grid domain types
│   └── tenant.ts                 Tenant and user types
├── hooks/                        Custom React hooks
│   ├── useGridState.ts           Grid state subscription
│   ├── useAlertFeed.ts           Real-time alert feed
│   ├── usePermission.ts          Permission checking hook
│   └── useTenant.ts              Tenant context hook
├── styles/                       Global CSS (minimal — Tailwind-based)
└── public/                       Static assets
```

### State Management

We use **Zustand** for global client state (migrated from Redux in v3.2 — see [ADR-006](/05-engineering/adrs.md#adr-006)) and **TanStack Query** for server state (data fetched from the API).

**The rule:** If the data comes from the API, it lives in TanStack Query. If it is client-only UI state (e.g., which panel is open, what filters are active), it lives in Zustand.

```typescript
// store/gridState.ts
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { GridRegionState, Alert } from '@/types/grid';

interface GridStateStore {
  // Live grid state keyed by region ID
  regionStates: Record<string, GridRegionState>;
  // Active alerts, most recent first
  activeAlerts: Alert[];
  // WebSocket connection status
  connectionStatus: 'connected' | 'connecting' | 'disconnected';

  // Actions
  updateRegionState: (regionId: string, state: GridRegionState) => void;
  addAlert: (alert: Alert) => void;
  dismissAlert: (alertId: string) => void;
  setConnectionStatus: (status: GridStateStore['connectionStatus']) => void;
}

export const useGridStateStore = create<GridStateStore>()(
  subscribeWithSelector((set) => ({
    regionStates: {},
    activeAlerts: [],
    connectionStatus: 'disconnected',

    updateRegionState: (regionId, state) =>
      set((prev) => ({
        regionStates: { ...prev.regionStates, [regionId]: state },
      })),

    addAlert: (alert) =>
      set((prev) => ({
        activeAlerts: [alert, ...prev.activeAlerts].slice(0, 500), // cap at 500
      })),

    dismissAlert: (alertId) =>
      set((prev) => ({
        activeAlerts: prev.activeAlerts.filter((a) => a.id !== alertId),
      })),

    setConnectionStatus: (status) => set({ connectionStatus: status }),
  }))
);
```

```typescript
// hooks/useGridState.ts — TanStack Query for historical data
import { useQuery } from '@tanstack/react-query';
import { graphqlClient } from '@/lib/api/graphql-client';
import { GET_GRID_DASHBOARD } from '@/lib/api/queries/grid';

export function useGridDashboard(regionId: string) {
  return useQuery({
    queryKey: ['grid-dashboard', regionId],
    queryFn: () => graphqlClient.request(GET_GRID_DASHBOARD, { regionId }),
    staleTime: 30_000,      // data considered fresh for 30s
    refetchInterval: 60_000, // background refetch every 60s
    // Real-time updates come via WebSocket; this query is for initial load
    // and periodic reconciliation
  });
}
```

### Real-Time Architecture

The Grid Operations Portal needs near-real-time updates (< 4 seconds from grid event to operator screen). We use WebSocket for this, not polling.

```typescript
// lib/realtime/gridSocketManager.ts
import { io, Socket } from 'socket.io-client';
import { useGridStateStore } from '@/store/gridState';

class GridSocketManager {
  private socket: Socket | null = null;
  private tenantId: string | null = null;

  connect(tenantId: string, authToken: string) {
    this.tenantId = tenantId;
    this.socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token: authToken },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: Infinity,
    });

    this.socket.on('connect', () => {
      useGridStateStore.getState().setConnectionStatus('connected');
      // Subscribe to tenant-scoped channels
      this.socket!.emit('subscribe', { channels: [`grid.state.${tenantId}`, `alerts.${tenantId}`] });
    });

    this.socket.on('grid.state.update', (payload: GridRegionState) => {
      useGridStateStore.getState().updateRegionState(payload.regionId, payload);
    });

    this.socket.on('alert.new', (alert: Alert) => {
      useGridStateStore.getState().addAlert(alert);
    });

    this.socket.on('disconnect', () => {
      useGridStateStore.getState().setConnectionStatus('disconnected');
    });
  }

  disconnect() {
    this.socket?.disconnect();
    this.socket = null;
  }
}

export const gridSocketManager = new GridSocketManager();
```

### GraphQL Client Setup

```typescript
// lib/api/graphql-client.ts
import { ApolloClient, InMemoryCache, createHttpLink, split } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { getSession } from 'next-auth/react';

const httpLink = createHttpLink({
  uri: `${process.env.NEXT_PUBLIC_API_URL}/graphql`,
});

const authLink = setContext(async (_, { headers }) => {
  const session = await getSession();
  return {
    headers: {
      ...headers,
      authorization: session?.accessToken ? `Bearer ${session.accessToken}` : '',
      'x-tenant-id': session?.tenantId ?? '',
    },
  };
});

export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache({
    typePolicies: {
      GridRegion: {
        keyFields: ['id', 'tenantId'],
      },
      Alert: {
        keyFields: ['id'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      errorPolicy: 'all', // Don't throw on partial errors — grid operators need partial data over no data
    },
  },
});
```

### GIS Map Layer

MapLibre GL JS replaced Google Maps in v2.4 (see [ADR-004](/05-engineering/adrs.md#adr-004)). The decision was primarily driven by license cost at our scale, but MapLibre has also proven more flexible for custom grid topology layers.

```typescript
// components/maps/GridMap.tsx
import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useGridStateStore } from '@/store/gridState';
import type { GridAsset } from '@/types/grid';

interface GridMapProps {
  regionId: string;
  onAssetClick?: (asset: GridAsset) => void;
}

export function GridMap({ regionId, onAssetClick }: GridMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const regionState = useGridStateStore((s) => s.regionStates[regionId]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: '/map-styles/helios-grid-dark.json', // self-hosted MapLibre style
      center: [-91.6656, 41.5868], // Default: Cedar Rapids, IA (Midwest Grid Co territory)
      zoom: 9,
    });

    map.current.on('load', () => {
      // Add grid asset sources
      map.current!.addSource('grid-assets', {
        type: 'geojson',
        data: `/api/gis/assets/${regionId}`,
      });

      // Substation layer
      map.current!.addLayer({
        id: 'substations',
        type: 'circle',
        source: 'grid-assets',
        filter: ['==', 'assetType', 'SUBSTATION'],
        paint: {
          'circle-radius': 8,
          'circle-color': [
            'match', ['get', 'status'],
            'HEALTHY', '#22c55e',
            'DEGRADED', '#f59e0b',
            'FAULT', '#ef4444',
            '#6b7280' // unknown
          ],
        },
      });

      // Feeder line layer
      map.current!.addLayer({
        id: 'feeder-lines',
        type: 'line',
        source: 'grid-assets',
        filter: ['==', 'assetType', 'FEEDER'],
        paint: {
          'line-color': ['get', 'statusColor'],
          'line-width': 2,
        },
      });

      map.current!.on('click', 'substations', (e) => {
        const asset = e.features?.[0]?.properties as GridAsset;
        onAssetClick?.(asset);
      });
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, [regionId]);

  // Update asset status colors when grid state changes
  useEffect(() => {
    if (!map.current || !regionState) return;
    const source = map.current.getSource('grid-assets') as maplibregl.GeoJSONSource;
    source?.setData(buildGeoJSON(regionState.assets));
  }, [regionState]);

  return <div ref={mapContainer} className="w-full h-full min-h-[600px]" />;
}
```

### Next.js App Router Patterns

We use the App Router introduced in Next.js 13. Key patterns:

**Server Components for static/initial data:**
```typescript
// app/(auth)/dashboard/page.tsx
// This is a Server Component — runs on the server, no client JS
import { getGridSummary } from '@/lib/api/server/grid';
import { GridDashboardClient } from './GridDashboardClient';

export default async function DashboardPage() {
  // Runs on server — can use server-side auth session
  const initialSummary = await getGridSummary();
  
  return (
    <GridDashboardClient 
      initialData={initialSummary}
      // Client component handles real-time updates and interactions
    />
  );
}
```

**Client Components for interactivity and real-time:**
```typescript
// app/(auth)/dashboard/GridDashboardClient.tsx
'use client';

import { useEffect } from 'react';
import { gridSocketManager } from '@/lib/realtime/gridSocketManager';
import { useSession } from 'next-auth/react';
import { GridMap } from '@/components/maps/GridMap';
import { AlertFeed } from '@/components/alerts/AlertFeed';

export function GridDashboardClient({ initialData }: { initialData: GridSummary }) {
  const { data: session } = useSession();

  useEffect(() => {
    if (session?.accessToken && session?.tenantId) {
      gridSocketManager.connect(session.tenantId, session.accessToken);
    }
    return () => gridSocketManager.disconnect();
  }, [session]);

  return (
    <div className="grid grid-cols-3 h-screen">
      <div className="col-span-2">
        <GridMap regionId={initialData.primaryRegionId} />
      </div>
      <div>
        <AlertFeed />
      </div>
    </div>
  );
}
```

---

## Customer Portal (`helios-customer-portal`)

### Technology Stack

```
React 18 (Vite, SPA — not Next.js)
TypeScript 5.3
TanStack Query 5 (server state)
React Router 6 (client-side routing)
Recharts (usage charts)
@helios/ui (shared component library)
Axios (HTTP client — REST only, no GraphQL)
i18next (internationalization — 8 languages supported)
Vitest + React Testing Library
```

> **Why Vite SPA instead of Next.js?** The Customer Portal is white-labeled and deployed to utility company infrastructure, often behind their own CDN or web application firewall. A pre-built SPA with a `dist/` folder is much simpler for utility companies to host and customize than a Node.js server. See [ADR — Customer Portal Deployment Decision](/05-engineering/adrs.md) (this was discussed in the RFC that led to v2.0 but was not formally recorded as an ADR — technical debt; see [Technical Debt Register — Missing ADRs](/05-engineering/technical-debt-register.md#missing-adrs)).

### White-Labeling System

Each utility customer white-labels the Customer Portal with their own branding. This is handled via a tenant configuration file that overrides CSS variables and logo assets.

```typescript
// src/lib/tenant/tenantConfig.ts
export interface TenantBrandConfig {
  tenantId: string;
  brandName: string;           // "Midwest Grid Co" → shown in header
  primaryColor: string;        // CSS hex — overrides --color-primary
  logoUrl: string;             // Hosted on utility's CDN
  supportPhone: string;
  supportEmail: string;
  demandResponseEnabled: boolean;
  billingIntegration: 'oracle-ccb' | 'sap-is-u' | 'none';
  locale: string;              // 'en-US', 'en-AU', 'da-DK', etc.
  features: {
    showUsageHistory: boolean;
    showBillPrediction: boolean;
    showDemandResponse: boolean;
    showOutageMap: boolean;
  };
}

// Applied at app boot from API:
// GET /api/portal/tenant-config (authenticated with tenant subdomain)
```

---

## Shared Component Library (`@helios/ui`)

### Overview

`@helios/ui` is an internal npm package hosted in GitHub Packages. It is consumed by all three frontend applications. It provides:

- **Design tokens** — colors, spacing, typography (CSS variables)
- **Base components** — Button, Input, Select, Modal, Table, Badge, Toast
- **Domain-aware components** — AlertBadge (uses grid severity colors), StatusIndicator, TenantAvatar
- **Chart components** — thin wrappers around Recharts with Helios color schemes

### Installation

```bash
npm install @helios/ui --registry=https://npm.pkg.github.com
# or add to .npmrc:
# @helios:registry=https://npm.pkg.github.com
```

### Design Tokens

```css
/* Tokens are defined in @helios/ui/tokens.css */
:root {
  /* Grid status colors */
  --color-grid-healthy: #22c55e;
  --color-grid-degraded: #f59e0b;
  --color-grid-fault: #ef4444;
  --color-grid-unknown: #6b7280;
  
  /* Alert severity colors */
  --color-alert-critical: #dc2626;
  --color-alert-high: #ea580c;
  --color-alert-medium: #ca8a04;
  --color-alert-low: #2563eb;
  --color-alert-info: #4b5563;
  
  /* Brand */
  --color-primary: #1e40af;         /* overridden per tenant in Customer Portal */
  --color-primary-hover: #1d4ed8;
  
  /* Typography */
  --font-mono: 'JetBrains Mono', 'Fira Code', monospace;  /* used in telemetry displays */
  --font-sans: 'Inter', system-ui, sans-serif;
}
```

### Component Example

```typescript
// @helios/ui/components/AlertBadge.tsx
import type { AlertSeverity } from '@helios/ui/types';

interface AlertBadgeProps {
  severity: AlertSeverity;
  label?: string;
  count?: number;
}

const severityConfig: Record<AlertSeverity, { label: string; className: string }> = {
  CRITICAL: { label: 'Critical', className: 'bg-[var(--color-alert-critical)] text-white' },
  HIGH:     { label: 'High',     className: 'bg-[var(--color-alert-high)] text-white' },
  MEDIUM:   { label: 'Medium',   className: 'bg-[var(--color-alert-medium)] text-white' },
  LOW:      { label: 'Low',      className: 'bg-[var(--color-alert-low)] text-white' },
  INFO:     { label: 'Info',     className: 'bg-[var(--color-alert-info)] text-white' },
};

export function AlertBadge({ severity, label, count }: AlertBadgeProps) {
  const config = severityConfig[severity];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.className}`}>
      {label ?? config.label}
      {count !== undefined && <span className="font-bold">{count}</span>}
    </span>
  );
}
```

---

## Authentication in the Frontend

Authentication uses **next-auth** in the Grid Operations Portal and a custom OAuth2 PKCE flow in the Customer Portal. See [Authentication](/05-engineering/authentication.md) for the full auth architecture.

Key frontend concern: JWT access tokens expire after 15 minutes. TanStack Query and the Apollo client both handle token refresh transparently by calling `getSession()` which triggers next-auth's rotation.

```typescript
// lib/auth/withAuth.ts — Server Component auth guard
import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth/authOptions';

export async function requireAuth() {
  const session = await getServerSession(authOptions);
  if (!session) {
    redirect('/login');
  }
  return session;
}
```

---

## Performance Considerations

### Grid Operations Portal

- **Virtualization:** Large alert tables use TanStack Table with `useVirtual` — rendering 10,000 rows in the DOM causes fatal performance issues in a real-time updating table. See `components/alerts/VirtualAlertTable.tsx`.
- **Map layer toggling:** The GIS map has 6 configurable layers (substations, feeders, transformers, meters, outage overlays, weather overlays). All layers are loaded upfront but visibility is toggled. Do not lazy-load map layers — the latency of fetching GeoJSON mid-interaction is noticeable.
- **WebSocket message rate:** During high-alert periods, the WebSocket channel can deliver 20+ messages per second. The `gridSocketManager` batches updates using `requestAnimationFrame` to avoid excessive React re-renders.

### Bundle Size

```bash
# Check bundle analysis
npm run analyze
# Opens webpack-bundle-analyzer in browser
```

Current bundle sizes (gzip):
- Main bundle: 187 KB
- Map chunk (MapLibre): 342 KB (lazy loaded — only when /grid route is active)
- Charts chunk: 48 KB

---

## Testing Strategy

### Unit and Component Tests (Vitest + React Testing Library)

```bash
npm run test           # run all tests
npm run test:watch     # watch mode
npm run test:coverage  # coverage report
```

Coverage target: 80% for components in `components/` and `hooks/`. Do not write tests for Next.js page files — test the components they render.

### E2E Tests (Playwright)

```bash
npm run e2e            # run against local dev server
npm run e2e:staging    # run against staging environment
```

E2E tests cover the 10 critical user journeys:
1. Login and dashboard load
2. Alert acknowledgment
3. Grid map: click substation → view details
4. Outage drill-down
5. Dispatch work order from outage
6. Demand forecast view
7. Customer portal: view usage history
8. Customer portal: enroll in demand response
9. Report generation
10. User management (tenant admin)

---

## Common Mistakes

1. **Using `useEffect` to sync server state into Zustand** — This leads to double-fetching and cache invalidation bugs. Server data belongs in TanStack Query. See [Coding Standards — React Patterns](/05-engineering/coding-standards.md#react-patterns).

2. **Forgetting `'use client'` on interactive components** — The App Router defaults to Server Components. If a component uses `useState`, `useEffect`, or browser APIs, it needs `'use client'`. This causes confusing hydration errors.

3. **Reading grid state from GraphQL instead of the Zustand store** — If you query `gridRegionState` via GraphQL in a component that also subscribes to real-time updates, you will get stale data displayed alongside real-time data. The live state lives in the Zustand store. Use `useGridStateStore`.

4. **Adding a new `@helios/ui` component without updating Storybook** — All components in the shared library require a Storybook story. CI will fail without it.

5. **Hardcoding tenant-specific strings** — The portal is multi-tenant. Strings that vary by tenant (company name, support contact, regulatory labels) must come from `useTenant().config`, not be hardcoded.

---

*Document maintained by @ana.lima (Grid UI) and @sofia.marchetti (Customer Experience)*  
*Next review: Q1 2025 post Next.js 15 evaluation*  
*Related: [Backend Architecture](/02-architecture/backend-architecture.md) · [Coding Standards](/05-engineering/coding-standards.md) · [API Standards](/05-engineering/api-standards.md)*
