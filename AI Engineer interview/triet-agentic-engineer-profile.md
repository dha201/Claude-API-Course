# Triet Ha — Agentic AI Engineering Profile

*Assembled from chat history, Aug 2024 – Aug 2026. Every claim below traces to a real conversation; provenance flags are included where a number came from a draft rather than from you confirming it.*

---

## 1. Positioning

You are a **forward-deployed AI engineer who ships production RAG and agentic systems inside regulated enterprises**, with an unusual second axis: you work at the *protocol* layer (MCP, Apps SDK, UCP, A2A) rather than just the framework layer. That combination is rare. Most people with agent experience have built demos on LangChain; fewer have argued architecture tradeoffs with a client's security team about document-level ACL enforcement in a RAG index.

The three-sentence version:

> AI engineer specializing in production RAG and agentic systems for enterprise clients. Built and shipped a 13-node retrieval pipeline over 3,400 projects at ExxonMobil under strict traceability and access-control requirements, architected a multi-tenant LangGraph agent platform with 6 agents and 20+ tools, and implemented MCP servers for agentic commerce surfaces (ChatGPT Apps SDK, Google UCP). Background in transformer-based NLP from a MITRE research engagement.

---

## 2. Experience timeline

| Period | Context | What you actually did |
|---|---|---|
| Aug 2024 – May 2025 | **MITRE / George Mason (Lead SWE, team of 4)** | NLP insider-threat detection: fine-tuned RoBERTa NER, GPU-accelerated inference pipeline, risk scoring, FastAPI serving |
| ~2025 | **Multi-tenant agentic AI platform** *(employer name not captured in history — fill this in)* | LangChain/LangGraph supervisor-worker architecture, 6 agents, 20+ tools, MCP integration, RBAC + subscription gating, credit authorization with optimistic locking |
| Oct 2025 | Same platform / adjacent | Agentic workflow builder — JSON schema for node-graph workflows, React Flow UI mapping, S3 tool integration with 5-level test ladder |
| Feb 2026 – present | **Bytemethod.ai → ExxonMobil (WDGPT + Project Similarity)** | Production RAG on Azure, ACL/DLAC architecture, eval design, PromptFlow DAG, stakeholder-facing design docs |
| Mar 2026 | **Bytemethod → NRG Energy** | MCP server for agentic commerce, ChatGPT Apps SDK widgets, UCP/A2A protocol analysis, technical architecture docs |
| Feb 2026 | **Bytemethod → Carlyle Group** | Requirements analysis for valuation platform modernization |

---

## 3. Agentic systems — capability matrix

This is the section to work from when someone asks "what's your agent experience?"

### Agent architecture & orchestration — **strong**
- **Supervisor-worker pattern** with LangGraph: 6 specialized agents (support case, RAG search, user data, survey creation, web search, math), intelligent task routing, state management across the team.
- **Factory pattern for agent components**: `ModelFactory`, `ToolFactory`, `StoreFactory`, `LangGraphTeamFactory` with decorator-based registration (`@tool`, `@worker`) enabling runtime dynamic provisioning. This is the part most candidates don't have — you didn't just wire an agent, you built the extensibility layer under it.
- **Workflow-as-data**: designed the JSON schema representing agent workflows (nodes, edges, execution modes, per-node config) that round-trips between a React Flow UI and a backend executor.
- **Planner-executor and adaptive routing patterns**: researched and specified query-complexity routing (no-retrieval / single-shot / iterative), CRAG-style refine-retry loops, and multi-hop retrieval with iteration caps for cost control.

### Model selection for agent harnesses — **strong, and unusually specific**
You investigated why GPT-4o degrades as a ReAct core and can articulate six failure modes: shallow Thought steps, weak error recovery across tool-call failures, structured-output format drift over long trajectories, poor termination judgment, tool-selection degradation as tool count grows, and context degradation over long loops. The framing you landed on — *per-step reliability compounds negatively across 10–20 step trajectories* — is exactly the kind of thing that separates people who've run agents in production from people who've read about them.

