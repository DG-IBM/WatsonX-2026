# Coding Standards — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → Coding Standards  
> **Owner:** Priya Nair (Staff Engineer, Platform) · @priya.nair  
> **Co-authored:** David Okafor · @david.okafor · Ana Lima · @ana.lima  
> **Last Updated:** 2024-10-01  
> **Status:** Active — enforced via linters in CI  
> **Related:** [Git Workflow](/05-engineering/git-workflow.md) · [API Standards](/05-engineering/api-standards.md) · [Logging Standards](/04-platform/logging-standards.md) · [Monitoring & Observability](/04-platform/monitoring-observability.md)

---

> *"Code is read far more often than it is written. Write for the next engineer, not for the compiler."*  
> — quoted in our engineering onboarding since v1.0

---

## Language Standards Summary

| Language | Runtime | Services | Linter | Formatter |
|---|---|---|---|---|
| Go 1.22 | Hot-path services | grid-monitor, iot-bridge, outage-detect, gis, forecasting-server | `golangci-lint` | `gofmt` |
| TypeScript 5.3 | API gateway, Node services, frontend | api-gateway, dispatch, notify, portal, customer-portal | `eslint` | `prettier` |
| Python 3.11 | ML / data | forecasting-training, data-pipeline, model-ops | `ruff` | `black` |
| SQL | All databases | Migrations, queries | `sqlfluff` | — |

All linters run in CI on every PR. A failing lint check blocks merge. There are no exceptions to linting — if the linter is wrong, fix the linter config in a separate PR.

---

## Go Standards

### Naming

Follow Go community conventions:

```go
// Package names: lowercase, single word, no underscores
package gridmonitor   // ✅
package grid_monitor  // ❌
package GridMonitor   // ❌

// Exported identifiers: PascalCase
type MeterReading struct { ... }   // ✅
func (s *Service) ProcessReading() // ✅

// Unexported identifiers: camelCase
type alertCache struct { ... }
func (s *Service) buildKey() string

// Acronyms: capitalize consistently (ID, URL, HTTP, not Id, Url, Http)
type GridID string   // ✅
type GridId string   // ❌
```

### Error Handling

```go
// Always wrap errors with context. Never swallow errors.
func (s *Service) GetDevice(ctx context.Context, deviceID string) (*Device, error) {
    device, err := s.registry.Get(ctx, deviceID)
    if err != nil {
        return nil, fmt.Errorf("GetDevice: lookup failed for device %s: %w", deviceID, err)
    }
    return device, nil
}

// Use errors.Is and errors.As for error type checking
if errors.Is(err, ErrDeviceNotFound) {
    // handle not found
}

// Define sentinel errors in the package where they originate
var (
    ErrDeviceNotFound = errors.New("device not found")
    ErrTenantMismatch = errors.New("device does not belong to this tenant")
)

// Do NOT use panic for recoverable errors. panic is only for programmer errors
// (e.g., nil pointer from incorrect assumptions about data invariants).
```

### Context Propagation

```go
// Context is always the first parameter. Never store context in a struct.
func (s *Service) Process(ctx context.Context, reading MeterReading) error { // ✅

type Service struct {
    ctx context.Context  // ❌ never do this
}

// Always check ctx.Done() in long-running loops
func (c *Consumer) processLoop(ctx context.Context) {
    for {
        select {
        case <-ctx.Done():
            return  // Graceful shutdown
        case msg := <-c.messages:
            c.process(ctx, msg)
        }
    }
}
```

### Concurrency

```go
// Mutexes: name the mutex after what it protects, suffix _mu
type StateManager struct {
    stateMu sync.RWMutex
    state   map[string]*GridState
}

// Use sync.RWMutex when reads vastly outnumber writes (grid state is read-heavy)
func (m *StateManager) Get(tenantID string) *GridState {
    m.stateMu.RLock()
    defer m.stateMu.RUnlock()
    return m.state[tenantID]
}

// Goroutines: always pass context; always have a done channel or WaitGroup
go func(ctx context.Context) {
    defer wg.Done()
    // ...
}(ctx)

// Never leak goroutines. Always ensure every started goroutine has an exit path.
```

### Testing

```go
// Table-driven tests are preferred
func TestAlertEvaluator_Evaluate(t *testing.T) {
    tests := []struct {
        name       string
        reading    MeterReading
        rules      []AlertRule
        wantAlerts int
        wantLevel  string
    }{
        {
            name:       "voltage above threshold triggers HIGH alert",
            reading:    MeterReading{Voltage: ptr(138.0)},
            rules:      []AlertRule{{Operator: "GT", Threshold: 132, Severity: "HIGH"}},
            wantAlerts: 1,
            wantLevel:  "HIGH",
        },
        {
            name:       "voltage within threshold triggers no alert",
            reading:    MeterReading{Voltage: ptr(120.0)},
            rules:      []AlertRule{{Operator: "GT", Threshold: 132, Severity: "HIGH"}},
            wantAlerts: 0,
        },
    }

    for _, tt := range tests {
        t.Run(tt.name, func(t *testing.T) {
            evaluator := NewAlertEvaluator(tt.rules)
            alerts := evaluator.Evaluate(tt.reading)
            assert.Len(t, alerts, tt.wantAlerts)
            if tt.wantAlerts > 0 {
                assert.Equal(t, tt.wantLevel, alerts[0].Severity)
            }
        })
    }
}

// Tests must not call external services. Use interfaces and fakes/mocks.
// testify/assert and testify/require are the approved assertion libraries.
```

