# SOTA Agentic Harnesses & Frameworks — Research Report (mid‑2026)

> **Provenance:** deep-research run (106 sub-agents, 24 sources fetched → 119 claims extracted → 25 adversarially verified: **22 confirmed, 3 refuted**). Snapshot ≈ July 2026.
> **Confidence tags below:** `[verified]` = survived 3-vote adversarial fact-check against a primary source; `[secondary]` = reported by a blog/comparison source in this run but *not* independently verified; `[refuted]` = a hypothesis this run actively killed.
> **This space moves fast — reverify version-sensitive facts (SDK names, GA status, star counts, benchmarks) against official docs at build time.**

---

## 0. The one reframe that matters: it's the *harness*, not the model

`[verified]` **"Harness engineering"** is the discipline of designing the scaffolding *around* an agent — context delivery, tool interfaces, planning artifacts, verification loops, memory, and sandboxes — and this scaffolding, not the model, is what determines success or failure on real tasks. A Stanford/Tsinghua study cited up to **~6× performance swings from harness design alone** on a fixed model. Practical consequence for you: the frameworks below are mostly *packagings of the same anatomy*. Learn the anatomy (§3), then pick a packaging (§2).

`[verified]` **Anthropic's own advice** (from *Building Effective Agents*): **start with raw LLM API calls** — "many patterns can be implemented in a few lines of code" — because frameworks "create extra layers of abstraction that can obscure the underlying prompts and responses." Adopt a framework once you feel the pain it removes, not before.

---

## 1. Tiered recommendation — go from theory to running fast

### 🟢 General task/agent pipelines (tool use, loops, structured output, ETL/research agents)
1. **`anthropics/claude-quickstarts`** `[verified]` — MIT, ~17.3k★/3.0k forks, actively maintained. Its **`autonomous-coding`** starter runs on the **Claude Agent SDK** and demonstrates a **two-agent (initializer + coding agent)** pattern that builds apps over multiple sessions, with progress **checkpointed via git commits** (each feature = one atomic commit = a resumable checkpoint). Closest to what you've already been building. *Caveat: it's a sequential two-role handoff + git-resume, not hierarchical subagent spawning or a formal checkpoint API.*
   - `git clone https://github.com/anthropics/claude-quickstarts` → `autonomous-coding/`
2. **`langchain-ai/react-agent`** `[verified]` — MIT LangGraph template (Python; TS variant `react-agent-js`). Minimal, clean **ReAct loop** (reason → act via tool → observe → repeat → answer). New tools are "any Python function" in `tools.py`. Great for *seeing* the core loop and extending with your own tools. Built for LangGraph Studio.
   - `git clone https://github.com/langchain-ai/react-agent`

### 🔵 Production multi-agent systems (routing, memory, evals, observability, durability, HITL)
1. **OpenAI Agents SDK** `[verified]` — Python 3.10+ **and** JS/TS (`@openai/agents`); the successor to the deprecated Swarm. **Provider-agnostic** (OpenAI Responses/Chat + 100+ LLMs via LiteLLM). Core primitives *are* the harness patterns: **agents** (instructions/tools/guardrails/handoffs), **agent-delegation via handoffs**, **input/output guardrails**, **tools** (functions, MCP, hosted), and a real **human-in-the-loop** flow (tool approvals via `needs_approval`, serializable `RunState`, resume via `approve/reject`).
   - `https://github.com/openai/openai-agents-python`
2. **Mastra** `[verified]` — **TypeScript**, Apache-2.0, ~26.6k★. The strongest *single-framework* TS option: **one command scaffolds a runnable app** (`npm create mastra@latest`), and one framework bundles the *entire* harness — agents, a **graph workflow engine** (`.then()/.branch()/.parallel()`), memory, RAG, **built-in evals**, observability, **MCP server authoring**, and **suspend/resume HITL** that persists execution state.
   - `https://github.com/mastra-ai/mastra`
