# Kubernetes Guide — Helios

> **Location:** Confluence → Helios Engineering Space → Platform → Kubernetes Guide  
> **Owner:** Kenji Watanabe (Senior Engineer, Platform) · @kenji.watanabe  
> **Last Updated:** 2024-10-18  
> **Status:** Current — EKS 1.29, Flux v2, Helm 3  
> **Related:** [Infrastructure Overview](/04-platform/infrastructure-overview.md) · [AWS Architecture](/04-platform/aws-architecture.md) · [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md) · [Deployment Guide](/supplemental/deployment-guide.md)

---

## Cluster Overview

| Cluster | Region | Version | Nodes | Purpose |
|---|---|---|---|---|
| `helios-prod-eks` | us-east-1 | 1.29 | 40 (variable) | Production |
| `helios-staging-eks` | us-east-1 | 1.29 | 12 (fixed) | Staging + integration |
| `helios-dev-eks` | us-east-1 | 1.30 | 8 (fixed) | Dev + APAC prod |

> **Note:** `helios-dev-eks` runs Kubernetes 1.30 intentionally — it is the canary for our next upgrade cycle. APAC production workloads (TasNetworks) run on this same cluster in an isolated namespace. Yes, this is not ideal and is tracked as a technical debt item.

---

## Namespace Structure

```
helios-prod-eks namespaces:
├── helios-prod          Primary application namespace (all services)
├── monitoring           Prometheus, Grafana, Loki, Alertmanager, Jaeger
├── flux-system          Flux GitOps controllers
├── vault                HashiCorp Vault (HA)
├── karpenter            Karpenter node autoprovisioner
├── cert-manager         TLS certificate management
├── external-dns         Route 53 DNS automation
└── kube-system          Kubernetes system components
```

