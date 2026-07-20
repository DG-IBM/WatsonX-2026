# Git Workflow — Helios

> **Location:** Confluence → Helios Engineering Space → Engineering → Git Workflow  
> **Owner:** Priya Nair (Staff Engineer, Platform) · @priya.nair  
> **Last Updated:** 2024-09-20  
> **Status:** Active — enforced via branch protection rules  
> **Related:** [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md) · [Coding Standards](/05-engineering/coding-standards.md) · [Deployment Guide](/supplemental/deployment-guide.md)

---

## Branch Strategy

Helios uses a **trunk-based development** model with short-lived feature branches. There is one long-lived branch: `main`. Everything else is temporary.

```
main                  ← production-ready code always lives here
├── feat/GRID-447-alert-escalation          (short-lived: 1–5 days)
├── fix/PLAT-892-redis-connection-timeout   (short-lived: 1–3 days)
├── chore/upgrade-go-1.22.3                 (short-lived: < 1 day)
└── release/v4.8.0                          (release branch: branch off main, merge back)
```

### Branch Naming Convention

```
{type}/{jira-ticket}-{short-description}

Types:
  feat/     New feature
  fix/      Bug fix
  chore/    Non-functional: dependency updates, refactors, documentation
  test/     Adding or fixing tests
  hotfix/   Emergency production fix (same naming, see Hotfix section)
  release/  Release branch (release/v4.8.0)
  wip/      Work in progress — PRs against these are draft by default

Examples:
  feat/GRID-447-alert-escalation-logic
  fix/PLAT-892-redis-reconnect-on-timeout
  chore/GRID-448-update-golangci-lint
  hotfix/PLAT-901-critical-kafka-producer-deadlock
```

### Why Trunk-Based?

We tried GitFlow for the first 6 months (2020–2021). It caused:
- Long-lived feature branches that diverged from main and created painful merges
- "Integration hell" when multiple teams merged simultaneously
- Delayed feedback loops (bugs caught late because branches were isolated)