3. **PydanticAI** `[verified]` — **Python**, production-stable, from the Pydantic/Logfire team. Its differentiator is **first-class durable execution**: agents "preserve their progress across transient API failures and application errors or restarts" via **Temporal / DBOS / Prefect / Restate** backends. Best when crash-resilience matters. Clonable starter: **`coleam00/PydanticAI-Research-Agent`** `[verified]` (shows agent composition/delegation, DI via `deps_type`, `@agent.tool`, `TestModel` for testing, streaming via `.iter()`, usage/token tracking, error recovery — a real research/ETL-style reference). *Caveat: that starter's "multi-agent" is two-agent delegation; it's small (~140★, 14 commits).*
   - `https://github.com/pydantic/pydantic-ai` · starter: `https://github.com/coleam00/PydanticAI-Research-Agent`

### ⚫ Patterns to copy even if you adopt *no* framework
- **Anthropic — Building Effective Agents** `[verified]`: the canonical pattern catalog (§3).
- **HumanLayer — 12-factor-agents** `[verified]`: 12 copyable production principles + a plain `while`-loop agent design ("own the loop" instead of a black-box framework). `https://github.com/humanlayer/12-factor-agents`
- **OpenHands Software Agent SDK** `[verified]` (arXiv 2511.03690, MLSys 2026): the best *coding-harness reference design* — **event-sourcing agent loop** + **opt-in local→remote sandboxing** (§3).

---

## 2. Comparison matrix

**Verified-in-this-run frameworks** (primary-source checked):

| Framework | Lang | Best for | Abstraction | Multi-agent | Memory | Obs/Eval | Durability | HITL | License | Adoption | Clone this |
|---|---|---|---|---|---|---|---|---|---|---|---|
| **Claude Agent SDK** (via `claude-quickstarts`) | Py + TS | General pipelines; coding agents | Mid (raw-API-adjacent) | Two-agent handoff pattern shown | Via git/files | External | git-commit checkpoints | Via permission modes | MIT | ~17.3k★ | `anthropics/claude-quickstarts` → `autonomous-coding/` |
| **OpenAI Agents SDK** | Py + JS/TS | Production multi-agent | Low-mid, controllable | ✅ handoffs | Session/basic | Tracing built-in | Via app code | ✅ tool approvals + `RunState` | (OSS) | successor to Swarm | `openai/openai-agents-python` |
| **LangGraph** (`react-agent` template) | Py (+ TS) | Stateful orchestration; general pipelines | Low (graph, very controllable) | ✅ graph nodes | ✅ + long-term | LangSmith | ✅ checkpoint per node transition `[secondary]` | ✅ approval pauses `[secondary]` | MIT (template) | ~33.9k★, ~34.5M downloads/mo `[secondary]` | `langchain-ai/react-agent` |
| **Mastra** | TS | Production multi-agent (TS shops) | High, opinionated, batteries-included | ✅ agents + workflows | ✅ built-in | ✅ built-in evals | suspend/resume state | ✅ suspend/resume | Apache-2.0 | ~26.6k★ | `npm create mastra@latest` |
| **PydanticAI** | Py | Durable/crash-resilient production agents | Mid, type-safe | delegation | via deps | Logfire (native) | ✅ **Temporal/DBOS/Prefect/Restate** | supported | (OSS) | prod-stable | `coleam00/PydanticAI-Research-Agent` |
| **OpenHands SDK** | Py | *Reference design* for coding harnesses | Low (tiny composable core) | ✅ | event log | built-in security analysis | ✅ **event-sourcing replay** | ✅ | (OSS) | self-reported SWE-bench SOTA `[secondary]` | `arxiv.org/abs/2511.03690` + `docs.openhands.dev` |
| **pi-mono ("Pi")** | TS | Minimal reshapeable terminal *coding* harness | Very low, extensibility-first | — | — | — | — | terminal | MIT | npm `@earendil-works/pi-coding-agent` v0.82.1 | `badlogic/pi-mono` |

**Named in your scope but NOT independently verified in this run** (reported by comparison sources; treat as leads, verify at build) `[secondary]`:

