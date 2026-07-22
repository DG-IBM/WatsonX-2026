# IBM Bluebook

> AI-powered onboarding for new team members — personalised knowledge maps built from your actual project documentation.

---

## What is IBM Bluebook?

IBM Bluebook solves a problem every new joiner faces: too much to learn, not enough signal on what actually matters for *their* role.

Traditional onboarding relies on static wikis, shadowing, and asking the right questions to the right people at the right time. Bluebook replaces that with a dynamic, personalised knowledge map generated from your team's real project documentation. You describe your role; Bluebook builds a reading plan, knowledge nodes, quizzes, and a chat assistant — all grounded in what your team has actually written down.

---

## How It Works

### 1 — Connect to your project knowledge base

Bluebook connects to **IBM Context Studio** via its MCP (Model Context Protocol) gateway. You provide:

- **MCP Gateway URL** — the endpoint for your Context Studio instance
- **MCP Gateway Token** — a short-lived JWT for the gateway itself
- **Context Studio API Key** — a longer-lived key that contains your `contextId`, used to scope queries to your project's document corpus

The `contextId` is extracted automatically from the API key JWT — no manual configuration needed.

> **CORS note:** The MCP gateway does not send CORS headers, so all queries are routed through a same-origin Next.js proxy (`/api/mcp/proxy`) rather than directly from the browser. This means the connection works in all standard browsers without any special configuration.

---

### 2 — Describe your role

You describe your job title, experience level, and what you'll be working on in a free-text field. Role starter templates are available for common roles (Frontend Developer, Backend Engineer, Delivery Manager, UX Designer, DevOps Engineer, QA Engineer, Data Analyst) — but they are intentionally generic so they work across any project.

The more context you provide, the more targeted your knowledge map will be.

---

### 3 — The Architect builds your map (Phase 1)

Your role description and project documents are sent to the **Architect** (`/api/llm/architect`). This LLM call:

- Identifies **8–18 topic areas** the person needs to understand, based on both their role and the actual project documentation
- Generates an **Onboarding Briefing Card** — a structured summary covering the project, your responsibilities, key contacts, first-week tips, a suggested reading path, and critical things not to touch
- Returns immediately with a skeleton map so the UI is responsive

Each node at this stage has a title and a one-sentence description. Full content is populated in Phase 2.

---

### 4 — Nodes are enriched in the background (Phase 2)

Once the map is displayed, each node is individually enriched via `/api/llm/enrich-node`, staggered 400ms apart to avoid rate limits. Each enrichment call produces:

| Field | Content |
|---|---|
| `summary` | 120–180 word plain-English explanation |
| `keyTakeaways` | 4 actionable bullets |
| `roleRelevance` | How this topic directly affects this person's day-to-day |
| `sources` | Cited documents or knowledge areas used |
| `quiz` | 3 situational multiple-choice questions |
| `keyContacts` | People to talk to about this topic (if in docs) |
| `diagrams` | ASCII diagrams if appropriate |

If you open a node before enrichment has finished, a **shimmer skeleton** is shown with a "GENERATING CONTENT…" indicator. The panel updates automatically when the content arrives — no refresh needed.

---

### 5 — Read, quiz, track

For each node you can:

- Read the overview, takeaways, and role relevance
- Take a **3-question situational quiz** (unlocks after 20 seconds of reading or on scroll-to-bottom)
- See a score (green / yellow / red) and a plain-English explanation of each answer
- Retake the quiz at any time

Overall readiness is tracked across all nodes: **Not Started → In Progress → Partially Ready → Ready → Fully Prepared**.

---

### 6 — Ask the Knowledge Assistant

A persistent chat assistant is available throughout the session. It has access to:

- **Live context queries** — each message triggers a `context-broker-hybrid-query` against Context Studio to retrieve the most relevant document chunks
- **Your completed node knowledge** — summaries and takeaways from nodes you've already read
- **Project documents** fetched during the role phase

The assistant is grounded in project documentation. It will not speculate or give generic advice — if something is not in the knowledge base, it says so and suggests who to ask.

---

## Technical Architecture

```
Browser
│
├── /connect         ConnectScreen — MCP credentials entry
├── /role            RoleScreen — role description + template starters
├── /solar-system    SolarSystemScreen — node map, detail panels, quizzes
├── /mission-control MissionControlScreen — full-page chat interface
│
└── API Routes (Next.js App Router, server-side)
    │
    ├── POST /api/mcp/proxy         — CORS proxy forwarding to MCP gateway
    ├── POST /api/mcp/connect       — Test MCP connection
    ├── POST /api/mcp/query         — Ad-hoc MCP query
    │
    ├── POST /api/llm/architect     — Phase 1: skeleton map + briefing card
    ├── POST /api/llm/enrich-node   — Phase 2: full node content + quiz
    ├── POST /api/llm/chat          — Streaming chat (SSE)
    └── POST /api/llm/briefing-card — Standalone briefing card generation
```

### Data flow for map generation

```
RoleScreen
  │
  ├── fetchProjectDocs()           (lib/mcpProxy.ts)
  │     └── POST /api/mcp/proxy   → Context Studio (4 parallel queries)
  │
  └── POST /api/llm/architect      → LLM (claude-sonnet-4-5)
        └── returns skeleton nodes + briefing card
              │
              └── nodes.forEach → POST /api/llm/enrich-node (staggered)
                    └── LLM (claude-sonnet-4-5) per node
```

### Data flow for chat

