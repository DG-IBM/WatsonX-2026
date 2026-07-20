# Security Architecture

**Owner:** Yasmin Osei (Security Lead)
**Team:** Platform Security / cross-functional
**Classification:** INTERNAL — RESTRICTED. Do not share outside Lumina Energy.
**Last Updated:** 2024-10-30
**Last Security Review:** 2024-Q3 (external pen test by NCC Group — results in 1Password: "NCC Group Pen Test Q3 2024")
**Related Docs:** [Authentication](/05-engineering/authentication.md) · [Authorization](/05-engineering/authorization.md) · [User Roles & Permissions](/05-engineering/user-roles-permissions.md) · [Compliance & Regulatory Requirements](/06-operations/compliance-regulatory.md) · [Incident Response Runbook](/06-operations/incident-response-runbook.md) · [AWS Architecture](/04-platform/aws-architecture.md)

---

> **Yasmin, 2024-10-30:** Significant update to this document following the Q3 2024 NCC Group penetration test. We received 3 High-severity findings and 6 Medium-severity findings. The High findings are summarised in §7 with their remediation status. The full report is restricted to SLT + Security team + affected service owners — request access from me directly.
>
> The biggest outstanding concern is the IoT device credential management (see §4.4 and the pen test finding SEC-HIGH-001). We've known about this risk for two years (it's in the technical debt register as TD-007) but haven't resourced it adequately. Lars Eriksson and I are pushing for dedicated sprint time in Q1 2025.

---

## Table of Contents