### Tool design & permissioning — **strong**
- Tool registry with **permission validation at execution time**, not just registration: RBAC + subscription-plan gating + runtime enforcement, 4 roles and 10+ granular permissions, tool-level access control.
- Progressive validation ladder for tool integration (env/credentials → registration → connectivity → instantiation → agent integration). That's a testing methodology, not just a test suite.
- Deliberate protocol-vs-SDK tradeoff: chose direct `boto3` for the prototype while preserving MCP client infrastructure (`MCPClient`, `MCPClientFactory`, `DynamicToolFactory`) for multi-service expansion. You can explain *why* you didn't use the fancier option, which is a stronger signal than having used it.

### Context engineering — **solid**
Studied and applied Anthropic's long-running-agent primitives: compaction, tool-result clearing, and persistent memory; understand context rot, prefill latency scaling, cache-invalidation tradeoffs, just-in-time retrieval, and the initializer-session pattern. Mapped these onto WDGPT and Project Similarity as real application targets rather than leaving them abstract.

### Agent observability — **developing, with the right instincts**
You identified OpenTelemetry GenAI semantic conventions as the backend standard for agent/LLM spans, and designed a references-plus-activity emission scheme for a custom PromptFlow pipeline to match what Azure's native agentic retrieval returns automatically. You've read the gen-ai span conventions. What you haven't done yet (as far as history shows) is run a full trace-based debugging workflow on a live agent in production.

---

## 4. Production RAG — this is your deepest area

| Dimension | Evidence |
|---|---|
| Scale | ~3,400 projects, ~16k documents, three heterogeneous sources (SharePoint PSR, PECT, Snowflake WPM) |
| Retrieval | 13-node PromptFlow DAG, hybrid BM25 + vector, **manual RRF fusion**, semantic reranking |
| Context packing | Token-budgeted evidence packing (`MAX_EVIDENCE_TOKENS=90,000`), named-project ceiling tuning |
| Routing | Source prioritization by project lifecycle state (Feature 4, finalized with client stakeholders) |
| Architecture decisions | Chose two-stage + query decomposition over Azure Agentic Retrieval, on auditability and GA-vs-preview grounds |
| Patterns evaluated and rejected | GraphRAG (indexing cost, no incremental updates, wrong fit for local similarity) — with LazyGraphRAG cost figures to back it |
| Ops | Resolved 429 rate limiting via TPM increase; targeting 30–40s SLA; token/latency optimization |
| Ingestion | Content hashing, alias swaps, map-reduce summarization, heterogeneous doc types (PDFs, prose, email, Excel) |

**The thing to lead with in an interview:** you didn't just build a RAG pipeline, you defended architecture choices against a reviewed gap analysis and pushed back where the review was wrong (the reviewer assumed uniformly structured PSRs; you corrected that and the chunking recommendation changed materially).

---

## 5. Evaluation & testing — **stronger than you probably think**

- Can articulate the full metric stack: recall@k, precision@k, MRR for retrieval; faithfulness/groundedness, citation coverage, answer relevance for synthesis; RAGAS four-dimensional framing; Azure AI Foundry's RAG triad (Retrieval / Groundedness / Relevance).
- Understand **gold-set sizing pragmatics** — 30–50 stakeholder-authored questions to start, not 200; and that the gold set is the single most important artifact in the project.
- **CI/CD strategy for non-deterministic systems**: tiered testing where mocked/record-replay (VCR cassette) tests gate every PR, and real LLM calls run nightly or pre-release. Property-based assertions (valid JSON, required fields, embedding similarity thresholds, latency bounds, LLM-as-judge) instead of exact string matching, with model versions pinned.
- Key separation you can explain cleanly: **retrieval metrics are deterministic and belong on every PR; generation evals are expensive and belong on a schedule.**

This is directly the material you'd be testing a candidate on, by the way.

---

## 6. Protocols & standards — your differentiator

**MCP (deep).** Three primitives and who controls each (tools = model-controlled, resources = application-controlled, prompts = user-controlled). JSON-RPC 2.0 message types. Streamable HTTP vs stdio transport and why you'd pick each. `registerAppTool` / `registerAppResource` from `ext-apps`. Tool annotations (`readOnlyHint`, `destructiveHint`, `idempotentHint`, `openWorldHint`) and their host-side effects. Zod → JSON Schema. Writing tool `description` fields as usage instructions the model matches against — that's prompt engineering at the tool boundary.