```
ChatInterface
  │
  ├── queryForChat()               (lib/mcpProxy.ts)
  │     └── POST /api/mcp/proxy   → Context Studio (top-8 vector results)
  │
  └── POST /api/llm/chat
        ├── liveKnowledge (from above)
        ├── completedNode summaries / takeaways
        ├── client-supplied project documents
        └── streaming response (SSE) → callLLMStream
```

---

## Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + IBM Carbon Design System (dark mode) |
| Fonts | IBM Plex Sans, IBM Plex Mono |
| Animation | Framer Motion |
| State | Zustand 5 (persisted to `localStorage`) |
| LLM client | `@anthropic-ai/sdk` (proxied via IBM ICA) |
| LLM models | `claude-sonnet-4-5` (structured), `claude-haiku-4-5` (chat) |
| Knowledge backend | IBM Context Studio via MCP gateway |
| Icons | Lucide React |

---

## Environment Variables

Copy `.env.local` and fill in your values:

```bash
# IBM ICA — LLM backend
ICA_BASE_URL=https://api.nextgen-beta.ica.ibm.com/ica/v1/chat-models
ICA_API_KEY=sk-...
ICA_MODEL=claude-sonnet-4-5          # structured JSON calls (architect, enrich)
ICA_CHAT_MODEL=claude-haiku-4-5      # streaming chat (faster, cheaper)

# IBM Context Studio — optional, can also be entered in the UI at runtime
NEXT_PUBLIC_MCP_URL=https://servicesessentials.ibm.com/mcp-gateway/...
NEXT_PUBLIC_MCP_TOKEN=eyJ...         # MCP gateway JWT
NEXT_PUBLIC_MCP_API_KEY=eyJ...       # Context Studio API key (contains contextId)
```

The MCP credentials can also be entered at runtime via the Connect screen — environment variables are optional pre-fills.

---

## Getting Started

```bash
# Install dependencies
cd bluebook
npm install

# Start the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

**First run:**
1. On the **Connect** screen, enter your MCP Gateway URL, Gateway Token, and Context Studio API Key. If you do not have a Context Studio instance, leave these blank — the app will generate a knowledge map from your role description alone using the LLM's general knowledge.
2. On the **Role** screen, describe your role or pick a starter template and customise it.
3. Click **BUILD MY KNOWLEDGE MAP**.

---

## Key Design Decisions

**Two-phase generation (skeleton → enrich)**
The map appears immediately after Phase 1 (~3–5 seconds). Each node is then enriched in the background at 400ms intervals. This avoids a long single wait and means the user can start reading while content is still being generated.

**Same-origin MCP proxy**
The Context Studio MCP gateway blocks browser-originated requests (no CORS headers). Rather than requiring a separate backend, Bluebook routes all MCP calls through `/api/mcp/proxy` — a thin Next.js route that forwards server-to-server. No infrastructure changes needed.

**Client-side context retrieval**
Live knowledge queries for chat are initiated from the browser (via the proxy), not the LLM route. This means the context is retrieved in parallel with the user typing, before the chat route is even called — reducing latency.

**Zustand persistence**
The full app state — nodes, scores, briefing card, chat history — is persisted to `localStorage`. Refreshing the page restores the session. Starting a new knowledge map calls `resetForNewSession()` to clear stale state.

**Role-agnostic templates**
Role starter templates describe job function and intent only — no mentions of specific modules, frameworks, or team names. They work for any project regardless of stack or domain.

---

## Benefits

**For the new joiner**
- A personalised reading plan in minutes, not weeks
- Content grounded in actual team documentation, not generic advice
- A chat assistant that knows the project and answers like a senior colleague
- Quiz-based verification so they — and their manager — know what has been understood

**For the team**
- Reduces the onboarding burden on senior engineers who would otherwise answer repetitive questions
- Surfaces knowledge gaps before they become incidents — the quiz flags areas that need follow-up
- Works with existing documentation: Confluence, wikis, architecture docs, anything indexed in Context Studio

**For the organisation**
- Consistent onboarding experience regardless of team, project, or location
- Fully grounded in proprietary internal knowledge — no data leaves the IBM ICA / Context Studio boundary
- No per-project configuration: connect the MCP gateway and describe the role — everything else is generated

---

## Project Structure

```
bluebook/
├── app/
│   ├── layout.tsx                  Root layout, IBM Plex fonts
│   ├── page.tsx                    Entry — redirects to /connect or /solar-system
│   └── api/
│       ├── mcp/
│       │   ├── connect/            Test MCP connection
│       │   ├── query/              Ad-hoc MCP query
│       │   └── proxy/              CORS proxy → MCP gateway
│       └── llm/
│           ├── architect/          Phase 1 map + briefing card
│           ├── enrich-node/        Phase 2 per-node enrichment + quiz
│           ├── chat/               Streaming chat (SSE)
│           └── briefing-card/      Standalone briefing card
├── components/
│   ├── screens/                    Full-page route components
│   ├── game/                       Node map, detail panel, quiz overlay
│   ├── layout/                     App shell, chat sidebar, briefing card panel
│   └── ui/                         Chat interface, loading, avatars, scores
├── lib/
│   ├── anthropic.ts                ICA LLM client (Bearer auth, streaming)
│   ├── prompts.ts                  All LLM system prompts and user prompt builders
│   └── mcpProxy.ts                 Client-side MCP helper (fetchProjectDocs, queryForChat)
├── store/
│   └── bluebookStore.ts            Zustand store (persisted)
├── types/
│   └── bluebook.ts                 All TypeScript interfaces
└── styles/
    └── globals.css                 IBM Carbon dark token system, IBM Plex fonts
```

---

*IBM Bluebook — built on IBM watsonx and IBM Carbon Design System.*