1. [Security Principles](#security-principles)
2. [Threat Model](#threat-model)
3. [Network Security](#network-security)
4. [Identity & Access Management](#identity--access-management)
5. [Data Security](#data-security)
6. [Application Security](#application-security)
7. [Vulnerability Management](#vulnerability-management)
8. [Security Monitoring & Incident Response](#security-monitoring--incident-response)
9. [Third-Party & Supply Chain Security](#third-party--supply-chain-security)
10. [Security Debt & Known Gaps](#security-debt--known-gaps)

---

## 1. Security Principles

Helios handles critical national infrastructure. The security posture reflects that responsibility.

### Core Principles

**1. Defence in Depth**
No single control protects the system. We layer controls at network, identity, application, and data levels. A failure of any single control should not result in a breach.

**2. Least Privilege**
Every service, user, and system component has the minimum permissions needed to do its job. Service accounts are rotated regularly. Human access to production is audited.

**3. Zero Trust (Aspirational)**
We are transitioning toward zero-trust architecture (see ADR-009 in [Architecture Decision Records](/05-engineering/adrs.md)). Currently, our internal network perimeter is still partially trusted. The roadmap includes moving to mTLS between all services and eliminating VPN dependency by end of 2025.

**4. Security as Code**
Security controls are codified wherever possible — IaC (Terraform), policy-as-code (OPA), SAST/DAST in CI/CD. Manual security controls are a last resort.

**5. Assume Breach**
We design for the assumption that attackers may already be inside our network. Audit logs are written to immutable storage. Lateral movement is limited by network segmentation.

---

## 2. Threat Model

### Assets

| Asset | Classification | Risk Level |
|-------|---------------|------------|
| Grid control data (SCADA telemetry) | Critical | Very High |
| Customer energy usage data | Confidential | High |
| AI forecasting models | Confidential | High |
| IoT device credentials | Critical | Very High |
| Service account credentials | Critical | Very High |
| Customer PII (billing, account) | Confidential | High |
| Internal infrastructure configuration | Internal | Medium |
| Historical grid telemetry (>1 year old) | Internal | Medium |

### Threat Actors

| Threat Actor | Likelihood | Impact | Primary Concern |
|---|---|---|---|
| Nation-state (targeting CNI) | Medium | Critical | Grid manipulation, data exfiltration |
| Ransomware group | High | Critical | Encryption of infrastructure, extortion |
| Insider threat (malicious employee) | Low | High | Data exfiltration, unauthorized access |
| Insider threat (accidental) | High | Medium | Misconfiguration, data exposure |
| Opportunistic attacker (automated) | Very High | Low-Medium | Credential stuffing, API abuse |
| Supply chain attack | Medium | High | Compromised npm/Go packages, CI/CD pipeline |
| Disgruntled ex-employee | Low | High | If offboarding isn't properly executed |

### Attack Vectors We Consider Most Likely

1. **Compromised IoT device firmware** — malicious devices sending false telemetry to manipulate grid management decisions
2. **API credential theft** — compromised customer API keys allowing grid data access
3. **Supply chain: npm dependency** — a compromised package in the Next.js frontend or Node.js services
4. **Social engineering targeting on-call engineers** — fake incident calls to gain access
5. **Kafka topic poisoning** — malformed messages designed to crash or corrupt consumers

---

## 3. Network Security

### VPC Architecture

All Helios infrastructure runs in dedicated AWS VPCs. The VPC design is described in detail in [AWS Architecture](/04-platform/aws-architecture.md). Key security controls:

```
┌─────────────────────────────────────────────────────────────┐
│  INTERNET                                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS only (port 443)
                       │ TLS 1.2 minimum, TLS 1.3 preferred
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  AWS WAF + Shield Standard                                  │
│  (DDoS protection, OWASP rules, rate limiting)              │
└──────────────────────┬──────────────────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PUBLIC SUBNET (DMZ)                                        │
│  Application Load Balancers only                            │
│  Security Group: allows 443 inbound from 0.0.0.0/0         │
└──────────────────────┬──────────────────────────────────────┘
                       │ Internal traffic only
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PRIVATE SUBNET (Application Tier)                         │
│  EKS worker nodes                                           │
│  Security Group: allows traffic from ALB SG only           │
└──────────────────────┬──────────────────────────────────────┘
                       │ Internal traffic only
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  PRIVATE SUBNET (Data Tier)                                 │
│  Aurora PostgreSQL, Elasticache Redis, MSK Kafka            │
│  Security Group: allows traffic from App tier SGs only     │
└─────────────────────────────────────────────────────────────┘

IoT Devices ──► AWS IoT Core (managed service) ──► IoT ingest service
              (separate from main VPC, bridged via internal endpoint)
```

### Ingress Controls

- **AWS WAF:** Managed rule groups (OWASP Core, AWSManagedRulesKnownBadInputsRuleSet, IP reputation list)
- **Rate Limiting:** 1000 requests/minute per IP on all public endpoints; 100 requests/minute on authentication endpoints
- **Geo-restriction:** Not implemented (customers in 6 countries; blanket restriction not feasible)
- **TLS Policy:** `ELBSecurityPolicy-TLS13-1-2-2021-06` on all ALBs. TLS 1.0/1.1 rejected.

### Inter-Service Communication

Currently: services communicate over internal Kubernetes service mesh using standard HTTP/HTTPS. **mTLS is not yet universally implemented** (see §10 — Security Debt).

In-progress: Istio service mesh rollout (ADR-009). Target: all internal traffic mTLS by Q3 2025. Current status: mTLS enabled for grid-event-processor ↔ outage-detection-svc and forecasting-engine ↔ grid-api.

### Bastion & Production Access

Direct SSH to production nodes is disabled. All production access goes through:
1. **AWS Systems Manager Session Manager** — no open SSH ports, fully audited
2. **kubectl** with short-lived credentials (AWS EKS + IAM)
3. **Database access via RDS Proxy** (no direct PostgreSQL access from dev machines)

```bash
# Correct way to get a shell on a prod pod (requires SRE IAM role)
kubectl exec -it -n helios-prod $(kubectl get pod -l app=grid-api -o jsonpath='{.items[0].metadata.name}') -- /bin/sh

# Correct way to access the database
aws rds-data execute-statement \  # For simple queries
  --database helios_production \
  --resource-arn arn:aws:rds:eu-west-1:ACCOUNT:cluster:helios-aurora-primary \
  --secret-arn arn:aws:secretsmanager:eu-west-1:ACCOUNT:secret:helios-db-prod \
  --sql "SELECT count(*) FROM grid_meters WHERE active = true"
```

---

## 4. Identity & Access Management

See also [Authentication](/05-engineering/authentication.md) and [Authorization](/05-engineering/authorization.md) for full technical details.

### Human Identity (Internal)

- **Identity Provider:** Okta (SSO for all internal tools)
- **MFA:** Required for all engineers. TOTP or hardware key (YubiKey issued to all SRE and Platform engineers)
- **Privileged Access:** Production access requires a separate Okta application with step-up MFA
- **Access Reviews:** Quarterly automated access review via Okta Workflows; annual manual review for production access

### Human Identity (Customers)

- **Authentication:** JWT tokens, issued by our auth service, with 1-hour expiry
- **MFA:** Available and encouraged; required for operators with write permissions
- **API Keys:** Long-lived (365-day max) for machine-to-machine access; HMAC-SHA256 signed
- **Tenant isolation:** Multi-tenant architecture uses row-level security in PostgreSQL + application-level JWT claims

### Service Identity

- **Service accounts:** Kubernetes service accounts with IAM role binding (IRSA)
- **Secret management:** AWS Secrets Manager for all service credentials; no secrets in environment variables, ConfigMaps, or source code
- **Secret rotation:** Automated rotation for database passwords (every 30 days) and service API keys (every 90 days)

```yaml
# Example: Service account with IRSA binding
apiVersion: v1
kind: ServiceAccount
metadata:
  name: grid-event-processor
  namespace: helios-prod
  annotations:
    eks.amazonaws.com/role-arn: arn:aws:iam::ACCOUNT_ID:role/helios-grid-event-processor
---
# Corresponding IAM role policy (minimal permissions)
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "kafka-cluster:Connect",
        "kafka-cluster:DescribeGroup",
        "kafka-cluster:ReadData"
      ],
      "Resource": "arn:aws:kafka:eu-west-1:ACCOUNT:cluster/helios-prod/*"
    }
  ]
}
```

### IoT Device Identity

- **Authentication:** X.509 certificates issued per device, signed by Lumina CA
- **Certificate validity:** 90 days; automatic rotation via AWS IoT Device Shadow
- **Issue:** Shared device credentials exist for legacy batch-deployed devices (see §10 and TD-007)

---

## 5. Data Security

### Data Classification

| Level | Definition | Examples | Controls |
|-------|-----------|---------|---------|
| **Critical** | Grid control system data; device credentials; encryption keys | SCADA telemetry, device certs, KMS keys | Encrypted in transit + at rest; access logged; restricted to specific roles |
| **Confidential** | Customer data; PII; financial | Energy usage, billing, account details | Encrypted; GDPR controls; data residency enforced |
| **Internal** | Business operational data | Reports, dashboards, internal metrics | Encrypted at rest; role-based access |
| **Public** | Intentionally public | API documentation, statuspage | No restrictions |

### Encryption

| Layer | Mechanism | Key Management |
|-------|-----------|---------------|
| Data in transit | TLS 1.2+ everywhere; TLS 1.3 where supported | ACM certificates (rotated automatically) |
| Database at rest | AES-256 via Aurora storage encryption | AWS KMS CMK (helios-aurora-key) |
| S3 at rest | AES-256 SSE-KMS | AWS KMS CMK (helios-s3-key) |
| Kafka at rest | AES-256 MSK encryption | AWS KMS CMK (helios-kafka-key) |
| EBS volumes | AES-256 | AWS KMS (account default CMK) |
| Application-level (PII fields) | AES-256-GCM (field-level) | AWS KMS CMK (helios-pii-key); keys stored in Secrets Manager |

```typescript
// Field-level encryption for PII (from customer-service.ts)
import { encrypt, decrypt } from '@lumina/crypto-utils';

async function storeCustomerProfile(profile: CustomerProfile): Promise<void> {
  const encrypted = {
    ...profile,
    email: await encrypt(profile.email, process.env.PII_ENCRYPTION_KEY_ARN!),
    phoneNumber: await encrypt(profile.phoneNumber, process.env.PII_ENCRYPTION_KEY_ARN!),
    address: await encrypt(JSON.stringify(profile.address), process.env.PII_ENCRYPTION_KEY_ARN!),
    // energyUsageData is NOT considered PII — stored plaintext (but encrypted at rest by Aurora)
  };
  await db.customers.create({ data: encrypted });
}
```

### Data Residency

Customer data residency is enforced based on customer contract:

| Region | Data Location | Customers |
|--------|--------------|----------|
| EU (default) | eu-west-1, eu-central-1 | NW Grid UK, ENGIE, TransnetBW, others |
| Australia | ap-southeast-2 | Ausgrid, AusNet |
| US (planned) | us-east-1 | Pending — Q2 2025 |

Cross-region replication (DR) only replicates to regions within the same data residency zone. EU customer data does not leave EU regions.

---

## 6. Application Security

### SAST/DAST in CI/CD

See [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md) for pipeline configuration. Security checks run on every PR:

| Tool | Type | What it scans |
|------|------|--------------|
| Semgrep | SAST | TypeScript, Go, SQL injection, secrets |
| Snyk | Dependency scanning | npm, Go modules |
| Trivy | Container scanning | Docker images |
| OWASP ZAP | DAST (staging only) | API endpoints |
| git-secrets | Pre-commit | Credential leaks in commits |

### Common Vulnerabilities We've Seen (Internal Learning)

1. **Overly permissive CORS (fixed 2022):** Early versions of the GraphQL API allowed `*` origin. Changed to explicit allowlist.
2. **JWT algorithm confusion (fixed 2023):** Auth service accepted `alg: none` JWTs in a testing mode that was accidentally enabled in staging. Would not have worked in prod due to signature verification, but was still corrected.
3. **Rate limiting gap on bulk meter API (open — KI-006):** The `/v3/meters/bulk` endpoint doesn't have per-customer rate limiting, only global. A single customer can generate enough load to affect others.
4. **Kafka message deserialization DoS (fixed 2024):** A malformed Avro message caused the grid-event-processor to panic in a loop. Fixed by adding message size and schema validation pre-deserialization.

### Dependency Management

- All dependencies are pinned to exact versions in `package.json` and `go.sum`
- Snyk scans run on every PR and weekly automated scans
- Critical vulnerability fix SLA: 7 days (after CVSS ≥ 9.0), 30 days (CVSS 7.0–8.9)
- We use Dependabot for automated PRs; Snyk for policy enforcement

---

## 7. Vulnerability Management

### Q3 2024 Pen Test Findings (NCC Group)

**Full report:** Restricted — request from Yasmin Osei. Summary of High-severity findings:

| Finding | Severity | Status | Remediation Owner |
|---------|----------|--------|-------------------|
| **SEC-HIGH-001:** IoT device certificate sharing — multiple devices using same certificate | High | In Progress (Q1 2025) | Lars Eriksson |
| **SEC-HIGH-002:** Dispatch service running Node.js 16 (EOL, unpatched CVEs) | High | In Progress (see TD-002) | Tanvir Rahman |
| **SEC-HIGH-003:** Insufficient audit logging on admin user impersonation actions | High | Completed 2024-10-15 | Yasmin Osei |

Medium-severity findings and below are tracked in the internal security Jira project (HELIOS-SEC). Access restricted to security team and relevant service owners.

### Vulnerability Disclosure

We operate a responsible disclosure program. Security researchers can report vulnerabilities to `security@lumina.energy`. We aim to acknowledge within 48 hours and remediate critical findings within 30 days.

We do not operate a public bug bounty program. This is under review for 2025.

---

## 8. Security Monitoring & Incident Response

### Security Monitoring Stack

| Tool | Purpose |
|------|---------|
| AWS CloudTrail | All AWS API calls; retained 7 years |
| AWS GuardDuty | Threat detection (anomalous API calls, crypto mining, compromised credentials) |
| AWS Security Hub | Centralised security posture; aggregates GuardDuty, Inspector, Config |
| Falco | Runtime security — detects unexpected syscalls in Kubernetes pods |
| Wazuh | SIEM — log aggregation and correlation |
| Grafana (custom panels) | Auth failure rates, unusual API patterns |

### Security Alerts That Always Page Yasmin

The following GuardDuty/Falco alerts are routed to Yasmin's PagerDuty immediately, regardless of time:

- `GuardDuty: UnauthorizedAccess:IAMUser/InstanceCredentialExfiltration`
- `GuardDuty: Backdoor:Lambda/C&CActivity.B`
- `Falco: Terminal shell in container` (in any production pod)
- `Falco: Sensitive file opened for reading` (e.g., `/etc/shadow`, Kubernetes secrets)
- `iot_device_auth_failure_rate > 0.10` for 5 consecutive minutes
- Any authentication from a previously-unknown IP for an admin-role user

### Security Incident Response

For security incidents, the standard incident response runbook applies with additional steps:

1. **Do NOT announce in #incidents channel** — use `#security-incidents` (restricted channel)
2. **Preserve evidence** — do not restart or terminate affected resources until forensic snapshot taken
3. **Notify Yasmin Osei** — she coordinates with legal and compliance
4. **Regulatory notification** — may be required within hours (see [Compliance](/06-operations/compliance-regulatory.md))

---

## 9. Third-Party & Supply Chain Security

### Vendor Security Reviews

All SaaS vendors accessing Helios data or infrastructure undergo a security review before onboarding. Reviews are documented in the Vendor Security Register (Notion: Security workspace).

Current third-party integrations requiring review: PagerDuty, Okta, Datadog (not currently used), NCC Group (pen test), AWS (enterprise), Mapbox (GIS tiles — see note below).

> **Note on Mapbox:** The GIS mapping service uses Mapbox for tile rendering. Mapbox API calls include coordinates of grid infrastructure. This was reviewed in Q2 2024 — Mapbox processes but does not retain the coordinates per their DPA. This was deemed acceptable risk. Review scheduled Q2 2025.

### Software Supply Chain

- All container images use distroless or minimal base images
- No packages pulled from private registries without verification
- Go modules use checksums verified against `go.sum`
- npm packages use exact version pinning + `package-lock.json`
- CI/CD pipeline has SLSA Level 2 compliance (build provenance, signed artifacts)

---

## 10. Security Debt & Known Gaps

| ID | Description | Risk | Owner | Target |
|----|-------------|------|-------|--------|
| SEC-DEBT-001 | mTLS not yet universal between services | Medium | Priya Nair | Q3 2025 |
| SEC-DEBT-002 | IoT device certificate sharing (SEC-HIGH-001) | High | Lars Eriksson | Q1 2025 |
| SEC-DEBT-003 | Dispatch service Node 16 EOL (SEC-HIGH-002) | High | Tanvir Rahman | Q2 2025 |
| SEC-DEBT-004 | No hardware HSM for KMS CMK (using AWS software KMS) | Low | Yasmin Osei | Under review |
| SEC-DEBT-005 | Network segmentation between Helios services is logical only (same namespace) | Medium | Priya Nair | Q3 2025 (with Kubernetes namespace isolation project) |
| SEC-DEBT-006 | No automated WAF rule review — rules added, rarely removed | Low | Rosa Lindqvist | Annual review added to 2025 calendar |

### Things Every Engineer Should Know About Security

1. **Never put secrets in code, environment variables, or ConfigMaps.** Use AWS Secrets Manager. There is a pre-commit hook that will catch this, but don't rely on it.
2. **If you see a GuardDuty alert, Falco alert, or any sign of unauthorized access — go to #security-incidents immediately.** Do not try to handle it yourself.
3. **The `HeliosProdReadOnly` IAM role is for reading, not modifying.** If you need to make a change in production, use the change management process. Do not ask for elevated permissions without a Jira ticket.
4. **IoT device credentials are extremely sensitive.** Do not log them. Do not put them in Slack. If you accidentally expose an IoT credential, tell Yasmin immediately — we can revoke individual device certificates.
5. **Post-mortems and incident data can contain security-sensitive information.** Be careful what you put in the public incident Slack channel.
6. **We have an annual security training requirement.** It's in Workday. If you haven't done it, do it. Skipping it is an HR issue.

---

*This document is classified INTERNAL — RESTRICTED. Questions: `#security-team` Slack or Yasmin Osei directly.*
*Suspected security incidents: `security@lumina.energy` or `#security-incidents` Slack.*