Trunk-based development with feature flags and short-lived branches solved these problems. See [Project Timeline — 2021 Q1 GitFlow Migration](/supplemental/project-timeline-history.md#2021-gitflow-migration).

---

## Commit Conventions

All commits must follow the **Conventional Commits** specification. This is enforced by a `commitlint` hook in CI.

```
{type}({scope}): {description}

[optional body]

[optional footer]
```

### Types

| Type | When to Use |
|---|---|
| `feat` | A new feature |
| `fix` | A bug fix |
| `perf` | Performance improvement |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test` | Adding or correcting tests |
| `chore` | Build system, deps, CI config changes |
| `docs` | Documentation changes |
| `style` | Formatting, whitespace (no logic change) |
| `revert` | Reverting a previous commit |

### Scopes (examples)

| Scope | Service/Area |
|---|---|
| `grid-monitor` | helios-grid-monitor service |
| `iot-bridge` | helios-iot-bridge service |
| `api-gateway` | helios-api-gateway service |
| `portal` | helios-portal frontend |
| `forecasting` | helios-forecasting service |
| `dispatch` | helios-dispatch service |
| `infra` | Infrastructure (Terraform, Helm) |
| `deps` | Dependency updates |

### Examples

```
feat(grid-monitor): add alert escalation after 30-minute acknowledgement window

Adds automatic severity escalation for unacknowledged MEDIUM and HIGH alerts.
MEDIUM alerts escalate to HIGH after 30 minutes.
HIGH alerts escalate to CRITICAL after 15 minutes and trigger PagerDuty.

Resolves: GRID-447

---

fix(api-gateway): handle Redis reconnection on ElastiCache failover

The API gateway was not reconnecting to Redis after an ElastiCache primary
failover. The ioredis client was configured with reconnectOnError but the
error type for failover (ECONNREFUSED) was not matching.

Resolves: PLAT-892

---

chore(deps): upgrade Go to 1.22.3

Security patch release. No API changes.
Run: go get go@1.22.3 && go mod tidy

---

BREAKING CHANGE example:

feat(api-gateway)!: remove deprecated /api/v0/ endpoints

The /api/v0/ REST endpoints have been deprecated since v3.0 and are now removed.
All consumers must migrate to /api/v1/ equivalents.

BREAKING CHANGE: /api/v0/grid-state, /api/v0/alerts removed
```

---

## Pull Request Process

### PR Requirements (enforced by branch protection)

Every PR to `main` must have:
- [ ] All CI checks passing (lint, test, security scan, build)
- [ ] At least 1 approving review
- [ ] Service owner review for changes to owned services (see [Ownership Matrix](/07-onboarding/ownership-matrix.md))
- [ ] No unresolved review comments
- [ ] Conventional commit message on all commits (or squash-merged with one)
- [ ] PR description filled out (using the PR template)

### PR Template

```markdown
## What does this PR do?
<!-- One paragraph summary -->

## Why?
<!-- Link to Jira ticket or explain the motivation -->

## How was it tested?
<!-- List what was tested and how. Include test commands. -->

## What's the risk?
<!-- Low / Medium / High. What could break? -->

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated (if user-facing change)
- [ ] DB migration is backward-compatible (if applicable)
- [ ] Runbook updated (if new alert or operational procedure)
- [ ] Metrics added (if new significant operation)
- [ ] Feature flag added (if risky change needs gradual rollout)
```

### Review Guidelines

**For reviewers:**
- Review within 1 business day. Not immediately, but not a week later either.
- Review the logic, not the style — style is the linter's job.
- Be specific in change requests. "This could be better" is not actionable. "This function is doing two things; consider splitting it because..." is actionable.
- Approve if you're satisfied. Don't "approve with major comments" — either request changes or approve.
- A +1 from someone senior doesn't mean a junior engineer's feedback is invalid. All reviewers are equal in the review.

**For PR authors:**
- Keep PRs small (< 400 lines is a guideline, not a hard rule). Large PRs get rubber-stamped.
- Respond to all comments before merging, even if just "acknowledged, done in follow-up ticket GRID-xxx."
- Tag the right people. The [Ownership Matrix](/07-onboarding/ownership-matrix.md) tells you who must review what.
- Explain your change in the PR description. Don't make reviewers read code to understand what you were trying to do.

---

## Merge Strategy

**Squash and merge** for feature branches. This keeps the `main` branch history clean — one commit per feature/fix, not a rambling history of "WIP" and "fix typo" commits.

**Merge commit** for `release/` branches back to `main`. We want the release history preserved.

Never rebase or force-push to `main`. Branch protection prevents it.

---

## Hotfix Process

When a critical bug is found in production that cannot wait for the normal release cycle:

```bash
# 1. Branch from main (which is always production-ready)
git checkout main
git pull origin main
git checkout -b hotfix/PLAT-901-kafka-producer-deadlock

# 2. Fix the bug — keep it minimal. No refactoring.
# ... make fix ...

# 3. Write a test that reproduces the bug
# 4. Open a PR with priority label "hotfix"
#    - Get 1 review minimum (2 if touching critical service)
#    - CI must pass

# 5. After merge to main, deploy immediately
# The CI/CD pipeline will auto-deploy to staging
# Manually promote to prod via GitHub Actions workflow_dispatch

# 6. Post-incident: open a follow-up Jira ticket for proper fix if hotfix was a band-aid
```

**Hotfix rules:**
- Hotfixes are for production-impacting bugs only. Not for "urgent features."
- Keep the change minimal. A hotfix is not the place for refactoring.
- If the hotfix requires touching more than 3 files, it's probably not a hotfix — it's a proper fix that should go through the normal release cycle.

---

## Release Tagging

Releases are tagged on `main` after all services are deployed:

```bash
# Tag format: v{major}.{minor}.{patch}
# Major: breaking API changes
# Minor: new features, no breaking changes
# Patch: bug fixes only

git tag -a v4.8.0 -m "Release v4.8.0 — Demand Response Auto-Activation beta"
git push origin v4.8.0
```

Tagging triggers a GitHub Actions workflow that:
1. Builds final release artifacts
2. Updates `supplemental/release-notes.md` template
3. Notifies `#helios-releases` Slack channel
4. Creates a GitHub Release with the changelog

---

## Protected Branches Configuration

| Branch | Protection Rules |
|---|---|
| `main` | Require PR reviews (1 min), require status checks, no force push, no direct commits, require linear history |
| `release/*` | Require PR reviews (2 min, including service owner), require status checks |

Engineers with the `helios-infra-admin` GitHub role can bypass branch protection in emergencies (creates an audit trail).

---

## Things Every New Engineer Should Know

1. **Short-lived branches only.** A branch older than 5 days is a merge problem waiting to happen. If your feature is taking longer than 5 days, break it into smaller PRs or use a feature flag to merge incomplete code safely.

2. **Squash your commits before asking for review.** "WIP", "fix lint", "oops forgot this file" commits should be squashed before review is requested. Clean commits respect reviewer time.

3. **PR description is documentation.** A PR without a description forces the reviewer to read all the code to understand context. A good description means the reviewer can focus their attention on the right parts.

4. **Do not commit secrets.** GitHub secret scanning is enabled. But if you accidentally commit a secret, rotate it immediately before anything else. Don't wait to see if the scanner catches it first.

5. **The Jira ticket goes in the commit footer, not the commit body.** Use `Resolves: GRID-447` in the footer. Do not start your commit message with "GRID-447:". This makes the commit log clean and makes Jira automation work correctly.

---

*Document maintained by @priya.nair*  
*GitHub Actions questions → @fatima.alrashid*  
*Branch protection configuration → @tom.reeves*  
*Related: [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md) · [Coding Standards](/05-engineering/coding-standards.md) · [Deployment Guide](/supplemental/deployment-guide.md)*
