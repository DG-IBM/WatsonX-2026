# Glossary

**Owner:** Priya Nair + Engineering team (crowdsourced)
**Last Updated:** 2024-11-10
**Related Docs:** [FAQ](/07-onboarding/faq.md) · [System Overview](/02-architecture/system-overview.md) · [IoT Device Management](/03-services/iot-device-management.md) · [AI Forecasting Engine](/03-services/ai-forecasting-engine.md)

---

> This glossary covers terminology specific to Helios and the energy grid domain. It's crowdsourced — engineers add terms as they encounter them. If you see a term in a document and don't understand it, check here first, then ask in Slack, then add it here once you know.
>
> Terms are a mix of energy domain vocabulary, internal Helios-specific terms, and relevant technical terms that aren't obvious. Standard engineering terms (REST, Kubernetes, etc.) are not included.

---

## A

**ADR (Architecture Decision Record)**
A document recording a significant architectural decision, the context in which it was made, the options considered, and the rationale for the choice made. Helios has 10 ADRs covering major technical decisions. See [05-engineering/adrs.md](/05-engineering/adrs.md).

**AMI (Advanced Metering Infrastructure)**
The full system encompassing smart meters, communications networks, and data management systems that enable two-way communication between utilities and customers. Helios manages AMI data on behalf of our utility customers.

**Anomaly Score**
A numerical value (0.0–1.0) produced by the outage detection service's ML model indicating how abnormal a given set of grid readings is. Values above 0.85 trigger an alert. Values above 0.95 trigger automatic outage classification. Thresholds are configurable per customer. See [Outage Detection Service](/03-services/outage-detection-service.md).