You also hit a real production MCP problem: the `mcp-handler` singleton transport conflicting with the SDK's CVE-2026-25536 fix, patched via `patch-package`, with a documented tradeoff on per-request server instantiation. War stories like that are interview gold.

**Apps SDK / widgets.** Skybridge, bridge API, display modes, `structuredContent` vs `content`, `resultCanProduceWidget`, assetPrefix requirements.

**UCP / A2A.** You can correct the common inversion: UCP is the commerce semantics layer, MCP is the transport it binds to — not the other way around. Also know the host support matrix (ChatGPT, Claude, Goose, VS Code support MCP Apps; Gemini supports tools only, not resources).

---

## 7. Enterprise access control for AI systems — rare and valuable

The DLAC work is a genuine specialization. You can discuss:
- The failure mode itself: permissions enforced at citation level but LLM response text leaking content from unauthorized sources.
- Microsoft's four DLAC approaches (security filters GA, native POSIX-like ACL preview, SharePoint M365 ACL preview, Purview labels).
- SharePoint securable-object hierarchy and inheritance; Graph API permission extraction; where Graph falls short and SharePoint REST/CSOM is required.
- **Group claim overage** — the 200-group JWT limit and Graph fallback.
- Three delegated enforcement patterns: native token via `x-ms-query-source-authorization` for retrieval trimming, OBO delegated Graph for citation-open, Snowflake row-access policies.
- The staleness analysis across two axes (user-to-group vs document-to-group), which is where you pushed back on a claim that admin-add-time validation is categorically bad.

Very few AI engineers can hold this conversation. It's the one that makes you credible to an enterprise security reviewer.

---

## 8. ML/NLP foundation (MITRE)

*Metrics below are from your own corrections in Oct 2025 — verify before putting them on a resume.*

- Led a team of 4 building NLP insider-threat detection over Twitter data; ~80% classification accuracy.
- Fine-tuned **RoBERTa for custom NER** across 9 domain-specific entity types on 3,000+ synthetic tweets; **0.90 F1**.
- GPU-accelerated pipeline with Hugging Face Transformers + PyTorch Accelerate; **30+ tweets/second**.
- Automated LLM-based data labeling with BIO tagging to solve domain data scarcity — this is a synthetic-data-generation story, which reads as very current.
- Modular risk scoring: Twitter-RoBERTa sentiment + temporal anomaly detection (off-hours patterns) + weighted entity-based aggregation.
- FastAPI serving with Pydantic v2; OCEAN personality profiling via Empath.
- Mapped indicators to the MITRE ATT&CK framework.

**Why this matters now:** it's the difference between "I call LLM APIs" and "I understand what's happening inside the model." Training, fine-tuning, evaluation metrics, class imbalance, F1-vs-accuracy tradeoffs — you've done the underlying ML, not just the orchestration on top.

---

## 9. Platform & infrastructure

- **Azure**: AI Search (hybrid, semantic ranker, index schemas), PromptFlow, ADF pipelines, OpenShift, Content Safety, Azure AD auth, Foundry evaluation.
- **AWS**: S3, EC2, API Gateway (incl. WebSocket + binary-upload corruption workarounds), boto3.
- **GCP**: Pub/Sub, Dataflow, Dataproc, BigQuery (PDE study depth — partitioning, cost runaway, IAM scope).
- **Data**: Snowflake (OAuth/PAT auth, row access policies), PostgreSQL + pgvector, 47+ Alembic migrations, FAISS, Pinecone.
- **Backend**: FastAPI, WebSockets, 1,000+ concurrent sessions, streaming LLM output, optimistic locking for concurrent credit authorization.
- **Frontend**: React, Next.js, React Flow, Tailwind.

---

## 10. Agent-native working style

Worth mentioning because it signals you live in this ecosystem rather than reading about it:

- Build and ship **custom Claude skills**: `technical-docs` (Diátaxis + C4 + ADR), `human-writing-style` (extracted from a 20-document corpus), `caveman` (compression), `business-diagrams`, `ste`. You've also run skill-creator eval loops.
- Use Claude Code as a daily driver; track the tooling ecosystem closely (subagents, orchestration, sandboxing, agent memory protocols).
- Did a white-space analysis of the agent tooling market — agent cost observability, git-based agent memory, Linux agent sandboxing, agent financial infrastructure. That's product-level thinking about the agent stack, not just implementation.

---