| Framework | Lang | Reported positioning |
|---|---|---|
| **CrewAI** | Py | Role/crew-based multi-agent; high-level, fast to prototype |
| **Microsoft Agent Framework** | Py + .NET | **GA Apr 3 2026 as the unified successor to AutoGen *and* Semantic Kernel**; graph workflows w/ type-safe routing. ⇒ treat **AutoGen/AG2 & Semantic Kernel as legacy/folded-in** |
| **Google ADK** (Agent Development Kit) | Py | Google's first-party agent framework |
| **AWS Strands Agents** | Py | AWS first-party; now named in Anthropic's *Building Effective Agents* as an example framework |
| **HuggingFace smolagents** | Py | Minimal, code-first agents |
| **Vercel AI SDK** | TS | Tool/agent support for web/edge apps |
| **LlamaIndex Workflows** | Py | Event-driven agent workflows, RAG-strong |
| **DSPy** | Py | Prompt/program *optimization* (compile prompts), not a runtime harness per se |
| **Letta / MemGPT** | Py | Memory-specialized agents (long-term memory as the product) |
| **Agno** | Py | Appears on mid-2026 comparison shortlists |

> A July 2026 Langfuse comparison `[secondary]` tracks **13 current frameworks** (LangGraph, LangChain DeepAgents, OpenAI Agents SDK, Claude Agent SDK, Google ADK, PydanticAI, CrewAI, Strands, Mastra, Vercel AI SDK, Microsoft Agent Framework, Agno, smolagents) and treats **AutoGen and Semantic Kernel as deprecated**.

---

## 3. Reusable harness anatomy → who implements each pattern well

Copy these patterns directly; the framework column is where to read a good implementation.

| Pattern | What it is | Best references to copy |
|---|---|---|
| **Agent loop** | LLM emits structured tool call → deterministic code runs it → result appended to context → repeat until "done" | **12-factor #8** (verbatim loop def); **OpenHands** event-sourcing loop; **react-agent** ReAct loop |
| **Tool layer** | Tools are *just structured outputs* the model requests; your code executes them | **12-factor #4**; OpenAI Agents SDK `tools`; PydanticAI `@agent.tool` |
| **Context management** | You own the context window — decide what goes in, compact deliberately | **12-factor #3** (Own Your Context Window); Anthropic prompt-caching |
| **Memory / state** | Persist across turns/sessions; make the agent a *stateless reducer* over an event log | **12-factor #6/#12**; **OpenHands** append-only `EventLog` + replay; Mastra memory; Letta (memory-first) |
| **Sub-agent orchestration** | Decompose into specialized agents; route/hand off/parallelize | **Anthropic's 5 workflow patterns** (below); OpenAI **handoffs**; claude-quickstarts two-agent |
| **Verification / eval** | Check work before it ships; evaluator-optimizer loops | Anthropic **evaluator-optimizer**; Mastra **built-in evals**; LangSmith/Langfuse |
| **Human-in-the-loop** | Pause for approval; contact humans *as a tool call* | **12-factor #7**; OpenAI **tool approvals + `RunState`**; Mastra **suspend/resume** |
| **Permissions / sandboxing** | Constrain what the agent can do; run untrusted work in a box | **OpenHands workspace** (`Local`/`Docker`/`APIRemoteWorkspace`, opt-in, local→remote with minimal code change); Claude Code **permission modes** |
| **Durability / checkpointing** | Survive crashes/restarts, resume mid-run | **PydanticAI** (Temporal/DBOS/Prefect/Restate); **LangGraph** checkpoint-per-node `[secondary]`; **OpenHands** replay from `base_state.json` |

### Anthropic's pattern catalog (the theory you already have, named) `[verified]`
- **Workflow** = LLMs + tools on *predefined code paths*. **Agent** = LLM *dynamically directs itself*.
- Five composable **workflow** patterns: **prompt chaining · routing · parallelization (sectioning/voting) · orchestrator-workers · evaluator-optimizer**, plus one **autonomous-agent** pattern.

---

## 4. The "PI agent harness" disambiguation `[verified + refuted]`