**Avro**
Apache Avro — the binary serialization format used for Kafka messages in Helios. Schemas are stored in the Confluent Schema Registry. Every Kafka message produced by Helios services uses Avro. See [Event-Driven Architecture](/02-architecture/event-driven-architecture.md#message-schema).

---

## B

**BDEW**
Bundesverband der Energie- und Wasserwirtschaft — the German Association of Energy and Water Industries. Issues IT security guidelines (alongside BSI) that our German customers must comply with. See [Compliance](/06-operations/compliance-regulatory.md).

**BFF (Backend for Frontend)**
A pattern where a dedicated API layer is built specifically for a frontend application, rather than using a generic API. The Helios customer portal has a BFF layer in the Node.js API that shapes data specifically for portal consumption, shielding the portal from the complexity of the underlying microservices.

**BSI**
German Federal Office for Information Security (Bundesamt für Sicherheit in der Informationstechnik). Issues cybersecurity guidelines applicable to German critical infrastructure operators.

**Battery Storage Unit**
A grid-connected battery system used to store energy during periods of surplus (e.g., excess renewable generation) and discharge it during peak demand. Helios monitors battery state-of-charge, charge/discharge rates, and health metrics. Often abbreviated as BESS (Battery Energy Storage System).

---

## C

**Continuous Aggregate**
A TimescaleDB feature that automatically pre-computes and materialises aggregations of time-series data (e.g., hourly averages of meter readings). Helios uses continuous aggregates for the `grid_readings_hourly` and `grid_readings_daily` views. They significantly speed up analytical queries. See [Database Architecture](/02-architecture/database-architecture.md#timescaledb).

**Customer (Helios context)**
In Helios terminology, "customer" always refers to a utility company (e.g., NW Grid UK, ENGIE) — not an end electricity consumer. The people who actually pay electricity bills are called "end consumers" or "residential consumers" to avoid confusion.

**Customer Portal**
The Next.js web application used by utility company operators to monitor their grid, view forecasts, manage devices, and configure the system. Different from the internal admin portal (which Lumina staff use). See [Customer Portal service doc](/03-services/customer-portal.md).

---

## D

**Dead Letter Queue (DLQ)**
A Kafka topic that receives messages that failed processing — either because they couldn't be deserialized or because a consumer threw an unretryable error. Helios has DLQs for all major consumer groups. DLQ message counts are monitored by Grafana. A growing DLQ count indicates a processing problem.

**Demand Forecast**
A prediction of future electricity demand (in MW or kW) for a given area, produced by the AI Forecasting Engine. Demand forecasts are generated at 15-minute resolution for up to 7 days ahead. Utility operators use these to plan generation dispatch and grid balancing. See [AI Forecasting Engine](/03-services/ai-forecasting-engine.md).

**DNOSP (Distribution Network Operator System Provider)**
Internal shorthand used by some UK-focused engineers when referring to the software systems used by Distribution Network Operators (DNOs). Helios is a DNOSP.

**DPA (Data Processing Agreement)**
A legal contract between a data controller (utility company customer) and a data processor (Lumina Energy) governing how personal data is handled. Required under GDPR. All Helios customers have signed DPAs. See [Compliance](/06-operations/compliance-regulatory.md).

---

## E

**Edge Device**
An IoT device physically located at or near the grid asset it monitors (e.g., a sensor attached to a transformer). Edge devices typically have limited compute and connectivity. Distinguished from "smart meters" which are at customer premises.

**End Consumer**
The residential or commercial electricity customer — the person paying an electricity bill. Helios processes their energy usage data on behalf of utility companies. End consumers do not have direct access to the Helios platform. Sometimes called "residential consumer."

**Ensemble Model**
The AI forecasting approach that combines predictions from multiple models (TFT + XGBoost in our case) to produce a final forecast. Ensemble models typically outperform any single model by reducing variance. See [AI Forecasting Engine](/03-services/ai-forecasting-engine.md#model-architecture).

**Event-Driven Architecture (EDA)**
The system design pattern used in Helios where significant state changes are represented as events published to Kafka, rather than direct service-to-service calls. This decouples services, enables replay, and supports high throughput. See [Event-Driven Architecture](/02-architecture/event-driven-architecture.md).

---

## F

**Fleet (IoT context)**
The full set of IoT devices under management — all 42 million smart meters plus substations, generators, and battery storage units. "Fleet management" refers to the operations of managing device firmware, certificates, and connectivity at scale.

**FLISR (Fault Location, Isolation, and Service Restoration)**
An automated grid function that detects faults, isolates the faulted segment, and restores power to unaffected customers. Some of our utility customers use Helios outage detection data to feed their FLISR systems. Not to be confused with our outage detection service, which detects but doesn't perform automated switching.

**Forecasting Engine**
See "AI Forecasting Engine" or [service documentation](/03-services/ai-forecasting-engine.md). Sometimes called "the forecaster" informally.

---

## G

**GIS (Geographic Information System)**
The system used to represent and analyze geographic data. In Helios, the GIS mapping service displays the spatial layout of the grid — substations, lines, meters, technician locations — on a map. Uses PostGIS for spatial data storage and Mapbox for rendering. See [GIS Mapping Service](/03-services/gis-mapping-service.md).

**Grid Event**
Any discrete occurrence on the electrical grid that warrants recording: a meter reading, a fault, a switch operation, a device going offline, etc. Grid events are the primary data type flowing through the Helios Kafka topics.

**Grid Topology**
The interconnected graph structure of the electrical grid: which substations connect to which, which lines run between them, which meters feed into which distribution transformer. Helios stores grid topology in PostgreSQL (as a graph structure) and in PostGIS (as geospatial features). Changes to topology (new substations, meter relocations) come from customer systems.

**Grid Reading**
A measurement taken from a grid asset — typically a meter reading (energy consumed in kWh over a period) or a power flow reading (instantaneous power in kW) from a substation or sensor. The core data type in the `grid_readings` TimescaleDB hypertable.

---

## H

**Helios Portal**
See "Customer Portal."

**Hypertable**
A TimescaleDB abstraction over a regular PostgreSQL table that adds automatic time-based partitioning. The `grid_readings` and `grid_meter_events` tables are hypertables. From a query perspective they work like regular tables; TimescaleDB handles the partitioning transparently.

---

## I

**INC-YYYY-NNNN**
The format for internal incident identifiers. `INC-2024-0719` means the 719th incident logged in 2024. Incidents are created in Jira (IC project) and linked to PagerDuty. Post-mortems reference the incident ID.

**IoT Core**
AWS IoT Core — the managed AWS service used to handle MQTT connections from field devices at scale. Helios uses IoT Core as the ingestion endpoint for all smart meter traffic. See [IoT Device Management](/03-services/iot-device-management.md) and [AWS Architecture](/04-platform/aws-architecture.md).

**IRSA (IAM Roles for Service Accounts)**
The AWS mechanism that allows a Kubernetes service account to assume an IAM role, giving pods running under that service account specific AWS permissions without storing credentials. Helios uses IRSA for all service account permissions. See [Security Architecture](/06-operations/security-architecture.md#service-identity).

---

## J

**Job (Dispatch context)**
A work order assigned to a technician via the Technician Dispatch System. A job has a type (e.g., "meter fault investigation"), a location, an assigned technician, a status, and a priority. Jobs are created automatically by the outage detection service for confirmed outages, or manually by operators. See [Technician Dispatch System](/03-services/technician-dispatch-system.md).

---

## K

**Kafka Lag**
The number of unprocessed messages in a Kafka topic waiting for a consumer group to process them. Zero lag means the consumer is keeping up. High lag means consumers are falling behind. A lag above 500,000 on critical grid topics triggers a SEV-1 alert. See the FAQ for more context.

**KMS (Key Management Service)**
AWS Key Management Service — used to manage the encryption keys that protect Helios data at rest. Helios has multiple customer-managed keys (CMKs) for different data classifications. See [Security Architecture](/06-operations/security-architecture.md#data-security).

---

## L

**LaunchDarkly**
The feature flag management service used by Helios. Allows features to be enabled/disabled at runtime without redeployment, and supports gradual rollout to specific customer tenants.

**Load Forecast**
See "Demand Forecast." The terms are used interchangeably in the energy industry; internally we prefer "demand forecast" for consistency.

---

## M

**MAE (Mean Absolute Error)**
A standard metric for forecast accuracy — the average of absolute differences between forecast and actual values. Helios tracks `forecast_mae_hourly` in Grafana. An MAE above 150 MW (for a large grid) triggers a forecast quality alert. See [AI Forecasting Engine](/03-services/ai-forecasting-engine.md#model-monitoring).

**MirrorMaker 2 (MM2)**
A Kafka tool used to replicate topics from one Kafka cluster to another — used in Helios for cross-region replication from eu-west-1 to eu-central-1 (DR). See [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md).

**MQTT**
Message Queuing Telemetry Transport — a lightweight publish/subscribe messaging protocol designed for IoT devices. Smart meters in Helios communicate over MQTT via AWS IoT Core. MQTT uses a broker model where devices publish to topics and services subscribe.

**Multi-Tenancy**
The architecture pattern where multiple customers share the same application instance but with strict data isolation. Helios is multi-tenant — all utility company customers use the same deployment, but a customer's data is strictly isolated via PostgreSQL row-level security and application-level tenant context (JWT claims).

---

## N

**NIS2 (Network and Information Security Directive 2)**
The EU directive on cybersecurity for operators of essential services, which came into force in October 2024. Lumina Energy is subject to NIS2 as a provider of digital services to energy sector "Essential Entities." See [Compliance](/06-operations/compliance-regulatory.md).

**NERC CIP**
North American Electric Reliability Corporation Critical Infrastructure Protection standards — the regulatory framework for cybersecurity of the US bulk electric system. Relevant when Helios expands to US customers (planned 2025). Not currently applicable.

---

## O

**OFGEM**
Office of Gas and Electricity Markets — the UK energy regulator. Our UK customers are licensed by OFGEM and must meet OFGEM's security and operational standards, which in turn constrains how Helios must operate for those customers.

**OTA (Over-the-Air Update)**
Remotely delivering firmware or software updates to IoT devices without physical access. Helios supports OTA firmware updates for smart meters and other managed devices via the IoT Device Management service. See [IoT Device Management](/03-services/iot-device-management.md#ota-updates).

**Outage**
A confirmed loss of electrical supply to one or more end consumers. In Helios, an "outage" is a classified event in the outage detection service following anomaly detection. An outage has a severity, affected meter count, estimated restoration time, and drives technician dispatch. See [Outage Detection Service](/03-services/outage-detection-service.md).

---

## P

**PITR (Point-In-Time Recovery)**
The ability to restore a database to any point in time within the backup retention window. Aurora PostgreSQL supports PITR, used in disaster recovery and data corruption scenarios. See [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md).

**PostGIS**
A PostgreSQL extension that adds support for geographic objects and spatial queries. Used by the GIS Mapping Service to store and query grid topology geographically (e.g., "which substations are within 5km of this point?").

---

## R

**Row-Level Security (RLS)**
A PostgreSQL feature that restricts which rows a database user or role can see, based on policy rules. Helios uses RLS to enforce tenant data isolation in the database layer — each customer's data is visible only to queries with the correct tenant context.

**RPO (Recovery Point Objective)**
The maximum acceptable amount of data loss measured in time. Helios's RPO is 15 minutes — meaning in a disaster scenario, we accept losing at most 15 minutes of grid data. See [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md).

**RTO (Recovery Time Objective)**
The maximum acceptable time to restore service after a disaster. Helios's RTO is 4 hours (revised from 2 hours after the September 2024 DR test). See [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md).

**RTU (Remote Terminal Unit)**
A field device used at substations to collect telemetry data and relay it to control systems. RTUs in Helios connect via MQTT or MODBUS-over-TCP bridges and report voltage, current, and switching status.

---

## S

**Schema Registry**
The Confluent Schema Registry service used to store and validate Avro schemas for Kafka messages. Every Kafka topic in Helios has a registered schema. Producers cannot publish messages that don't conform to the schema; this prevents malformed messages from reaching consumers.

**SEV-1 / SEV-2 / SEV-3 / SEV-4**
Incident severity levels. SEV-1 is most critical (customer-facing grid operations down or safety risk). SEV-4 is least critical (minor/cosmetic). See [Incident Response Runbook](/06-operations/incident-response-runbook.md#1-severity-definitions).

**Smart Meter**
An electricity meter that digitally records consumption data and communicates it remotely (as opposed to requiring manual reading). Smart meters are the primary IoT device type in Helios, with 42 million under management.

**SLO (Service Level Objective)**
An internal target for service reliability, e.g., "99.9% of API requests return within 500ms." SLOs are tracked in Grafana. SLOs are more granular than SLAs and are used for internal engineering accountability.

**SCADA (Supervisory Control and Data Acquisition)**
Industrial control system architecture used in critical infrastructure. Some of our customers' systems use SCADA protocols. Helios doesn't implement full SCADA but interfaces with customer SCADA systems via API bridges at several enterprise customers.

**Substation**
A part of the electrical grid that transforms voltage levels and switches current between transmission lines and distribution lines. Helios monitors substation sensors and status via IoT devices attached to substation RTUs.

---

## T

**TD (Technical Debt)**
Items in the [Technical Debt Register](/05-engineering/technical-debt-register.md) — identified areas of the codebase or infrastructure that need improvement. Referenced as TD-001, TD-002, etc. Example: TD-002 is the Node.js 16 dispatch service.

**Technician**
A field engineer who physically responds to grid faults, meter issues, and other field work orders. Technicians use the mobile application (built by the Helios team) to receive dispatch jobs and update job status. Their real-time location is tracked (with consent) for dispatch optimisation.

**Temporal Fusion Transformer (TFT)**
One of the neural network architectures used in the Helios AI Forecasting Engine. TFT is a multi-horizon time series model that handles multiple input features and provides interpretable attention-based forecasts. See [AI Forecasting Engine](/03-services/ai-forecasting-engine.md).

**TimescaleDB**
A PostgreSQL extension for time-series data, providing automatic partitioning (hypertables), compression, and time-series-specific functions. Used in Helios for the `grid_readings` and `grid_meter_events` tables. See [Database Architecture](/02-architecture/database-architecture.md).

**Toil**
Repetitive, manual operational work that doesn't provide lasting value — e.g., manually restarting services, running the same debugging command each week, manually applying retention policies. SRE teams track toil and aim to automate or eliminate it. See the On-Call Rotation Guide for Lumina's toil budget policy.

---

## V

**VPP (Virtual Power Plant)**
An aggregation of distributed energy resources (batteries, renewable generators, demand response programs) managed as a single virtual entity. Several of our enterprise customers are building VPP capabilities; Helios provides the monitoring and forecasting data layer.

---

## W

**Warm Standby**
A disaster recovery configuration where the secondary environment is running but at reduced capacity (e.g., 1 replica per service). Helios's eu-central-1 DR cluster runs in warm standby. In a failover, warm standby is faster to activate than cold standby (where you'd need to provision infrastructure from scratch). See [Disaster Recovery Plan](/06-operations/disaster-recovery-plan.md).

**WAF (Web Application Firewall)**
AWS WAF sits in front of all Helios public endpoints, filtering malicious requests, applying rate limiting, and blocking known-bad IP ranges. See [Security Architecture](/06-operations/security-architecture.md).

---

## X

**XGBoost**
An optimised gradient-boosting library used as one of the models in the AI Forecasting Engine ensemble. XGBoost is better than the TFT model for short-horizon (same-day) forecasting and for capturing repeating patterns. See [AI Forecasting Engine](/03-services/ai-forecasting-engine.md).

---

*Don't see a term you've encountered? Add it here — raise a PR against this file or post in `#developer-experience`.*