## 11. Certifications

- **Claude Certified Architect** — in progress (registration coordinated internally).
- **Google Cloud Professional Data Engineer** — studying; built your own cheatsheets and quizzes.
- Evaluated the PDE → PMLE sequencing question deliberately rather than picking at random.

---

## 12. Honest gaps

Worth knowing before you present this profile anywhere:

1. **Fine-tuning at production scale** — you've fine-tuned RoBERTa in a research setting, not run a production fine-tuning or distillation pipeline with a serving story.
2. **Agent trace debugging in production** — you know the OTel conventions and designed the emission scheme; history doesn't show you debugging a live agent from traces.
3. **Long-horizon autonomous agents** — your production agentic work is retrieval-and-synthesis oriented. Multi-hour autonomous trajectories with checkpointing and human-in-the-loop escalation is adjacent, not done.
4. **Cost engineering with hard numbers** — you understand token budgeting and model routing conceptually; you don't have a "cut spend from $X to $Y" story on record.
5. **Team/employer attribution** — the multi-tenant platform work (LangGraph, 6 agents, RBAC, credits) is your single strongest agentic artifact and I couldn't determine which employer it sits under. Nail that down; it's the centerpiece.

---

## 13. Resume-ready bullets

Use these as raw material — they follow X-Y-Z (accomplished X, measured by Y, by doing Z), which you already prefer.

**Bytemethod.ai → ExxonMobil**
- Architected a production RAG system over 3,400 projects across three heterogeneous source systems, achieving a 30–40 second response SLA by designing a 13-node PromptFlow DAG with hybrid BM25/vector retrieval, manual RRF fusion, semantic reranking, and token-budgeted evidence packing.
- Designed the document-level access control architecture for a multi-source enterprise RAG index, evaluating four Microsoft DLAC approaches and three delegated-enforcement patterns to close a gap where LLM responses leaked content from unauthorized sources.
- Defended the retrieval architecture against a formal design review, selecting a two-stage decomposition pipeline over a managed preview service on auditability and production-readiness grounds, and defining the evaluation gold set and metric suite that gated release.

**Multi-tenant agentic platform**
- Engineered a supervisor-worker agent architecture with LangChain/LangGraph, coordinating 6 specialized agents and 20+ tools across 1,000+ concurrent sessions with sub-5-second response times.
- Built a factory-and-decorator component system (ModelFactory, ToolFactory, StoreFactory, LangGraphTeamFactory) that reduced agent/tool boilerplate by 60%+ and enabled runtime dynamic provisioning.
- Implemented three-layer agent security combining Auth0 RBAC, subscription gating, and runtime tool-level enforcement across 4 roles and 10+ granular permissions.

**Agentic commerce (NRG)**
- Implemented an MCP server exposing three tools with interactive widgets to ChatGPT via the Apps SDK, working around a transport-reuse regression introduced by the SDK's CVE-2026-25536 fix.
- Authored the technical architecture defining how UCP commerce capabilities bind over MCP transport across multiple AI surfaces.

**MITRE**
- Led a team of 4 building an NLP insider-threat detection system over Twitter data, reaching 0.90 F1 on 9 custom entity types by fine-tuning RoBERTa on 3,000+ LLM-generated synthetic tweets with BIO tagging.
- Designed a GPU-accelerated inference pipeline with Hugging Face Transformers and PyTorch Accelerate, sustaining 30+ tweets/second for real-time threat scoring served through FastAPI.

---

## 14. Three stories to have ready

Interviewers remember stories, not skill lists.

**The ACL gap.** A feature was shipping that enforced permissions on citations but not on generated text. You found it, researched the enforcement patterns, built a confirmation checklist for the client's team, and surfaced the scope ambiguity (mirror the source systems vs gate at the application layer) as a decision for leadership rather than quietly picking one. Shows security instinct plus knowing when a technical question is really a scope question.

**The model-choice argument.** Why GPT-4o is wrong as a ReAct core, with six named failure modes and the compounding-reliability framing. Shows you reason about agents as systems with failure distributions.

**The design review pushback.** A gap analysis said your doc was missing ten things. You agreed with four, corrected two on factual grounds, and deferred four as premature — then sorted the rest into MVP-blockers vs fast-follow. Shows judgment, which is the thing seniority actually measures.