- ✅ **Most plausible referent: `badlogic/pi-mono`** — a *minimal, reshapeable* **TypeScript terminal coding harness** ("Adapt pi to your workflows, not the other way around"), MIT, on npm as `@earendil-works/pi-coding-agent` (v0.82.1, ~399 dependents).
- ❌ **Refuted 0-3:** "PI agent harness = **PydanticAI**." (PydanticAI is a great framework — see §1 — but it is *not* what "PI harness" denotes.)
- ❌ **Refuted 0-3:** "PI = **Prime Intellect**'s `verifiers`." That's an **RL-environments** library for training/evaluating LLMs, *not* an agent harness.
- ⚠️ This one is interpretive — **confirm which "Pi/π" you meant**; it changes the single-repo pick.

---

## 5. Version-sensitivity flags (verify at build)

- **Claude Code SDK → renamed Claude Agent SDK.**
- **OpenAI Swarm → deprecated**, replaced by **OpenAI Agents SDK** (Py + JS/TS).
- **`anthropic-quickstarts` → now canonically `claude-quickstarts`.**
- **Anthropic's *Building Effective Agents* was updated** since its Dec 2024 original — its example-framework list now names **Claude Agent SDK** and **AWS Strands** (older mirrors cite LangGraph/Bedrock). Cached copies may be stale.
- **AutoGen/AG2 + Semantic Kernel → folded into Microsoft Agent Framework** (GA Apr 3 2026) `[secondary]`.
- **Star/adoption counts are point-in-time (~July 2026)** and drift.
- **OpenHands' SOTA benchmark numbers** (e.g. SWE-Bench Verified up to 76.6%, GAIA 80.0%) are **self-reported in the vendor's own arXiv paper**, not independently verified; its "uniquely better than OpenAI/Claude/Google SDKs" positioning passed only 2-1.

---

## 6. What this run did NOT cover (open follow-ups)

These were in scope but produced **no surviving verified claims** — they need a targeted second pass before the matrix is complete:
- **Frameworks:** CrewAI, Microsoft AutoGen/AG2, smolagents, Google ADK, AWS Strands, Vercel AI SDK, LlamaIndex Workflows, DSPy, Letta/MemGPT, Semantic Kernel.
- **Coding-agent reference designs:** Aider, SWE-agent, Block **goose**, Cline/Roo Code (only OpenHands was verified).
- **Supporting infra:** observability/eval (Langfuse, Braintrust, LangSmith, OpenTelemetry GenAI conventions) and sandboxing/execution (E2B, Modal, code-execution containers) — which pair best complements the picks above.

---

## 7. Cited sources (primary unless noted)

**Primary (verified against):**
- Anthropic — Building Effective Agents: https://www.anthropic.com/research/building-effective-agents
- anthropics/claude-quickstarts: https://github.com/anthropics/claude-quickstarts
- OpenAI Agents SDK: https://github.com/openai/openai-agents-python
- LangGraph react-agent template: https://github.com/langchain-ai/react-agent
- Mastra: https://github.com/mastra-ai/mastra
- PydanticAI: https://github.com/pydantic/pydantic-ai · starter: https://github.com/coleam00/PydanticAI-Research-Agent
- HumanLayer 12-factor-agents: https://github.com/humanlayer/12-factor-agents
- OpenHands Software Agent SDK (arXiv 2511.03690): https://arxiv.org/pdf/2511.03690 · https://docs.openhands.dev
- pi-mono: https://github.com/badlogic/pi-mono
- (refuted referents) Prime Intellect verifiers: https://github.com/PrimeIntellect-ai/verifiers

**Secondary (comparison blogs, not independently verified):**
- awesome-harness-engineering: https://github.com/ai-boost/awesome-harness-engineering
- Langfuse framework comparison (Jul 2026 update): https://langfuse.com/blog/2025-03-19-ai-agent-comparison
- LangChain framework guide: https://www.langchain.com/resources/ai-agent-frameworks
- AWS Builder "Picking an AI agent framework in 2026": https://builder.aws.com/content/3AzsgG6TreTO3uLRqpWNxfEyUhe/picking-an-ai-agent-framework-in-2026
- Firecrawl best open-source agent frameworks: https://www.firecrawl.dev/blog/best-open-source-agent-frameworks
- Speakeasy / qubittool comparisons; MongoDB "agent harness"; Appscale durable-execution; Latitude observability comparison (see run transcript for full list).
