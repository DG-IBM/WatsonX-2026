# Frequently Asked Questions (Engineering)

**Owner:** Priya Nair (Developer Experience)
**Last Updated:** 2024-11-10
**Format:** Contributed by many engineers — see individual attributions. If you have a question that isn't here and the answer is useful, add it.
**Related Docs:** [New Engineer First Week Guide](/07-onboarding/new-engineer-first-week.md) · [Glossary](/07-onboarding/glossary.md) · [Known Issues](/05-engineering/known-issues.md) · [Coding Standards](/05-engineering/coding-standards.md)

---

> **Priya:** This FAQ is only useful if it stays current. I do a sweep every quarter but I miss things. If you ask a question in Slack and someone gives you a good answer, please add it here. Same if you encounter something confusing that this document could have prevented.

---

## Contents

- [Architecture & System Questions](#architecture--system-questions)
- [Development Environment](#development-environment)
- [Code & PRs](#code--prs)
- [Deployments & CI/CD](#deployments--cicd)
- [Production & Incidents](#production--incidents)
- [Data & Database](#data--database)
- [AI/ML Questions](#aiml-questions)
- [IoT & Grid](#iot--grid)
- [Process & Culture](#process--culture)
- [Career & Growth](#career--growth)

---

## Architecture & System Questions

**Q: How many customers do we actually have? The docs seem to give different numbers.**

*A: 14 as of November 2024 — all utility companies, no direct end-consumers. The confusion is because some older docs were written when we had 8-10 customers. See [Business Context](/01-company/business-context.md) for the authoritative count. — David O.*

---

**Q: What's the difference between `helios-api`, `helios-grid-services`, and `helios-portal`?**

*A: `helios-api` is the main REST/GraphQL API layer — Node.js, handles customer-facing business logic, authentication, and orchestration. `helios-grid-services` contains the Go microservices: the IoT ingestion service, grid event processor, outage detection, and the forecasting engine. `helios-portal` is the Next.js frontend that both our customers and internal operators use. They're separate repos with separate deploy pipelines that communicate via the API. — Priya N.*

---

**Q: Why do we use both REST and GraphQL? Which should I use for a new feature?**

*A: Historical accident, partially. The original API was REST. When we built the customer-facing portal v2 in 2022, the frontend team was strong advocates for GraphQL because of the flexibility for the complex nested data structures in the portal (grid topology, meter hierarchies). We now have GraphQL for the customer portal, and REST for IoT devices, the dispatch mobile app, and external integrations. For new features: if it's portal-facing and involves querying relational grid data, GraphQL. If it's a machine-to-machine integration or a simple operational endpoint, REST. When in doubt, ask David Okafor or Priya Nair. See [API Standards](/05-engineering/api-standards.md). — David O.*

---

**Q: What is the "Go event processing" layer and why is it separate from the Node.js API?**

*A: The Grid Intelligence team processes up to 380,000 events per second at peak. Node.js handles this poorly at that throughput — the event loop doesn't parallelize well for CPU-bound stream processing. We use Go for the high-throughput event processing pipeline: IoT ingestion → Kafka → event processor → TimescaleDB / outage detection. The Node.js layer sits on top and handles the application-level logic. See [Event-Driven Architecture](/02-architecture/event-driven-architecture.md) and [ADR-003](/05-engineering/adrs.md) for the decision context. — Chidi E.*

---

**Q: I keep seeing "TimescaleDB" — is that different from PostgreSQL?**

*A: TimescaleDB is a PostgreSQL extension that makes time-series data performant. Conceptually it's PostgreSQL — you use standard SQL, the same psql client, the same Aurora service. It adds hypertables (automatically partitioned time-series tables) and some time-series-specific functions. Grid telemetry data (meter readings, grid events) lives in TimescaleDB hypertables. Application data (users, customers, configuration) lives in regular PostgreSQL tables. They're in the same database cluster. See [Database Architecture](/02-architecture/database-architecture.md). — Rosa L.*

---

**Q: What is Kafka used for? Can I use it directly for my feature?**

*A: Kafka is the backbone of our event-driven architecture — it carries IoT telemetry from devices through to processing, outage detection events, dispatch notifications, and more. It's optimised for high-throughput append-only event streaming. You probably shouldn't introduce new Kafka topics for application-level features without talking to David Okafor first — there's operational overhead and we want to maintain clean topic design. For in-service async work, Redis queues or simple DB polling might be more appropriate. See [Event-Driven Architecture](/02-architecture/event-driven-architecture.md). — David O.*

---

## Development Environment

**Q: `docker-compose up` hangs or fails with permission errors on my Mac.**

*A: The most common cause is Docker Desktop not having full disk access. Go to System Settings → Privacy & Security → Full Disk Access and ensure Docker Desktop is listed. Restart Docker Desktop after adding it. If it still fails, check if your CPU architecture is causing image compatibility issues — see the "Apple Silicon" note in the first week guide. — Priya N.*

---

**Q: AWS commands fail with "The SSO session associated with this profile has expired or is otherwise invalid".**

*A: Your SSO token has expired (8-hour TTL). Run `aws sso login --profile helios-dev` to refresh. You can add this alias to your shell profile: `alias aws-refresh='aws sso login --profile helios-dev'`. — Deepak M.*

---

**Q: How do I get access to the staging Kubernetes cluster?**

*A: You should have this from Day 1 if your access was provisioned. Run `aws eks update-kubeconfig --name helios-staging-eu-west-1 --region eu-west-1`. If you get an access denied error, raise an IT request in Jira (IT project → "Access Request") — it takes 1 business day. — Rosa L.*

---

**Q: The frontend dev server is really slow (>10 seconds for hot reload). Is this normal?**

*A: It was, but we fixed most of it in v4.5. If you're on the latest `main` branch, hot reload should be under 3 seconds. If it's not, check: (1) you're using `npm run dev` not `next dev`, (2) you don't have an old `.next` cache — try `rm -rf .next && npm run dev`. If it's still slow, check `#developer-experience` — this is a known intermittent issue. — Priya N.*

---

**Q: Can I connect to the staging database directly?**

*A: Not directly from your laptop. Access is via RDS Proxy for security. Use the AWS console "Query Editor" for one-off queries (role: `HeliosStagingDeveloper`), or use the database migration scripts and seeds for test data setup. If you need a database shell for debugging, ask Rosa Lindqvist — it requires a specific approved access process. Production: same process, requires SRE or Principal Engineer level. — Rosa L.*

---

## Code & PRs

**Q: How long should I wait before merging a PR with only one approval?**

*A: Our policy requires at least one approval from someone with context in the area you're changing. For small, self-contained changes with clear test coverage, one approval and 24 hours is fine. For anything touching API contracts, the database schema, or shared infrastructure code, you should get at least one review from a relevant principal/staff engineer and wait 48 hours to allow for asynchronous review. See [Git Workflow](/05-engineering/git-workflow.md). — Priya N.*

---

**Q: My PR checks are failing on linting but the code looks right. What's happening?**

*A: First, run `npm run lint` locally — sometimes CI uses a slightly different eslint config path. If the lint rules seem wrong or overly strict, check if the issue is with the rule itself (it might be a rule we've been meaning to relax — check `#pr-reviews`). If you think the rule is wrong, open a separate PR to discuss the linting config change. Don't just add `// eslint-disable-next-line`. — Priya N.*

---

**Q: Can I commit directly to `main`?**

*A: No. Branch protection is enforced on both `main` and `develop`. All changes go through pull requests. This is non-negotiable and has been since approximately v2.0 (2021). Direct pushes will be rejected. — Priya N.*

---

**Q: What size PRs are acceptable? I have a big change.**

*A: Split big changes into smaller PRs where possible. A good target is <400 lines changed per PR. We know this isn't always feasible (database migrations, large refactors), but reviewers will give better feedback on focused changes. If you have a large change, consider: (1) opening a draft PR early for architectural discussion before implementing, (2) splitting into a preparatory PR (infra) and an implementation PR. — Chidi E.*

---

## Deployments & CI/CD

**Q: How do I deploy to staging?**

*A: Merge to `develop` branch triggers an automatic staging deployment. No manual action needed. The deployment takes about 8–12 minutes end-to-end. Watch progress in `#deployments` Slack channel. You can also trigger a manual staging deploy via the GitHub Actions UI on the repo. — Priya N.*

---

**Q: How do I deploy to production?**

*A: You don't — not directly. Production deployments are triggered by creating a release in GitHub or by the release manager (usually a senior engineer or team lead) running the release pipeline. Production deploys require SRE sign-off for significant changes. During your first 90 days, you won't be deploying to production directly. See [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md). — Priya N.*

---

**Q: My deployment passed CI but the pod is crash-looping in staging. What do I do?**

*A: First, check the logs: `kubectl logs -n helios-staging -l app=your-service-name --tail=100`. The most common causes are: (1) missing/wrong environment variable, (2) failed health check (check the readiness probe path), (3) startup error being caught by a crash loop. Also check `kubectl describe pod` for OOMKilled or other failure reasons. If you can't fix it in 30 minutes, ask in `#helios-team`. Don't leave staging broken. — Rosa L.*

---

**Q: How do feature flags work?**

*A: We use LaunchDarkly for feature flags. The SDK is integrated in both the Next.js portal and the Node.js API. Feature flags allow gradual rollout, A/B testing, and emergency kill switches. To add a new feature flag, register it in the LaunchDarkly console (access via Okta SSO) and use the SDK: `client.variation('my-new-feature-flag', context, false)`. Document new flags in the relevant service's `FEATURE_FLAGS.md` file. — Mateus C.*

---

## Production & Incidents

**Q: I got paged! What do I do?**

*A: Don't panic. Acknowledge the PagerDuty alert within your target window (5 min for SEV-1, 15 min for SEV-2). Post "I'm taking this — investigating" in `#incidents`. Then follow the [Incident Response Runbook](/06-operations/incident-response-runbook.md). If it's your first time being paged for something serious, your secondary is there to support you. You're not alone. — Marcus W.*

---

**Q: New engineers shouldn't be paged, right?**

*A: Correct. You won't be on the primary on-call rotation for your first 90 days. You won't be added until you've completed the on-call certification checklist (see [On-Call Rotation Guide](/06-operations/on-call-rotation-guide.md)). If you're getting paged before then, there's a misconfiguration in PagerDuty — contact Marcus Webb immediately. — Marcus W.*

---

**Q: What is the Kafka consumer lag and why does everyone get stressed about it?**

*A: Kafka consumer lag is the number of unprocessed messages sitting in a Kafka topic waiting for a consumer to process them. Normal lag for our grid event consumer is <1,000 messages. When a consumer has a bug, is slow, or crashes, lag starts growing. At 500,000 messages lag, grid monitoring data is noticeably stale. At millions of messages lag, we start losing real-time situational awareness of the grid — which is a grid safety concern. That's why it triggers a SEV-1 alert. — David O.*

---

## Data & Database

**Q: I accidentally ran a DELETE without a WHERE clause on staging. What do I do?**

*A: First, don't panic — staging is recoverable. Message Marcus Webb or Rosa Lindqvist in Slack immediately. Staging has automated snapshots every 4 hours, so data recovery is feasible. For the future: always run database modifications in a transaction you can roll back first (`BEGIN;`, check results, then `COMMIT` or `ROLLBACK`). — Rosa L.*

---

**Q: How do I add a new database migration?**

*A: We use [db-migrate](https://db-migrate.readthedocs.io/) for Node.js services and a custom migration runner for Go services. For the main application database: `npm run db:migrate:create -- --name describe-your-change`. This creates a timestamped migration file in `db/migrations/`. Write both `up` and `down` migration scripts. Migrations run automatically on deployment. Test your migration against the staging database before merging. Important: migrations should be backward-compatible with the previous version of the application (we deploy with zero downtime and the old code will be briefly running against the new schema). See [Database Architecture](/02-architecture/database-architecture.md#migrations). — Rosa L.*

---

**Q: Why is the grid_readings table so big? How does it stay manageable?**

*A: `grid_readings` is a TimescaleDB hypertable partitioned by time (weekly chunks). We have 42 million meters reporting every 15 minutes. That's a lot of data. TimescaleDB automatically handles the partitioning. We have automated compression (chunks older than 7 days get compressed) and automated retention (chunks older than 7 years are dropped per regulatory requirements). Don't query the full table without a time range filter — it will kill performance. See [Database Architecture](/02-architecture/database-architecture.md) and [Performance Bottleneck PB-001](/05-engineering/performance-bottlenecks.md). — David O.*

---

## AI/ML Questions

**Q: Where do the AI demand forecasts come from?**

*A: The demand forecasting engine is a Python-based ML service running in Kubernetes. It uses an ensemble of models (Temporal Fusion Transformer + XGBoost) trained on historical meter data, weather data, and calendar features. The training happens on a dedicated ML training cluster (separate from the main EKS cluster). Models are served via a FastAPI endpoint that the grid API calls. Forecasts are cached in Redis with a 5-minute TTL. See [AI Forecasting Engine](/03-services/ai-forecasting-engine.md). — Lin C.*

---

**Q: Can I use real customer data to test or develop ML features?**

*A: No. This is a GDPR/contractual constraint. The ML team uses: (1) synthetic data generated from statistical distributions of real data, (2) anonymised aggregated data where individual households cannot be identified. The synthetic data generator is in `helios-grid-services/tools/synthetic-data-gen`. Never use real customer data in development or testing environments. If you have a use case where you think you need real data, talk to Lin Chen and Yasmin Osei first. — Lin C.*

---

## IoT & Grid

**Q: How many IoT devices do we actually manage?**

*A: As of November 2024, approximately 42 million smart meters across our customer fleet, plus several thousand substations, renewable energy assets (wind/solar farms), and battery storage units. The 42M figure covers end-consumer smart meters managed on behalf of our utility customers. The substation and generator devices are fewer but more complex. See [IoT Device Management](/03-services/iot-device-management.md). — Lars E.*

---

**Q: What protocol do the IoT devices use to communicate?**

*A: It depends on the device type. Smart meters primarily use MQTT over TLS via AWS IoT Core. Substation RTUs (Remote Terminal Units) use a mix of MQTT and some legacy MODBUS-over-TCP bridges that Lars Eriksson is working to replace. Newer devices (2023+ vintage) support both MQTT and HTTPS. See [IoT Device Management](/03-services/iot-device-management.md#protocols). — Lars E.*

---

**Q: What happens if an IoT device sends bad data?**

*A: The IoT ingest service validates incoming messages against an Avro schema. Messages that fail schema validation are sent to a dead-letter queue (`grid.telemetry.dlq`) and logged. Valid but anomalous readings (e.g., a meter suddenly reporting 10x its normal consumption) are flagged by the anomaly detection layer but are still processed and stored — we don't drop data. The outage detection service uses statistical methods to separate genuine anomalies from sensor noise. — Chidi E.*

---

## Process & Culture

**Q: How formal is the sprint/scrum process? Do we do daily standups?**

*A: It varies by team. Grid Intelligence does 2-week sprints with planning, retrospective, and daily standup. Platform Engineering does kanban with weekly sync instead of daily standup. Customer Experience is transitioning. Ask your manager/buddy what your specific team does. Don't assume — the docs don't fully reflect every team's current practice. — Elena V.*

---

**Q: How do I propose an architectural change?**

*A: For small changes (within a service, affecting no other teams): just do it, document it in the PR. For medium changes (affecting multiple services or API contracts): write a short RFC (Request for Comments) doc in Confluence, post it in `#engineering` and give 48 hours for comment. For large changes (new services, major infrastructure, cross-team): write an ADR (Architecture Decision Record) and bring it to the monthly Architecture Review Board. See [Architecture Decision Records](/05-engineering/adrs.md). — David O.*

---

**Q: What's the policy on using AI coding assistants (Copilot, Cursor, etc.)?**

*A: Personal use is fine and common on the team. GitHub Copilot is company-licensed and available for all engineers (set up via GitHub org settings). When using AI assistants: (1) you are responsible for reviewing and understanding all AI-generated code before committing, (2) never paste customer data, credentials, or internal architecture details into public AI tools, (3) AI-generated code goes through the same code review process as human-written code. This policy may be updated — watch `#engineering` for changes. — Yasmin O.*

---

**Q: I disagree with a technical decision that was already made. What do I do?**

*A: Technical disagreements are healthy. The right approach: (1) Check if there's an ADR explaining the decision — it might address your concern, (2) If not, raise it in the relevant team's Slack channel or sync meeting. Be specific about the problem you see and what you'd propose instead, (3) If it's a major architectural concern, write up your thinking in Confluence and bring it to the Architecture Review Board. We've reversed decisions when given good arguments — see ADR-008 (revised approach to notification delivery). We don't change things just because someone dislikes them, but good technical arguments are always welcome. — David O.*

---

## Career & Growth

**Q: What does the career ladder look like for engineers at Lumina?**

*A: L1 (Junior) → L2 (Mid) → L3 (Senior) → L4 (Staff) → L5 (Principal). There's also a management track: Senior → Engineering Manager → Director → VP. The ladders are documented in Confluence (HR workspace, not public — ask your manager for access). Promotions happen twice a year (January and July) and require a conversation with your manager starting 2 cycles in advance. — Elena V.*

---

**Q: How do I get involved in on-call before I'm required to?**

*A: Shadow on-call. Tell Marcus Webb you're interested — he'll add you to the PagerDuty schedule as a shadow (you'll see the alerts but won't be paged). The certification checklist (in the On-Call Rotation Guide) also has a voluntary shadowing component. Engineers who volunteer for on-call before being required often get the certification done faster and have a better time because they're mentally prepared. — Marcus W.*

---

**Q: Are there learning & development resources available?**

*A: Yes. Each engineer gets £/€1,500 per year for conferences, courses, and books (L&D budget in Workday). Lumina also has corporate licenses for O'Reilly Learning and a few training platforms. Engineering-specific courses relevant to Helios work (Kafka, Kubernetes, AWS certifications) are often partially or fully reimbursed beyond the standard L&D budget — discuss with your manager. There's also an internal #learning channel for book clubs and knowledge sharing sessions. — Elena V.*

---

*Something missing? Add it: raise a PR against this file or post in `#developer-experience` and Priya Nair will add it.*