All application services run in `helios-prod`. There is no per-service namespace because the overhead of cross-namespace NetworkPolicy is not worth the isolation benefit at our scale. Service-to-service isolation is enforced at the security group level (see [Infrastructure Overview — Networking](/04-platform/infrastructure-overview.md#networking)).

---

## GitOps with Flux v2

All Kubernetes state is managed by **Flux v2**. The `helios-infra` repository is the source of truth. When a PR is merged to the `main` branch of `helios-infra`, Flux detects the change and applies it to the cluster within ~2 minutes.

**You should never run `kubectl apply` directly in production.** Changes should go through:
1. PR to `helios-infra`
2. Automated CI validation (Helm lint, kustomize build, kubeval)
3. PR review by @kenji.watanabe or @tom.reeves
4. Merge → Flux applies

```yaml
# helios-infra/k8s/flux/helios-prod-sync.yaml
apiVersion: source.toolkit.fluxcd.io/v1
kind: GitRepository
metadata:
  name: helios-infra
  namespace: flux-system
spec:
  interval: 1m
  url: https://github.com/lumina-energy/helios-infra
  secretRef:
    name: github-deploy-key
  ref:
    branch: main
---
apiVersion: kustomize.toolkit.fluxcd.io/v1
kind: Kustomization
metadata:
  name: helios-prod-services
  namespace: flux-system
spec:
  interval: 2m
  path: ./k8s/overlays/prod
  prune: true          # Delete resources removed from Git
  sourceRef:
    kind: GitRepository
    name: helios-infra
  healthChecks:
    - apiVersion: apps/v1
      kind: Deployment
      name: api-gateway
      namespace: helios-prod
  timeout: 5m
  retryInterval: 30s
```

---

## Helm Charts

Each service has a Helm chart in `helios-infra/charts/{service-name}/`. All charts follow a common structure and extend a base `helios-service` chart template.

```
helios-infra/charts/grid-monitor/
├── Chart.yaml
├── values.yaml          Default values (used in dev)
├── values.staging.yaml  Staging overrides
├── values.prod.yaml     Production overrides (committed — no secrets here)
└── templates/
    ├── deployment.yaml
    ├── service.yaml
    ├── hpa.yaml          Horizontal Pod Autoscaler
    ├── pdb.yaml          Pod Disruption Budget
    ├── servicemonitor.yaml  Prometheus scrape config
    └── networkpolicy.yaml
```

**Example Deployment template:**

```yaml
# charts/grid-monitor/templates/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ .Release.Name }}
  namespace: {{ .Values.namespace }}
  labels:
    app: {{ .Release.Name }}
    version: {{ .Chart.AppVersion }}
    team: grid-intelligence
spec:
  replicas: {{ .Values.replicaCount }}
  selector:
    matchLabels:
      app: {{ .Release.Name }}
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0   # Zero-downtime deployments: never remove a pod before a new one is ready
  template:
    metadata:
      labels:
        app: {{ .Release.Name }}
        version: {{ .Chart.AppVersion }}
      annotations:
        vault.hashicorp.com/agent-inject: "true"
        vault.hashicorp.com/role: "helios-{{ .Release.Name }}"
        vault.hashicorp.com/agent-inject-secret-config: "secret/helios/{{ .Values.env }}/{{ .Release.Name }}"
        prometheus.io/scrape: "true"
        prometheus.io/port: "9090"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: {{ .Release.Name }}
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
        seccompProfile:
          type: RuntimeDefault
      containers:
        - name: {{ .Release.Name }}
          image: "{{ .Values.image.repository }}:{{ .Values.image.tag }}"
          imagePullPolicy: IfNotPresent
          ports:
            - containerPort: {{ .Values.service.port }}
            - containerPort: 9090  # metrics
          resources:
            requests:
              cpu: {{ .Values.resources.requests.cpu }}
              memory: {{ .Values.resources.requests.memory }}
            limits:
              cpu: {{ .Values.resources.limits.cpu }}
              memory: {{ .Values.resources.limits.memory }}
          readinessProbe:
            grpc:
              port: {{ .Values.service.port }}
            initialDelaySeconds: 10
            periodSeconds: 5
            failureThreshold: 3
          livenessProbe:
            grpc:
              port: {{ .Values.service.port }}
            initialDelaySeconds: 30
            periodSeconds: 10
            failureThreshold: 3
          env:
            - name: HELIOS_ENV
              value: {{ .Values.env }}
            - name: OTEL_EXPORTER_OTLP_ENDPOINT
              value: http://otel-collector.monitoring.svc.cluster.local:4317
          volumeMounts:
            - name: vault-secrets
              mountPath: /vault/secrets
              readOnly: true
      volumes:
        - name: vault-secrets
          emptyDir:
            medium: Memory  # Secrets in tmpfs only, never written to disk
```

---

## Autoscaling

### Horizontal Pod Autoscaler (HPA) with KEDA

Standard HPA scales on CPU/memory. But for Helios, the most meaningful scaling signal for the grid monitor is **Kafka consumer lag** — not CPU. We use **KEDA (Kubernetes Event-Driven Autoscaler)** for Kafka-driven autoscaling.

```yaml
# charts/grid-monitor/templates/keda-scaledobject.yaml
apiVersion: keda.sh/v1alpha1
kind: ScaledObject
metadata:
  name: grid-monitor-scaledobject
  namespace: helios-prod
spec:
  scaleTargetRef:
    name: grid-monitor
  minReplicaCount: 4
  maxReplicaCount: 12
  cooldownPeriod: 60
  pollingInterval: 15
  triggers:
    - type: kafka
      metadata:
        bootstrapServers: {{ .Values.kafka.brokers }}
        consumerGroup: grid-monitor-readings
        topic: iot.raw.meter.readings.v2
        lagThreshold: "10000"    # Scale up when lag exceeds 10,000 messages
        activationLagThreshold: "100"
      authenticationRef:
        name: keda-msk-auth
```

**Other services using KEDA:**
- `iot-bridge`: scales on `iot.raw.meter.readings.v2` produce queue depth
- `outage-detect`: scales on `grid.events.enriched.v2` consumer lag
- `notify`: scales on `grid.alerts.v2` consumer lag

**Services using standard HPA (CPU/memory):**
- `api-gateway`: request-rate driven, CPU is a good proxy
- `forecasting-server`: inference-load driven, CPU scales appropriately
- `dispatch`: low-throughput, CPU-based HPA is sufficient

### Pod Disruption Budgets

Every service has a PDB to ensure zero-downtime during node maintenance or cluster upgrades:

```yaml
# charts/grid-monitor/templates/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: grid-monitor-pdb
  namespace: helios-prod
spec:
  minAvailable: 3   # Always keep at least 3 pods running
  selector:
    matchLabels:
      app: grid-monitor
```

---

## Node Provisioning with Karpenter

Karpenter replaced the Cluster Autoscaler in v4.5. It provisions nodes on demand when pods are pending:

```yaml
# k8s/base/karpenter/nodepool-general.yaml
apiVersion: karpenter.sh/v1beta1
kind: NodePool
metadata:
  name: general-compute
spec:
  template:
    metadata:
      labels:
        nodepool: general-compute
    spec:
      requirements:
        - key: kubernetes.io/arch
          operator: In
          values: ["amd64"]
        - key: karpenter.sh/capacity-type
          operator: In
          values: ["spot", "on-demand"]
        - key: karpenter.k8s.aws/instance-family
          operator: In
          values: ["m6i", "m6a", "m5"]
        - key: karpenter.k8s.aws/instance-size
          operator: In
          values: ["xlarge", "2xlarge"]
      nodeClassRef:
        apiVersion: karpenter.k8s.aws/v1beta1
        kind: EC2NodeClass
        name: helios-default
  limits:
    cpu: 320    # Max total CPUs in this node pool
  disruption:
    consolidationPolicy: WhenUnderutilized
    consolidateAfter: 30s
```

---

## Ingress Architecture

All external traffic enters through the **AWS Application Load Balancer** (ALB), which forwards to the `api-gateway` service. There is no Nginx Ingress Controller — we use the **AWS Load Balancer Controller** which creates ALB rules directly from Kubernetes `Ingress` resources.

```yaml
# k8s/base/ingress/api-gateway-ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: api-gateway-ingress
  namespace: helios-prod
  annotations:
    kubernetes.io/ingress.class: alb
    alb.ingress.kubernetes.io/scheme: internet-facing
    alb.ingress.kubernetes.io/target-type: ip
    alb.ingress.kubernetes.io/certificate-arn: arn:aws:acm:us-east-1:141592653589:certificate/xxx
    alb.ingress.kubernetes.io/ssl-redirect: "443"
    alb.ingress.kubernetes.io/healthcheck-path: /health
    alb.ingress.kubernetes.io/load-balancer-attributes: idle_timeout.timeout_seconds=120
    alb.ingress.kubernetes.io/wafv2-acl-arn: arn:aws:wafv2:us-east-1:141592653589:regional/webacl/helios-api-waf/xxx
spec:
  rules:
    - host: api.luminaenergy.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: api-gateway
                port:
                  number: 4000
```

---

## Useful kubectl Commands

```bash
# Get cluster credentials
aws eks update-kubeconfig \
  --name helios-prod-eks \
  --region us-east-1 \
  --profile helios-prod

# Watch pods in the main namespace
kubectl get pods -n helios-prod -w

# Get pod logs (last 100 lines)
kubectl logs -n helios-prod deployment/grid-monitor --tail=100

# Follow logs for all pods of a deployment
kubectl logs -n helios-prod -l app=grid-monitor --follow --max-log-requests=12

# Describe a deployment (shows events, resource usage, image version)
kubectl describe deployment grid-monitor -n helios-prod

# Port-forward to a service (e.g., Grafana in monitoring namespace)
kubectl port-forward -n monitoring svc/grafana 3000:80

# Check HPA / KEDA ScaledObject status
kubectl get hpa -n helios-prod
kubectl get scaledobject -n helios-prod

# Check node utilization
kubectl top nodes

# Check pod resource utilization
kubectl top pods -n helios-prod

# Roll out a restart (triggers rolling restart of all pods in a deployment)
kubectl rollout restart deployment/api-gateway -n helios-prod

# Check rollout status
kubectl rollout status deployment/api-gateway -n helios-prod

# Roll back a deployment
kubectl rollout undo deployment/api-gateway -n helios-prod

# Check Flux sync status
flux get kustomizations -n flux-system

# Force Flux to reconcile immediately
flux reconcile kustomization helios-prod-services -n flux-system
```

---

## Adding a New Service

When adding a new service to the platform:

1. **Create the Helm chart** in `helios-infra/charts/{service-name}/` using the `helios-service` base chart as a starting point. Copy from an existing simple service like `notify`.

2. **Create the Flux HelmRelease** in `helios-infra/k8s/overlays/prod/{service-name}.yaml`:
```yaml
apiVersion: helm.toolkit.fluxcd.io/v2beta2
kind: HelmRelease
metadata:
  name: {service-name}
  namespace: helios-prod
spec:
  interval: 10m
  chart:
    spec:
      chart: charts/{service-name}
      sourceRef:
        kind: GitRepository
        name: helios-infra
  values:
    env: prod
    image:
      repository: 141592653589.dkr.ecr.us-east-1.amazonaws.com/helios/{service-name}
      tag: "latest"   # CI/CD will override this with the actual image tag
```

3. **Create the ECR repository** in Terraform: `helios-infra/terraform/shared/ecr.tf`

4. **Create the Vault policy and role** so the service can read its secrets.

5. **Create the Prometheus ServiceMonitor** to scrape the service's metrics endpoint.

6. **Create a GitHub Actions workflow** for the service's CI/CD pipeline (see [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md)).

7. **Register in the Microservices Overview** and Ownership Matrix before deploying to staging.

---

## Common Problems

| Symptom | Likely Cause | Fix |
|---|---|---|
| Pod stuck in `Pending` | No node with sufficient resources | Check Karpenter logs: `kubectl logs -n karpenter deployment/karpenter` |
| Pod stuck in `CrashLoopBackOff` | Application startup error | Check logs: `kubectl logs -n helios-prod {pod} --previous` |
| Pod stuck in `Init:0/1` | Vault agent init failing | Check Vault connectivity and pod's Vault role exists |
| Flux not applying changes | Git credentials expired or conflict | `flux reconcile source git helios-infra -n flux-system` |
| HPA not scaling | Metrics server issue or KEDA auth error | Check `kubectl get hpa -n helios-prod` and KEDA operator logs |
| ImagePullBackOff | ECR auth or wrong image tag | Check ECR repo exists and IRSA role has `ecr:GetDownloadUrlForLayer` |

---

*Document maintained by @kenji.watanabe*  
*Node provisioning / Karpenter → @tom.reeves*  
*GitOps / Flux questions → @kenji.watanabe or @fatima.alrashid*  
*Related: [AWS Architecture](/04-platform/aws-architecture.md) · [CI/CD Pipeline](/04-platform/ci-cd-pipeline.md) · [Deployment Guide](/supplemental/deployment-guide.md)*