### golangci-lint Configuration

```yaml
# .golangci.yml
linters:
  enable:
    - errcheck      # Check all errors are handled
    - govet         # Go vet checks
    - ineffassign   # Detect ineffectual assignments
    - staticcheck   # Staticcheck suite
    - unused        # Find unused code
    - gocyclo       # Cyclomatic complexity (max 15)
    - goconst       # Find repeated string constants
    - misspell      # Spelling mistakes
    - revive        # Go linter (replaces golint)
    - gosec         # Security checks

linters-settings:
  gocyclo:
    min-complexity: 15
  goconst:
    min-len: 3
    min-occurrences: 3
```

---

## TypeScript Standards

### Strict TypeScript Configuration

```json
// tsconfig.json (shared base)
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext"
  }
}
```

### Naming Conventions

```typescript
// Interfaces: PascalCase, no I prefix
interface MeterReading { ... }           // ✅
interface IMeterReading { ... }          // ❌

// Types: PascalCase
type AlertSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFO';

// Constants: SCREAMING_SNAKE_CASE
const MAX_RETRY_ATTEMPTS = 3;
const KAFKA_CONSUMER_GROUP_ID = 'helios-api-gateway';

// Functions/variables: camelCase
function processAlertEvent(event: AlertEvent): void { ... }
const activeAlerts = getActiveAlerts();

// Files: kebab-case
// alert-processor.ts, grid-state-manager.ts
// Components (React): PascalCase
// AlertBadge.tsx, GridMap.tsx
```

### Null Safety

```typescript
// Use optional chaining and nullish coalescing
const label = alert?.metadata?.label ?? 'Unknown';

// Use type guards instead of type assertions
function isGridAlert(event: unknown): event is GridAlert {
  return typeof event === 'object' &&
    event !== null &&
    'alertId' in event &&
    'severity' in event;
}

// Avoid non-null assertions (!) — they lie to the compiler
const value = maybeNull!.property;  // ❌ — explain why it can't be null, or handle it
const value = maybeNull?.property ?? defaultValue;  // ✅
```

### React Patterns (Frontend)

```typescript
// Prefer function components, no class components
// Use hooks for state and side effects

// Custom hooks: prefix with "use"
function useGridState(regionId: string) { ... }

// Props: define with explicit interface
interface AlertBadgeProps {
  severity: AlertSeverity;
  count?: number;
  className?: string;
}

// Memoization: use judiciously — profile before adding React.memo/useMemo
// Don't prematurely memoize every component

// Event handlers: name on{Event} in props, handle{Event} in implementation
interface ButtonProps {
  onClick: () => void;  // ✅
  handleClick: () => void;  // ❌
}

// Server Components (Next.js): async by default, no hooks
async function DashboardPage({ params }: { params: { regionId: string } }) {
  const data = await fetchGridData(params.regionId);
  return <DashboardClient initialData={data} />;
}
```

### ESLint Configuration

```json
// .eslintrc.json
{
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/strict",
    "plugin:react-hooks/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "no-console": ["warn", { "allow": ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error"
  }
}
```

---

## SQL Standards

### Naming

```sql
-- Tables: snake_case, plural nouns
CREATE TABLE grid_alerts ( ... );    -- ✅
CREATE TABLE GridAlert ( ... );      -- ❌

-- Columns: snake_case
tenant_id, created_at, device_id     -- ✅
tenantId, CreatedAt, DeviceID        -- ❌

-- Indexes: idx_{table}_{columns}
CREATE INDEX idx_grid_alerts_tenant_status ON grid_alerts(tenant_id, status);

-- Foreign keys: fk_{child_table}_{parent_table}
ALTER TABLE grid_alerts ADD CONSTRAINT fk_grid_alerts_tenants
  FOREIGN KEY (tenant_id) REFERENCES tenants(id);
```

### Query Standards

```sql
-- Always include tenant_id filter first (uses the index efficiently)
SELECT * FROM grid_alerts
WHERE tenant_id = $1          -- ✅ tenant filter first
  AND status = 'OPEN'
  AND severity = 'CRITICAL';

-- Use explicit column lists, never SELECT *
SELECT id, tenant_id, severity, message, created_at
FROM grid_alerts
WHERE tenant_id = $1;

-- Always use parameterized queries. Never concatenate user input into SQL.
-- In Go (pgx):
rows, err := pool.Query(ctx,
    "SELECT id FROM grid_alerts WHERE tenant_id = $1 AND status = $2",
    tenantID, status)
```

### Migration Standards

```sql
-- Migrations: numbered, descriptive, forward-only
-- V124__add_alert_escalation_timestamp.sql

-- Adding a column: make it nullable first (zero-downtime deploy compatibility)
ALTER TABLE grid_alerts ADD COLUMN escalated_at TIMESTAMPTZ;

-- Adding an index: use CONCURRENTLY (no table lock)
CREATE INDEX CONCURRENTLY idx_grid_alerts_escalated_at
  ON grid_alerts(tenant_id, escalated_at)
  WHERE escalated_at IS NOT NULL;

-- Comments on tables and columns
COMMENT ON TABLE grid_alerts IS 'Active and historical grid alerts generated by the grid monitor service';
COMMENT ON COLUMN grid_alerts.severity IS 'CRITICAL | HIGH | MEDIUM | LOW | INFO';
```

---

## Python Standards (ML / Data)

Python code is primarily in `helios-model-ops` and `helios-data-pipeline`.

```python
# Type hints: required for all function signatures
def compute_mape(
    forecast_df: pd.DataFrame,
    actuals_df: pd.DataFrame,
    exclude_below_mw: float = 10.0,
) -> dict[str, float]:
    ...

# Dataclass for data containers (not dict)
@dataclass
class ModelEvaluationResult:
    mape: float
    mae: float
    rmse: float
    n_samples: int
    model_version: str

# No mutable default arguments
def process(items: list[str] | None = None) -> list[str]:  # ✅
    items = items or []
    ...

def process(items: list[str] = []) -> list[str]:  # ❌ mutable default

# Ruff configuration (replaces flake8 + isort + pyupgrade)
# pyproject.toml:
# [tool.ruff]
# select = ["E", "F", "UP", "B", "I"]
# target-version = "py311"
# line-length = 100
```

---

## General Rules for All Languages

### Comments and Documentation

```go
// Good: explains WHY, not WHAT
// We use a 30-second cooldown to prevent alert storms during voltage fluctuations
// that are common during rapid load changes. Without this, a single brief overvoltage
// event can generate hundreds of duplicate alerts.
const defaultCooldownMs = 30_000

// Bad: explains WHAT (the code already shows what)
// Set cooldown to 30000
const defaultCooldownMs = 30_000
```

```typescript
/**
 * Fetches the grid state for a region.
 *
 * Note: This reads from Redis (< 1ms), not TimescaleDB.
 * The Redis state may be up to 5 seconds stale — this is intentional and documented.
 * If you need historical data, use getGridHistory() instead.
 */
async function getGridState(tenantId: string, regionId: string): Promise<GridState>
```

### Tenant ID — Zero Tolerance

Every function, method, or handler that reads or writes data for a specific tenant **must** accept `tenantId` as a parameter and apply it to every query, cache key, and Kafka message. This is not negotiable and not optional. Code review will block any PR that touches tenant data without explicit `tenantId` filtering.

### No Dead Code in Main Branches

Commented-out code, unused variables, and dead functions are not committed to `main`. If you need to preserve something temporarily, open a feature branch. `golangci-lint`'s `unused` linter and TypeScript's `noUnusedLocals` enforce this automatically.

---

## Things Every New Engineer Should Know

1. **Linters are not optional.** If you're fighting the linter, there is usually a good reason the rule exists. Read the lint error before disabling it. If you need to disable a rule, add a comment explaining why.

2. **`any` in TypeScript is a code smell.** It defeats type safety. Use `unknown` and type guards instead. PRs with `any` types need explicit justification.

3. **SQL migrations are permanent.** You can never run a down migration in production. Every migration must be safe to run on a live database with live traffic. If in doubt, ask @lin.chen or @wei.liu.

4. **Error wrapping in Go is load-bearing.** When an error propagates up through 5 layers of calls with wrapping at each level, you get a beautiful error chain that tells you exactly where something went wrong. When engineers skip wrapping, you get `"redis: connection refused"` with no context about which operation triggered it.

5. **Test your test.** After writing a unit test, verify it actually catches the bug you think it catches by temporarily breaking the code and checking the test fails. A test that never fails isn't testing anything.

---

*Document maintained by @priya.nair, @david.okafor, and @ana.lima*  
*Language-specific questions: Go → @david.okafor; TypeScript/React → @ana.lima; Python → @lin.chen; SQL → @wei.liu*  
*Related: [Git Workflow](/05-engineering/git-workflow.md) · [API Standards](/05-engineering/api-standards.md) · [Logging Standards](/04-platform/logging-standards.md)*
