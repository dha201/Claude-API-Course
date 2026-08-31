# Module 1 — Claude Platform & Solution Design

This lesson is Module 1 of the Architect Foundations track. The notes cover the whole module as exam-prep study material:

- 12 sections — Module Introduction · How Claude Behaves · Platform Map & Primitives · Decomposition · Pattern Selection · Reference Architectures · RAG Pipeline Design · Model & Context Strategy · Prompting as Architecture · Entry Points & Governance · Assembly & Recap — each with its frameworks and the failure ("Watch Out") lesson condensed
- Every reference/decision table reproduced: the four properties, seven primitives, three-owner split, workflow sub-patterns, five-factor pattern choice, multi-agent failure table, reference architectures, chunking, indexing, context strategies (+ layered worked example), technique selection, library-vs-Skill, entry points, build-time interfaces, Claude Code layers, CSP delivery routes, regulated-industry constraints
- All 11 checkpoints with answers (explicit model answers reproduced verbatim; interactive drag-match checkpoints answered from the module's own teaching), plus the two graded exercises (RAG pipeline, reusable prompt asset) and the cumulative contract-review architecture — all with model answers
- Full glossary (25 terms, verbatim) and the recap (5 key takeaways)
- Every Cost · Complexity · Risk note and every "(see S11)" cross-reference preserved inline

> **Claude Certified Architect – Professional Prep Course** · Module 1 (Foundations track)
> Source: SCORM deck `Architect_M1_vF2.html`.
> Study notes — condensed teaching narrative + verbatim reference tables, glossary,
> checkpoint answers, and model answers extracted from the module.
> 34 screens · 12 sections · 11 checkpoints.
>
> **Exam-scope flags:** this module carries **no [Partner Track] exclusions and no
> on-blueprint domain tags** — every screen is in scope. The only inline markers are
> **(see S11)** cross-references pointing to the Reference-Architectures screen; they are
> preserved where they appear.

---

## Orientation — what this module makes you able to do

Designing solutions with Claude goes beyond choosing a model. Before you build, **four decisions shape everything after them** — and getting them out of order is the most reliable path to an expensive pivot:

1. **What part of the work should Claude own?** — what to hand Claude, what to leave with existing systems, what stays with a human.
2. **What shape is the work?** — augmenting a live call, automating a workflow, or an agent that acts on its own.
3. **Which reference architecture are you committing to?** — naming it upfront saves expensive later pivots.
4. **Where does the work interact with Claude?** — entry point, model, and context strategy that keep the solution working and cost-conscious.

**Learning objectives — by the end you can:**
1. Break a partner request into what Claude does / existing systems do / humans do, using the **four properties of generative AI** as the decision lens.
2. Choose between an augmented call, a workflow, and an agent **by naming what each choice costs**.
3. Pick a reference-architecture pattern for the problem shape, and recognize when **retrieval is doing a job live-state should own**.
4. Make defensible model, context-window, and context-strategy decisions, and use **evaluations as the gate before any model swap**.
5. Know where each platform entry point fits (Claude.ai, API, SDK, Claude Code, MCP) and what customization belongs at each layer.
6. Distinguish the **entry points a user sees**, the **build-time interfaces an engineer codes against**, and the **delivery routes an enterprise procures** — and identify which are ruled out by governance/regulated-industry constraints *before any other tradeoff applies*.

**Who it's for:** the Architect who turns a partner's ambiguous request into something someone can build, fund, and defend. You are not writing production code here; you are making the decisions that sit *above* the code.

**The work:** one sample engagement — take a business problem from an enterprise buyer (often regulated, high-stakes) to a proposed architecture you can defend when a credible alternative is on the table. The decisions map to the sections: **Decomposition** (assign each part to Claude / a system / a human; over-assigning to Claude is the most common, most expensive early mistake), **Pattern selection** (augmented call / workflow / agent — naming the costs is the objective), **Reference architectures** (a known blueprint fits or is misapplied — watch for retrieval quietly doing a live-state job), and **Model, context, and entry point** (tier, context strategy, delivery route — evaluations become a stage-gate, and governance/regulated constraints rule a route out *before* cost or latency). The objective is to **recognize which decision is in front of you**, since each rewards a different move.

*Disclaimer: educational content, not legal/financial/professional advice; examples are illustrative and often fictitious; verify against Anthropic's website/docs; Anthropic terms and policies control.*

---

## 1. How Claude Behaves — the four properties architects design around

**Core idea:** four model properties shape every design decision that follows. **None is a flaw to fix — each is a force you design around**, like a structural engineer designing around a material's properties. The same characteristic that makes Claude capable in one situation makes it fail in another; read each as *capability + matching limitation + the mitigation an architect reaches for.*

| Property | Capability | Limitation | Mitigation |
|---|---|---|---|
| **Next-token prediction** | Tasks built on common patterns: summarizing, reformatting, explaining well-established concepts. | Anything requiring precision on specifics. Can produce text that *looks* accurate but isn't — risk concentrates around names, dates, citations, statistics. | Citations, uncertainty signaling, generator-verifier loops; route factual lookups through tool calls / authoritative sources. |
| **Knowledge** | Topics common, recent, and consistent in training data — answered reliably from what it learned. | Topics rare, niche, contested, or fast-changing. May present stale/incomplete info in the same confident tone as established fact. | Web search, retrieval (RAG), tool use, or MCP to make an **external system the source of truth**. When freshness or authority matters, re-introduce the data yourself. |
| **Working memory** | Anything that fits in the active context window. | The window is a **hard edge** — once content falls outside it, the model has no access at all. Two errors at the edge: an **oversized request** rejected before generation (over token limit → `400 invalid_request_error` "prompt too long"; over byte limit → `413 request_too_large`), vs. a prompt that fits but whose **generation hits the ceiling** and stops early (`model_context_window_exceeded` stop reason, truncated output). | Progressive context loading, chunking, front-loading critical info; Projects for extended work; summarize across turns. Check the `usage` field on every response and the token-counting API before sending. |
| **Steerability** | Short, concrete, verifiable instructions — defined formats, explicit length limits, clear roles. | Abstract/ambiguous instructions, long reasoning chains, precise numeric/logical computation. May follow the *letter* of an instruction while drifting from intent. | System prompts, structured outputs, code execution for logical precision; deterministic computation/tool execution owns high-stakes numeric answers. Restate the goal alongside the instruction. |

**From property to design consequence** (forward pointers preserved):
- **Non-determinism** — same input can produce different outputs across runs. *This is why evaluation frameworks exist: you cannot certify behavior you observed once.* (Feeds evaluation work in **Module 2**.)
- **Context as a finite resource** — a hard edge with a fixed token budget; what you put in, in what order, and what you leave out are design decisions affecting capability *and* cost. (Feeds model & context strategy, later this module.)
- **Confidence is not validity** — Claude can produce a wrong answer in the same fluent tone as a right one. *This is why human-in-the-loop placement and verification are architectural choices, not afterthoughts.* (Feeds responsible-deployment work in **Module 3**.)
- **Knowledge and capability boundaries** — reliable on common/recent/consistent topics, unreliable on rare/private/fast-changing ones; use search, retrieval, tools, MCP to make an external system the source of truth. (Feeds reference architectures and RAG, later this module.)

**⚠ Watch Out — "a failure that began with a misread property."** An architect saw a demo run cleanly five times and concluded the behavior was deterministic, then shipped a financial-reconciliation pipeline that treated each output as fixed and built no checks. In week two, the same statement re-processed produced a different categorization — caught only by chance when an analyst re-ran a batch. Nothing in the input changed; the model is non-deterministic and the architecture had been built as though it wasn't. **Lesson:** a demo is not evidence of determinism; the four properties are present whether your architecture acknowledges them or not.

**Cost · Complexity · Risk:** designing without these properties is the most expensive mistake — the cost lands *after* launch when rework and trust-rebuilding are hardest; naming them upfront keeps design talks precise ("this is a knowledge-boundary problem" vs. "is it good enough?"); the properties don't announce themselves — an unprepared system doesn't error, it *drifts quietly*, surfacing in an audit or an angry user, not the system itself.

---

## 2. Platform Map & Primitives

### Three layers, three distinct decisions

These are **not alternatives** — every deployment involves all three, and confusing them is the most common source of muddled architecture conversations.

| Layer | What it is | Examples |
|---|---|---|
| **Entry Points** | What a person or system directly interacts with — the wrappers that decide who can talk to Claude and how. | Claude.ai (web/mobile/desktop), Claude Code, a custom app built on the API. |
| **Build-time interfaces** | How an engineer programs against Claude — the layer the partner's code is written to. | The direct API, the SDKs, MCP, the Agent SDK. |
| **Delivery routes** | Where API traffic terminates — whose infrastructure the request runs on. | Anthropic directly, AWS Bedrock, GCP Vertex AI, Microsoft Foundry. |

An entry point is chosen for the **user and the work**; a build-time interface for the **engineering team and integration**; a delivery route for the partner's **cloud commitments and compliance posture** — three conversations with three stakeholders, and a decision in one layer rarely dictates the others.

**⚠ Watch Out — "collapsing the layers."** A proposal put Claude Code (an engineering entry point) in front of non-engineering bank-branch staff because "it's all Claude." The same model *does* sit under every entry point — but the entry point is the wrapper, and Claude Code was built for developers in a terminal, not branch staff following a workflow. **Lesson:** treating the three layers as one erases the distinction that should have ruled the choice out immediately.

**Cost · Complexity · Risk:** every entry point carries its own integration cost — picking the wrong layer means paying for the wrong solution then paying to replace it; naming the layers precisely lets a review isolate exactly which decision is contested instead of arguing in circles; an entry point chosen before the user is named is a common, avoidable error traceable to collapsing the three layers.

> **Checkpoint — "Place each piece in its layer"** (8 items → three buckets). *Answer, from the teaching:* **Entry Points** = claude.ai, Claude Desktop, Claude Code · **Build-time Interfaces** = Direct API, SDKs, MCP, Agent SDK · **Delivery Routes** = Bedrock / Vertex / Foundry.

### The seven primitives an architect assembles from

Every pattern later in the course is an assembly of these. Learn each as **one job**; the skill is *composing* them.

| Primitive | One-word job | Definition |
|---|---|---|
| **Tools** | Act | What lets the model take an action or fetch a result from your code — a function the model can call. |
| **MCP** | Connect | A protocol for exposing a set of tools so multiple Claude clients can reach the same entry points. |
| **Subagents** | Isolate / parallelize | Hand a scoped sub-task to a separate context so work runs in isolation or in parallel. |
| **Hooks** | Guarantee | Deterministic code that fires on defined events to enforce a rule the model cannot skip. |
| **Skills** | Package a procedure | A versioned, reusable unit (instructions + optional scripts) packaging a repeatable procedure. |
| **Agent Teams** | Coordinate peers | Multiple agents working as coordinated peers, each owning part of a larger goal. |
| **Dynamic Workflows** | Compose at runtime | Assemble the steps of a workflow at runtime rather than fixing them in advance. |

*Agent Teams and Dynamic Workflows extend the older vocabulary of single agents and fixed workflows; you'll hear them in current practitioner talk even though many existing systems predate them.* Why inventory now: the later patterns (augmented call, workflow, agent) are each a particular assembly of these — a workflow is steps wired in your code (often using tools), an agent is the model choosing its own sequence of tool calls, a multi-agent system is an orchestrator delegating to subagents.

**⚠ Watch Out — "missing shared vocabulary."** In a review, "we'll use an agent" meant five different things to five people (single tool-using model / multi-step workflow / team of subagents / Claude Code / a chatbot); the conversation stalled 20 minutes before anyone noticed. **Lesson:** shared primitive vocabulary is what lets a team operate with clarity.

**Cost · Complexity · Risk:** reaching for a heavier primitive than the job needs is paid in latency, tokens, and operational surface every request (e.g. a team of agents where one tool call would do); each primitive is a part to build, observe, and govern — use the fewest necessary; without shared vocabulary teams can't communicate because they don't agree what the parts are.

> **Checkpoint — "Match the primitive to the job"** (readiness check, 3 sets). *Answers, from the teaching:*
> - **Set 1 (property → design consequence):** Non-determinism → *why evaluation frameworks exist* · Knowledge boundary → *why retrieval and tools exist* · Context as a finite resource → *why context strategy is a design decision* · Confidence is not correctness → *why human-in-the-loop placement matters*.
> - **Set 2 (piece → layer):** Claude Code → *Entry point* · MCP → *Build-time interface* · Bedrock → *Delivery route*.
> - **Set 3 (primitive → job):** Tools → *Act* · Subagents → *Isolate / parallelize* · Hooks → *Guarantee* · Skills → *Package a procedure*.

---

## 3. Decomposition — where Claude fits (Claude / systems / humans)

**Core idea:** you already make three decisions — what the ask is, which systems address it, where human judgment is needed. This module adds a fourth: **where Claude can help**, with specificity. Architects get this wrong by lacking a concrete grasp of Claude's predictable strengths and failure modes.

**Every solution has three owners — assign them early:**

| Owner | What belongs here |
|---|---|
| **What Claude does** | Work that benefits from language understanding, summarization, planning, drafting, or tool-mediated action. |
| **What existing systems do** | Anything the partner has already paid to make reliable: the order-status service, the policy engine, the rules table, the database of record. |
| **What humans do** | The judgment calls, exception paths, approvals — the moments where being *right* matters more than being *fast*. |

Over-assigning to "what Claude does" almost always makes the process more expensive, slower, and harder.

**Delegation — deciding what Claude is *trusted* to own** (the first AI-Fluency competency). Decomposition produces a **delegation map**: for each part, decide not just whether Claude *can* but whether it *should* own it — AI-appropriate, human-retained, or collaborative (Claude drafts, a person decides). Justify each assignment through **Reversibility** (can a wrong call be undone?), **Stakes** (what does a wrong call cost?), **Accountability** (who must answer for it?).

**Worked decomposition — "claims triage assistant" (read → decide priority → look up coverage → email adjuster):**
- *Read the claim* → **Claude.** Pattern-rich language work; with a constrained output schema, next-token prediction and steerability both work in your favor.
- *Decide priority* → **existing system.** Looks like language work but priority is a deterministic rule the partner maintains — it lives in a rule engine, not Claude's training data. Claude *calls* the rule engine.
- *Look up policy coverage* → **existing system**, higher stakes. Coverage changes; the model can't know when its training-era version went stale. Answer must come from the live coverage system via tool use/MCP.
- *Email the adjuster* → **split.** Drafting = Claude; sending = the email system; a **human** approves above a value threshold (Claude's working-memory + steerability limits are both risks if it acts alone).

**The framing shift (the key concept this module builds toward):** ask *"where do the four properties argue for Claude over the system that already does this right?"* — not *"where can Claude help?"*

**⚠ Watch Out — "the deterministic check that quietly drifted."** A scoping call: the partner had a rule that *any claim over £5,000 needs a senior adjuster*, enforced today by an SQL check. The architect offered to have Claude "extract the amount and route if over 5K… keeps it in one step, way simpler." Three months later, of 14,000 claims, **41 routed incorrectly** — all where the amount was inside a sentence ("damages estimated around five thousand pounds"); the model read "around five thousand" as a loose estimate, not a trigger, and sent them to standard handling. A **deterministic rule that must be right every time was folded into a probabilistic system that is right most of the time** — the gap is where the 41 lived. No test cases guarded routing (they'd treated it as something the model "just handles"), and per-request model logging doesn't record the choices made inside a single request, so nothing flagged the drift — an **audit** caught it. **Lesson:** a rule the business counts on must be tested, watched, and owned by a human; clean cases are what you see in demos, so "most of the time" hides until the audit.

**Cost · Complexity · Risk:** every lookup a deterministic system could do gets billed to the model instead — cheap per call, expensive across thousands; moving table-driven logic into the model makes errors untraceable (a rule fails predictably, a model produces variable, hard-to-diagnose output); the model has no reliable way to know its info is stale and won't flag the gap, so authoritative answers drift silently.

> **Checkpoint — "Sort the field-service capabilities"** (8 items → Claude / Existing Systems / Human). *Answer, from the decomposition framework:* **Claude** — summarize case notes into a one-page handover; extract the part number from a photo of the unit label; draft a follow-up email explaining the delay. **Existing Systems** — return current stock level of SKU 78-A at the closest warehouse (live state); calculate total billable time across three tickets (deterministic computation); tell whether the warranty applies to a serial number (authoritative lookup). **Human** — approve a refund above £2,000; decide whether to escalate a safety incident to the field manager.

> **Checkpoint — "Decompose the request"** (logistics brief, 5 steps → owner). *Answer, following the claims-triage pattern:* Read the carrier's free-text exception note → **Claude**; decide whether it qualifies for an automatic refund under the published policy → **Existing System** (deterministic policy rule); look up the customer's contract tier → **Existing System**; draft the customer notification → **Claude**; issue the refund → **Human**-approved / executed by the existing payment system (a high-stakes, consequential action — gate above threshold rather than let the model act alone).

---

## 4. Pattern Selection — augmented call, workflow, agent

**Core idea:** once you know which parts Claude owns, decide the *shape* of its involvement. Three patterns, each taking a position on two axes — **predictability** (how predictable the path is) and **model autonomy** (how much you hand the model).

- **Augmented LLM** — a single model invocation; you send the request, the model does one bounded job in one pass, your code wires around it (you can add tools/retrieval/extended thinking). Control flow never branches on what the model decides. *Use when the task is well-defined, output is verifiable, and there's no reason to split it.* → high predictability, low autonomy.
- **Workflow** — you decompose into named steps and orchestrate them **in your own code** (each step may or may not call Claude). Because control flow lives in your code, you can log, test, and reason about it like any software. *Use when error cost is real, observability matters, and steps can be determined in advance.* → middle band.
- **Agent** — you give Claude a goal and tools; **the model determines its own sequence** of steps. Control flow lives inside the model — the path isn't written anywhere you can inspect. *Use only when the path can't be enumerated in advance and the cost of an unexpected output is acceptable and recoverable.* In production, agents are bound by constrained tool entry points, per-turn budgets, explicit permissions, and stopping criteria — **not options**; they keep an agent from becoming a liability. → high autonomy, low predictability. (Claude Code is a production-proven example: it explores an unfamiliar codebase, deciding which files to read from what it has found.)

### Four workflow sub-patterns

| Sub-pattern | Shape | When it earns its place | Example |
|---|---|---|---|
| **Chaining** | Step 2 takes step 1's output as input; sequential, linear. | Task decomposes into stages with clear handoffs (extract → classify → summarize); each stage has a defined output the next consumes. | Contract review: call 1 extracts obligations/deadlines, call 2 classifies each by risk, call 3 drafts a summary memo. |
| **Routing** | A classifier (often Claude) decides which downstream path to take. | Inputs vary in kind and different kinds need different handling. | Support ticket: classifier routes billing → account-data retrieval, technical → product-doc retrieval, escalations → human queue. |
| **Parallelization** | Multiple calls run concurrently; results aggregated or voted on. | Sub-tasks are independent and can run at once (reviewing multiple files / distinct sections). | Due-diligence over twelve supplier contracts — each to a separate call simultaneously, all aggregated into one risk report. |
| **Evaluator-optimizer** | One call produces a first attempt; a second evaluates and requests revision; loop until a quality bar or retry limit. | Quality is verifiable but a single attempt isn't reliable enough (code-gen against a test suite, strict-schema extraction). | Draft a complaint response; a grader checks it against a rubric + structure, returns feedback, generator rewrites, loop exits on pass or retry limit. |

*Not mutually exclusive — most production workflows combine them. Pick the simplest that meets the error-tolerance and observability requirements, then revisit with production data; escalate only when measurement shows the simpler pattern falling short.*

### Five-factor pattern-choice framework

Walk the factors **in sequence**; the **first factor that rules out a pattern is the deciding one.**

| Factor | Question | Augmented LLM | Workflow | Agent |
|---|---|---|---|---|
| **Predictability** | Can you enumerate the steps in advance? | Low: single bounded task. | Low: you wrote the path. | High: trajectory is unpredictable by design. |
| **Error cost** | What does a wrong answer cost — retry, audit, lawsuit? | Medium: exposes the model's output distribution without step-level guards. | Low: deterministic guards sit between steps. | High: full output distribution across multiple turns. |
| **Observability** | Can ops see what happened and reconstruct why? | Medium: one call is easy to log but opaque inside. | Low: steps log as code does, standard tooling. | High: the trajectory reads like a transcript; most current tooling isn't built to alert on this. |
| **Latency budget** | What's the user-visible deadline? | Low: fastest in standard configs (extended thinking/retrieval adds time). | Medium: predictable but additive. | High: open-ended runtime; budget for the worst case, not the median. |
| **Cost** | Per-request token cost at expected volume? | Low: fewest tokens. | Medium: scales with step count. | High: iterative reasoning, multi-turn tool use, retries, growing context. Poorly bounded agents are often the most expensive pattern. |

**Try prompting before fine-tuning.** On Claude, reaching for fine-tuning first is usually wrong. Work through: (1) **optimize the prompt** — most reliability problems are prompt problems; (2) **add tool use / retrieval**; (3) **move to a stronger pattern** (e.g. evaluator-optimizer); (4) **only then fine-tune.** Fine-tuning fits when the task runs at very high volume and inference cost is the constraint, latency is critical and a smaller specialized model wins, or the output must follow a consistent format prompting hasn't solved. Otherwise it locks you to a fixed model version. *Note on availability: fine-tuning Claude is not broadly available — access is limited, varies by model and delivery route; confirm current options with the Anthropic account team before recommending it.*

**Skills-based architecture as a packaging option.** Alongside the pattern, decide packaging on a spectrum: **prompt-only** (instructions alone) → **direct tool use** (model calls your functions) → **Skills-based** (a versioned, reusable Skill packaging the procedure + instructions + scripts as one governed unit). Reach for a Skill when the procedure runs repeatedly, must distribute across teams/products, or must be versioned and governed. Apply the **Delegation** lens to the pattern itself: an autonomous agent is right only when stakes and reversibility justify the autonomy it's given.

**⚠ Watch Out — "wanted flexibility, got non-determinism."** Three quotes from one team's 90-day retro name three compounding failures: (1) *"we picked an agent because we didn't want to constrain it too early… by month two we'd rewritten the workflow inside the agent loop, minus the logging"*; (2) *compliance asked which step approved the disbursement — they could only point at a model turn, and the model version had rolled forward two weeks earlier with no re-validation*; (3) *mining traces, the actual paths fell into **only four shapes** — a router and four chains, six months saved.* The team optimized for unknown future flexibility over the known present shape; agent autonomy became a compliance problem because there was **no discrete auditable step** to point to; an unpinned model version compounded it (a governance gap that would hurt under *any* pattern — only one of the two failures is about the agent pattern itself). **Lesson:** choosing an agent when unsure is not a safe default — an agent is right *only* when the steps genuinely can't be determined in advance; if they're known, you pay for unused flexibility in tokens, latency, and audit gaps.

**Cost · Complexity · Risk:** agents don't automatically cost more — what drives cost is accumulated context and number of calls; a poorly designed workflow can cost more than a well-designed agent (design matters more than the label); workflows fail when a code step fails, agents fail when the model makes a bad decision in a sequence (harder to spot, standard debugging won't catch it); **an agent's autonomy is your liability surface** — keep the tool entry point as narrow as the task allows.

---

## 5. Multi-agent systems and orchestration

**Core idea:** when a problem is too large or varied for one agent's context, move to an **orchestrator** that decomposes and delegates, plus **subagents** that each carry part.

- **The orchestrator** owns the goal — decomposes the work, decides what to delegate, synthesizes results into one answer. *It never does the sub-task work itself.*
- **The subagents** own scoped sub-tasks — each runs in its own context, does one piece, returns a result.

Three things must be **designed, not assumed**: how work is decomposed, how each result is structured so the orchestrator can combine it, and how the orchestrator resolves conflicts/gaps.

**The worked pattern — fan-out over a large work item** (a 400-file codebase, a 200-doc corpus, a filing vs. fifty rules): the orchestrator splits into independent units, dispatches one subagent per unit (in parallel where units don't depend on each other), then synthesizes. The win is twofold — each subagent works in a clean context sized to its unit, and independent units run concurrently.

**Error recovery — ask "where is each failure mode recoverable?"** A **subagent failure is usually recoverable** (retry, re-route, or drop-and-flag while the rest proceeds). An **orchestrator failure is usually not** (if the agent holding the goal and synthesis loses its thread, the whole run fails and partial work is stranded). Design for this asymmetry: make subagent work **idempotent and retryable**, and protect orchestrator state.

| Failure | Where it lands | Design response |
|---|---|---|
| A subagent returns a malformed or empty result | Subagent boundary (recoverable) | Validate each result; retry or re-route the failed unit; record the gap rather than failing the run. |
| Two subagents return conflicting results | Synthesis step (recoverable) | Give the orchestrator an explicit conflict-resolution rule, or escalate the conflict to a human. |
| The orchestrator loses the goal or its synthesis state | Orchestrator (often unrecoverable) | Protect orchestrator state; checkpoint progress so a failed run can resume rather than restart. |
| Traces fragment across orchestrator and subagents | Observability (cross-cutting) | Propagate a shared trace identifier so a single run is reconstructable end to end. |

**Human-in-the-loop checkpoint patterns.** A multi-agent system can take many actions before a human sees output, so **checkpoint placement is deliberate**: a HITL checkpoint is a gate that pauses for review, positioned by the **risk and reversibility** of the action about to be taken. Gate before any irreversible/high-stakes action a subagent would otherwise take autonomously; **sample** lower-stakes actions rather than gating each. (Full routing-by-stakes comes later; the point here is the gate is part of orchestration design, not bolted on.)

**⚠ Watch Out — "fan-out hid a dropped unit."** A compliance team checked a 50-section contract against a policy checklist, one subagent per section; the orchestrator synthesized "48 sections reviewed, 3 flagged" and circulated it to legal. **Two sections had never been reviewed** — one subagent timed out (returned nothing), another failed to parse a scanned page (returned empty) — and the orchestrator, given **no coverage check**, counted only the results it received. Three gaps lined up: the count was never reconciled (no rule that results returned must equal units dispatched), a recoverable failure had nothing watching the subagent boundary, and the fluent summary read as complete. **Lesson / fix:** a coverage check at synthesis — results returned must equal units dispatched, or the run flags the difference before anyone reads it.

**Cost · Complexity · Risk:** multi-agent multiplies token spend (each subagent has its own context; the orchestrator pays to synthesize) — reach for it only when work genuinely exceeds one context; each added agent is another failure boundary to observe and govern; the dangerous failure is the **silent** one — a subagent drops a unit and the orchestrator synthesizes a confident, complete-looking answer over incomplete work. Validate coverage, don't assume it.

> **Checkpoint — "Critique the orchestration design"** (select the 3 components with a control/failure-boundary defect, of 6). *Answer:* **#3** synthesis sums returned verdicts with no coverage check; **#4** irreversible action (auto-archive) with no human gate; **#5** no retry or gap-flag on a failed subagent. (#1 decomposition, #2 parallel subagents returning verdicts, and #6 shared trace-ID propagation are sound.)

---

## 6. Reference Architectures — the shapes the industry has already paid to learn

**Core idea:** reference architectures are **references, not blueprints to adhere to.** The goal isn't matching a problem to a fixed design; it's understanding the common patterns well enough to *generalize* — take the shape that fits, adapt it, and recognize when a workload draws on more than one at once. Most partner problems map to a handful of patterns already proven in the Claude ecosystem.

| Pattern | What good looks like | Where projects go wrong |
|---|---|---|
| **Agent** *(see S11)* | Model works toward a goal by deciding which tools to call and in what order; autonomy checked by limiting tool power and a turn budget. Use when the path can't be written in advance (codebase investigation, multi-source research, complex-case triage). | **Unbounded autonomy** — state-changing tools with no human review, no turn limit, no way to measure whether the goal was met. |
| **RAG** *(see S11)* | A stable knowledge corpus (manuals, internal docs, regulatory text) chunked and indexed; the most relevant chunks retrieved and passed as context. | Using RAG to answer **live-state** questions (order status, inventory, ticket queues). The index is a snapshot — if underlying data changed since refresh, the answer is wrong. |
| **Document-processing pipeline → Evaluator-optimizer** *(see S11)* | Structured extraction from semi-structured docs (claims, invoices, contracts): OCR → extract fields against a schema → validate → route exceptions. Evaluator-optimizer is common because first-pass extraction on edge cases isn't trustworthy without a check. | **No exception path** — low-confidence extractions go through the same pipeline as clean docs, with no human gate. |
| **Customer-service / ticket triage → Routing** *(see S11)* | Classify intent, then route: knowledge retrieval for doc questions, a transactional API for live-state queries (order status, account changes), a human approval layer for high-consequence actions. | Using **retrieval for live order status** instead of calling the API; **no escalation path** to a human; deploying an agent variant before the simpler routed workflow has been measured. |
| **Coding agent** (agentic exploration + deterministic edit/test/review) *(see S11)* | Two phases: (1) agentic investigation of the codebase (path can't be pre-written); (2) deterministic edits — parse, plan, propose, test, review. Subagents handle isolated tasks with just enough context. | Letting the agent edit/commit without a human review gate; not tracking regression rates against an eval set per language/framework; treating the whole thing as a conversation, not a structured pipeline with defined handoffs. |

**One pattern or several?** Real problems often sit at the boundary — a routing workflow may hand certain intents to an agentic loop; a doc pipeline may use RAG over policy text on an exception. **What matters is *why* you reach for a second pattern:** draw on one when the two parts of your problem *break in different ways worth managing separately.* If you're reaching for a second because you haven't decided what problem you're solving, adapt a single pattern instead — that's a deferred decision, not a pattern.

**The most common mistake: retrieval applied to live state.** Recognize it by stale chunks, results shifting with each index refresh, answers contradicting the database. A better embedding model or shorter refresh interval won't fix it — **call the system that owns the live state directly** rather than retrieving a cached version.

**⚠ Watch Out — "retrieval reached for instead of a tool call"** (the broader skill is *context engineering* — deciding which mechanism gets each kind of data in front of the model). Electronics-retailer assistant, user asks "Where's my order?" — two retrieved chunks both real strings from different points in time (chunk #1 "shipped on the 12th," #2 "currently being processed"); the model returned "shipped on the 12th." The order had actually shipped, been returned to depot for a damaged label, and awaited re-dispatch — **that current state appeared in neither chunk**, and a live order-status tool existed in the partner's API but was **not called.** The failure: (1) *category error* — retrieval is right for knowledge (FAQs, policies, manuals), wrong for transactional state; (2) *a data-architecture failure, not a retrieval failure* — live state was indexed as text; (3) *similarity is not truth* — a higher similarity score means semantically close, not truer, once the state has changed; (4) *the fix is a tool call*, not a better chunker/refresh/threshold. **The retrieval principle:** retrieval is for stable knowledge (true yesterday, true tomorrow); tool use is for live state (current value owned by a system, changes independently of your index). Conflating them yields fluent, confident, wrong answers with no error signal.

**Cost · Complexity · Risk:** composing two reference architectures roughly doubles the surface to maintain — when in doubt, pick one; each architecture carries its own **eval contract** (separate eval sets per architecture, not one for the composed system — a healthy top level can mask a failing component); misapplied retrieval on live state produces stale-but-confident answers with normal latency and no errors, so detection cost is high — nothing signals wrong until a user notices.

> **Checkpoint — "Critique the diagram"** (customer-service routing sketch; select the 3 misapplied components, of 6). *Answer:* **#2** retrieval over an "Order Status Index" (live state via retrieval — belongs in a tool call to the order API); **#4** an agent loop with `refund / cancel / update-address` tools (state-changing actions with no human gate / an agent variant before the simpler routed workflow is measured); **#5** the missing escalation path to a human agent. (#1 intent classifier, #3 retrieval over the product-manual corpus, #6 response composer are correct.)

---

## 7. RAG Pipeline Design — chunking and indexing

**Core idea:** goes one level below "RAG is a known-good shape" into the retrieval pipeline itself. **A chunk is the unit that gets retrieved; the approach is chosen by the *structure of the source*, not a default size.**

| Chunking approach | How it works | When it earns its place |
|---|---|---|
| **Fixed-size** | Split into uniform spans (with overlap) regardless of structure. | Homogeneous, unstructured text where natural boundaries are weak; simplest to operate. |
| **Semantic** | Split on meaning boundaries — topic shifts, sentence groups that hang together. | Prose where a retrieved chunk must be self-contained to answer well; reduces mid-idea cuts. |
| **Hierarchical** | Preserve document structure (sections, subsections); retrieve at the level that fits. | Structured documents (contracts, manuals, policies) where section context carries meaning. |

**Indexing decides what "similar" means when a query arrives — chosen by the *query pattern*.**

| Indexing strategy | What it matches | When it earns its place |
|---|---|---|
| **Dense (embeddings)** | Semantic similarity — meaning, not words. | Queries phrased differently from the source; paraphrase, intent, concept matching. |
| **Sparse (keyword, e.g. BM25)** | Exact terms, identifiers, codes, names. | Queries hinging on specific tokens: part numbers, statute citations, error codes. |
| **Hybrid** | Both, results combined. | Mixed query patterns — the common production case; recovers exact-match results dense retrieval misses. |

When a hybrid index returns two ranked lists, they must be merged. **Reciprocal rank fusion** is the standard, low-tuning default: each result is scored by its rank in each list, and the combined score favors items ranking well in both. *For an architect: combining dense and sparse is a design decision with a known, defensible default.*

**The trade-off** — every retrieval design trades among three things: **Retrieval quality** (does the right chunk come back?), **Latency** (how much does retrieval add per request?), **Maintenance** (cost to keep correct as the corpus grows). Smaller chunks and hybrid indexing raise quality and latency together; larger chunks and dense-only lower latency and maintenance but miss exact-match queries. There's no universally right point — only the one that fits *this* corpus and *these* queries, stated as a trade-off you can defend.

**Cost · Complexity · Risk:** hybrid indexing and smaller chunks raise both retrieval compute and per-request latency — size to the query patterns you actually have; every chunking/indexing choice is maintenance as the corpus changes (a launch-correct pipeline degrades silently as docs are added); the failure mode is a confident answer built on the wrong chunk — retrieval quality isn't visible in output, it must be measured against a labeled set, which ties this work straight to evaluation.

> **Exercise — "Design the RAG pipeline"** (~4,000 docs: section-numbered contracts, long-form project write-ups, a structured methodology handbook; three query kinds — concept lookup, exact-target lookup, broad synthesis). **Model answer:**
> - **Contracts + methodology handbook → hierarchical chunking** preserving section/subsection structure — both are structured and section-numbered, so section-level retrieval keeps the clause/procedure intact and self-contained; fixed-size would cut across boundaries and lose structural context.
> - **Project write-ups → semantic chunking** on meaning boundaries — long-form prose has no section numbers to anchor hierarchical chunking, and fixed-size cuts mid-idea; semantic keeps each passage coherent enough to answer on its own.
> - **Indexing → hybrid dense-plus-sparse** — the query set mixes exact-clause lookups (sparse handles specific identifiers) with open-ended conceptual questions (dense handles meaning-driven matches); neither alone covers both.
> - **Dominant trade-off:** **query variety is the load-bearing constraint** — the hybrid index adds retrieval compute and a rank-fusion step, but those costs earn their place because the query set genuinely needs both modes.

---

## 8. Model, Context Window, and Context Strategy

**Core idea:** with a pattern and a reference architecture you still don't have a shippable system. Three decisions remain, each determining what the *same* architecture costs at scale, compounding across every request: **which model**, **how much of the context window to use**, **progressive vs. monolithic context strategy.**

**Distinct terms that are easy to conflate:**
- **Context window** — the model's active attention space; everything inside is available for reasoning, everything outside doesn't exist to the model. **Resets between calls** unless your application manages continuity.
- **Retrieval** — external knowledge fetched at query time from a corpus the model doesn't hold. *Augments* the window, doesn't replace it; the model sees only what the retriever surfaces.
- **Persistent application state** — owned by *your* system (order status, user records, balances). The model has no inherent access — it needs a tool call.
- **Summaries and memory layers** — application-managed continuity across turns/sessions. The model has no native memory between calls; anything that persists does so because your application stored and re-passed it. An **architectural choice, not a model capability.**

**Model selection — start with Sonnet, move deliberately.** The family is **Opus, Sonnet, Haiku** (different cost/latency/capability tradeoffs). Opus is the most capable — demanding reasoning, advanced coding, research synthesis where Sonnet misses the quality bar. **Default = Sonnet.** Move up to Opus only when an eval set says Sonnet misses the bar; move down to Haiku only when an eval set confirms the quality tradeoff is acceptable for your task. **Measured, not reflexive.**

**Context-window sizing — the working-memory cliff.** Working memory has the hardest edge of the four properties: things work until they don't, then the transition is abrupt. The window is measured in **tokens** (chars-per-token varies by model/tokenizer/language — treat any fixed ratio as illustration, not a rule; **measure** via the `usage` field on every response). Everything entering the window — system prompt, history, retrieved docs, tool outputs, model responses — counts in tokens, which matters twice: the window has a **fixed limit**, and you're **billed per token**. Practical implication: **do not budget the full window** — budget for the largest realistic conversation + retrieved context + system prompt + working scratch + margin. The window is a **ceiling, not a target**; design toward the ceiling and you hit it in production.

**Context strategy — the progressive ↔ monolithic spectrum.** Every workload chooses, implicitly or explicitly, how context reaches the model each call:

| Strategy | Where it earns its place | Where it breaks down |
|---|---|---|
| **Monolithic** — load the full required context into a single prompt | Bounded tasks with predictable input size; stable prefixes that benefit from prompt caching; single-shot Q&A where retrieval latency isn't worth it; reasoning that genuinely needs simultaneous access to all material. | Conversations / tool loops where context accumulates turn over turn; cost and latency scale linearly with input length; attention quality can degrade on very long contexts before the hard limit. |
| **Progressive** — carry forward only what the next step needs (**right default for most production**) | Multi-turn dialogue and iterative refinement; agent loops where each step depends mainly on recent state; workflows that decompose into stages with narrow handoffs. | Tasks needing long-range coherence across full history; decisions depending on detail dropped earlier; prompt caching is harder when carried-forward context mutates each turn; the exact input at step N is no longer reconstructable (complicates debugging). |
| **Retrieval (RAG)** — fetch relevant chunks from an external store at query time | Knowledge bases too large for context; sources changing faster than the prompt is redeployed; domains where any query needs only a small slice; cases where source citation is required. | Queries needing synthesis across many independently-scored docs; chunking that splits semantic units (tables, code, multi-paragraph arguments); recall failures where the correct doc never enters top-k; retrieval quality becomes a system to evaluate and maintain. |
| **Compaction** — periodically summarize/compress accumulated context | Long-running agents/conversations where the full transcript is wasteful but recent state matters; phase transitions that can checkpoint to a clean summary; sessions that would otherwise hit limits mid-task. | Summaries that drop load-bearing detail (identifiers, numeric values, prior decisions, once-mentioned edge cases); the summarizer is itself a model call with cost/latency/failure modes; compaction is largely one-way; measuring summary fidelity is an unsolved eval problem. |

**In practice, strategies combine** — each handles a different dimension. Worked example, a long-running coding agent:

| Phase | What's happening | Strategy in play |
|---|---|---|
| **Session start** | Load the task description + the few files the user referenced | **Monolithic prefix** — small, stable, loaded once, ideal for prompt caching. |
| **Active work** | Each tool call (read/test/edit) appends to the working context | **Progressive recent state** — the latest additions are what the next step needs. |
| **Discovery** | Agent needs a file it didn't load; searches the codebase and pulls matches | **Just-in-time retrieval** — corpus too large to preload; fetch only the relevant slice. |
| **Context filling** | After many turns, early exploration takes space; conclusions matter, verbatim tool output doesn't | **Compaction** — summarize "what we tried and learned," preserving only decisions/insights that carry the work forward. |

No single strategy carries this workload (monolithic hits the limit; progressive can't surface un-loaded code; retrieval loses the thread; compaction has nothing to compact until others build the trajectory). **Architectural takeaway — ask four separate questions:** what does the model need at the *start* (→ monolithic baseline), from the *most recent steps* (→ progressive window), might it *fetch on demand* (→ retrieval layer), what earlier material can be *compressed without losing decision-relevant detail* (→ compaction policy). **Context strategy and context sizing are separate decisions that interact but don't determine each other** — treating them as one is where most context designs go wrong.

**What extended thinking controls.** A per-request capability: the model works through the problem in a separate block of **thinking tokens** before the final answer. Control has changed across generations — on **Opus 4.6+, Sonnet 4.6+, and Sonnet 5**, adaptive thinking with the **effort parameter** is recommended (set how much reasoning effort, not a token budget); adaptive is the *only* mode on **Fable 5**. The older manual `budget_tokens` is **deprecated on the 4.6 generation and removed on Sonnet 5** (returns a `400`); verify current support at platform.claude.com. Thinking tokens are billed as **output tokens** at standard output rate and add latency; when thinking isn't engaged none are generated or billed. The API may return a *summarized* representation of the thinking — **you're billed for tokens consumed during reasoning, not the visible summary length.** **Decision rule:** extended thinking is a cost/latency tradeoff — run evals *without* it first; enable it only when a **measured accuracy gap** remains after prompt work, never on the assumption "it can't hurt."

**Gate every model change with an eval before you ship.** Any change to the model is a change to behavior — **a model swap is a code deployment, treat it as one.** Minimum three things: (1) a **curated test set** of prompts with known-good outputs covering the real distribution of work; (2) a **grading function** (model-graded against a rubric, or programmatic); (3) a **delta threshold set in advance** below which you don't ship. *Set the threshold before you run the eval — set it after and you're writing acceptance criteria after the build.*

**Worked case — a Sonnet→Haiku downgrade done well.** A document-intelligence pipeline ran six months on Sonnet and used its whole budget; the team wanted Haiku. They built an eval set of **250 representative documents** with hand-validated targets, **stratified** across production document types (sized so per-type scores stay meaningful, not just the average). Ran both models on the same set, same rubric. Signature: **Sonnet 0.94 avg, Haiku 0.86 avg**, with variance concentrated in two document types where Haiku scored **0.71 and 0.74**; the rest within tolerance. The **rollback criterion set in advance**: *if any single document type drops below 0.85, reject the migration.* Two types crossed it → the migration as proposed is **rejected.** The salvage: **route those two types to Sonnet via the existing classifier, the rest to Haiku** — cost drops materially without the regression on hard types. *Takeaway: the rollback criterion was decided before the data came in, so the team didn't negotiate with itself, and the eval set surfaced a partial-migration option a single overall score would have hidden.*

*Forward pointer: model selection and context strategy are two prompting-area levers; system-prompt design and prompt reuse (the other two) come later this module.*

**⚠ Watch Out — "defaulting to Opus everywhere produced a 7× cost overrun."** 90 days after launch: monthly cost **7× the modeling figure**, user-facing latency **2.3s median** (target 800ms), CSAT unmoved. Cause: **every call used Opus** — no per-step model selection because there was no per-step eval to force it; the team defaulted to "the best available model" and never revisited once traffic was live. Contributing: the architecture doc had **no model-tier decision at any step** (so the implicit default carried through); cost was **reviewed monthly, not determined during development**; extended thinking was enabled on a **routing classifier that needed no reasoning**. The fix: build the eval set retroactively per step, route the classifier to **Haiku**, mid-pipeline summarization to **Sonnet**, keep **Opus** only on final response-composition where the eval said it earned its place → **monthly cost −71%, latency 940ms, CSAT unchanged.** **Lesson:** *not choosing a model is choosing the most expensive one* — the absence of a deliberate choice isn't neutral, and the eval set is the only thing that makes the tier decision defensible *during design*, not just as a release gate.

**Cost · Complexity · Risk:** monolithic context is the silent budget killer (a 4,000-token prompt can be carrying 80,000 tokens by turn 30, with no signal until billing); a model swap looks like a one-line config change but rewrites how the product behaves — treat swaps as releases; **no eval set means no rollback signal** — a regression found in production wasn't detected at all, because by then the user already has it.

> **Checkpoint — "Cost & latency calculator"** (find a config meeting both the cost ceiling *and* the latency budget — they can't be traded against each other — then identify the load-bearing control). *Answer to the multiple-choice:* **B** — the dominant constraint's control (e.g. if latency is the tight budget, the model tier or extended-thinking setting that drives latency). *Model answer (verbatim):* "The dominant constraint depends on which budget was tighter in your configuration. If latency is the binding constraint, the model tier and extended-thinking setting are load-bearing… If cost is binding, the tier and context strategy are load-bearing. The load-bearing control is the one tied to whichever budget had the least margin. Naming it explicitly is what makes the configuration defensible rather than lucky."

---

## 9. Prompting as Architecture

At enterprise scale the prompt is not a sentence you type but an **asset you design**: a system prompt, a reusable template, and guardrails.

**System-prompt architecture for reuse.** A one-off system prompt and one that hundreds of daily requests depend on are different artifacts. The enterprise version has structure: a clear **role and scope**, the **constraints** the model must hold (what it must never/always do), and an **output contract** naming the response shape. *When reused at scale, ambiguity is a defect multiplied across every request.*

**Templates — consistency and safety, enforced.** A template is a system prompt with **parameterized slots** and **fixed scaffolding**; the design goal is that the fixed scaffolding carries the consistency/safety guarantees, so filling a slot cannot accidentally remove a constraint. A good template **makes the safe path the default path** — the user supplies variable content and inherits the guardrails without re-authoring them.

**Description — the AI-Fluency competency applied to prompt design.** Description is the discipline of telling the model precisely what you want: **scope** (in/out of bounds), **format** (the exact output contract), **constraints** (rules that must never be violated). **Underspecification is a gap the model fills with its own assumption, differently each time** — the key failure to watch. Diagnosing the gap: for each requirement the output must meet, ask whether the prompt *states* it or merely *hopes* for it; make the implicit explicit — restate the goal alongside the instruction, name the format, bound the constraints.

**Technique selection — by task complexity, not habit:**

| Technique | What it is | When it fits |
|---|---|---|
| **Zero-shot** | Instruction only, no examples. | Well-specified tasks the model already handles reliably; the default to try first. |
| **Few-shot** | A handful of input/output examples in the prompt. | Tasks where the desired format/judgment is easier to *show* than to describe. |
| **Chain-of-thought** | Prompt the model to reason step by step before answering. | Multi-step reasoning, arithmetic-like logic, or tasks where the path matters to the answer. |

*Progression is deliberate: start zero-shot, add examples only if needed, add explicit reasoning only if structure demands it — each step adds tokens and latency.*

**Behavioral differences across models.** The same prompt doesn't behave identically across tiers/generations: a more capable model may need *less* scaffolding to reach the same quality, a less capable one *more*. A prompt tuned for one model is a **starting point** for another, not a finished artifact — which is why a model swap is treated as a release and eval-gated: **the prompt-model pairing is what you're actually shipping.**

**Avoiding bias in prompt construction.** Leading phrasing, unbalanced few-shot sets (showing only one kind of case), and assumptions baked into the instruction all steer output in easy-to-miss ways. The discipline: **phrase neutrally, balance examples across the cases the system will actually see, and check whether the prompt presumes an answer it should be eliciting.**

> **Checkpoint — technique-selection matrix** (pick technique + one-sentence reason). *Answers (verbatim):*
> - **Task 1** (classify a support ticket into 5 named categories) → **Zero-shot.** "The task is well-specified, the categories are named, and the model handles classification reliably without examples."
> - **Task 2** (extract date/vendor/amount from receipts varying widely in layout) → **Few-shot.** "The desired extraction format is easier to demonstrate with examples than to describe in instructions, especially given layout variation."
> - **Task 3** (determine liability under three interacting conditions) → **Chain-of-thought.** "The answer depends on a sequence of conditional logic steps; prompting for step-by-step reasoning reduces the chance of skipping an interaction."
> - **Task 4** (summarize a 400-word description into two sentences) → **Zero-shot.** "Standard summarization on a well-bounded input; adding examples or explicit reasoning steps adds tokens and latency with no quality gain."

**Caching mechanics, modular prompts, and Skills.**

*Setup — a cache that never hit:* a team put the per-request document at the **top** of the prompt, ahead of the large fixed instruction block; because the cache matches on a **stable prefix**, dynamic-content-first meant the prefix changed every request and the cache never hit. Fix: reorder — **fixed content first, dynamic last.**

- **Cache breakpoints** — caching works on a stable prefix; mark the boundary between the fixed (cacheable) and variable (not) parts, and keep the fixed part genuinely fixed.
- **Content ordering** — **static before dynamic, always**; the large unchanging instruction block first, per-request content after the breakpoint.
- **TTL selection** — match cache lifetime to how often the fixed content changes and how frequently the prompt is called; a constantly-called prompt benefits from a longer-lived cache, a rare one may never amortize the write.
- **When the write overhead isn't worth it** — writing to the cache has its own cost; for infrequent prompts or small fixed portions, caching can cost more than it saves. *Caching is a design decision, not a default to switch on everywhere.*

**Modular prompt library vs. Skill:** a **library** is a shared collection of prompt fragments/templates engineers assemble in their own code; a **Skill** is a formal, versioned, self-contained unit (a `SKILL.md` packaging instructions, optional scripts, version management) so the whole procedure travels as one governed artifact.

| Consideration | Lean toward a prompt library | Lean toward a Skill |
|---|---|---|
| **Repeatability** | An assembled, often-tweaked prompt per use. | A stable procedure run the same way every time. |
| **Distribution** | Shared within one codebase or team. | Distributed across teams/products needing the same procedure. |
| **Governance** | Lightweight; engineers own the fragments. | Needs versioning, approval, rollback — Skills carry that. |

**Cost · Complexity · Risk:** a vague system prompt is paid for in every request needing correction/retry/cleanup — designing it once beats diagnosing drift across thousands of calls; templates concentrate complexity in one reviewable, governable place instead of scattering it across ad-hoc prompts; **an underspecified guardrail is worse than a missing one** — it creates the appearance of a control without the substance, and a constraint the model can quietly route around is not a constraint. *(Also: heavier techniques cost tokens/latency every call; few-shot examples are content to maintain — stale ones steer the model wrong; bias is invisible in a single output and shows only in aggregate, so neutral phrasing and balanced examples are a design requirement, not polish. Caching can cut cost when it hits and add it when it doesn't — model the economics before committing; a versioned Skill can be reviewed and rolled back where a sprawl of copy-pasted prompts cannot.)*

> **Exercise — "Author the reusable prompt asset"** (support org drafts hundreds of replies/day given a ticket + manual section, must follow tone, cite the manual section, and never promise a refund or unapproved timeline). **Model answer (verbatim):**
> - **Cache-breakpoint placement:** "Put the role, tone rules, output contract, and never-promise guardrail first as the stable prefix, then the ticket and manual section as the only per-request content. Dynamic content before the breakpoint means the prefix changes on every call and the cache never hits. At hundreds of calls a day, the stable prefix is where the cost savings live."
> - **Enforcing the guardrail:** "Build it into the output contract as a structural constraint the format requires, not as a sentence in the role text. A rule stated in the role can be drifted past. A constraint built into the output contract shapes the response format and cannot be quietly ignored."
> - **Packaging:** "A versioned Skill. The procedure is stable, run identically hundreds of times a day across the support org, and needs versioning and rollback. A pasted prompt template each agent keeps locally has no central governance, cannot be rolled back, and drifts into slightly different versions over time."

---

## 10. Entry Points & Governance — selection under real constraints

**Core idea:** choosing how a partner consumes Claude is **three separate decisions made in sequence** — (1) which **entry point** fits the work, (2) which **build-time interface** suits the team, (3) which **delivery route** fits the partner's cloud commitments. Getting the order right prevents the most common architecture mistakes. (The three layers were vocabulary in §2; this is the *selection* work.)

**Entry points — how you interact with Claude.** The wrapper that decides who can talk to Claude, what it can touch, and how much engineering it takes. *Same intelligence packaged for different jobs; the wrong choice doesn't break the work but adds daily friction.* Before building on any of these, verify current capabilities/configs/availability against Anthropic docs.

| Entry point | Description | Audience & use | Core tradeoff |
|---|---|---|---|
| **Claude.ai** (web, mobile, desktop) | End-user chat product: sign in, attach files, use Projects for shared context, connect Slack/Outlook/Drive via built-in connectors. Consumer tiers (Free, Pro, Max) and **Claude for Work** — **Team** tier adds admin controls, SSO/SAML, domain capture, a **no-training-on-customer-content** commitment; **Enterprise** adds SCIM provisioning, configurable retention, audit logs, a Compliance API, and a **HIPAA-ready option with signed BAA**. | Knowledge workers using Claude as a thinking partner (research, drafting, analysis, review). No code written. Web/mobile/Desktop all reach the same product. Entry point for **applied AI users, not builders**. | **Zero build cost vs. zero integration:** you get the product Anthropic ships and cannot embed it in another product or customize what's exposed. Right tier depends on governance needs. |
| **Claude Code** (terminal, IDE plugin, desktop, web) | An agentic coding tool that reads files, edits code, runs commands, executes multi-step engineering tasks under configurable permission boundaries. | Engineers doing real development — exploring codebases, refactoring, debugging, building features. Runs in terminal, IDE plugins (VS Code, JetBrains), desktop, and web at claude.ai/code. | **Purpose-built for engineering:** outstanding for code, the wrong shape for a customer-service product or any non-engineering workflow. |
| **Claude Cowork** | A desktop agent for non-developers that works with local files and applications, automating file/task management on the user's machine under configurable permissions. | Operations, admin, and other non-engineering roles who need Claude to *take actions* on their computer, not just produce chat text. On all paid plans (Pro/Max/Team/Enterprise) via Claude Desktop on macOS/Windows; Linux in beta. | **Real system actions vs. supervision overhead:** powerful for file/task automation, so permission scoping and human review matter more than in chat-only. |
| **Claude in Chrome** | A browsing agent operating inside Chrome, navigating pages and taking actions on the user's behalf. | Knowledge workers whose tasks are anchored in web applications rather than files/codebases. | N/A |
| **Claude for Excel** | A spreadsheet agent operating inside Excel — cells, formulas, structured data. | Analysts, finance teams, any role whose primary tool is a spreadsheet. | N/A |

**Build-time interfaces — how you program against Claude.** The API, SDKs, MCP, and Agent SDK are **not always alternatives — they layer on one another.**

| Interface | Definition | Audience & purpose | Tradeoff |
|---|---|---|---|
| **Direct API** | The direct HTTP interface: authenticate, send messages + model + params, get a response. | Teams building Claude into their own product — they own retries, streaming, tool use, observability, UI. The most foundational layer, the one everything else sits on. | **Maximum control vs. maximum responsibility:** use when an SDK hasn't exposed a feature, or the team prefers raw HTTP. |
| **SDKs** (Python, TS, Java, Go, Ruby, C#, PHP) | Same capability as the API in language-native types/helpers — auth, formatting, retries, streaming, tool-use plumbing. The agent loop, if any, stays the partner's code. | Teams that want the API's capability with language-native ergonomics and less boilerplate. **Default choice for embedding Claude in a product.** | **Ergonomics vs. control:** SDK abstractions move at Anthropic's release cadence; a raw feature the SDK hasn't exposed means dropping to HTTP. |
| **MCP** | An open protocol exposing tools/prompts/resources from one server so any MCP-aware client (Claude.ai, Claude Code, the API, a third party) can discover and use them. **A sharing convention across products, not a calling convention within one.** | Teams needing the same tools reachable from **multiple** Claude clients — build the server once, connect everywhere. | **Reusability across clients vs. added complexity:** if only one client will ever use it, MCP adds overhead for little payback. |
| **Agent SDK** (`@anthropic-ai/claude-agent-sdk`) | Runs a **managed agent loop** — the same one that powers Claude Code — from the partner's own application code (handles iteration, tool execution, termination). TypeScript (npm) and Python (PyPI). | Teams needing Claude to act over multiple turns inside their own product, with their app controlling the surrounding workflow, where the Claude Code CLI is the wrong shape (e.g. an internal agent embedded in a web app). | **Managed loop vs. custom orchestration:** handles iteration/termination but gives up fine-grained control over the loop. |

*Keeping the terms separate:* **API and SDK are the same entry point, different ergonomics** (SDK is an opinionated wrapper; drop to HTTP only for a freshly-shipped feature the SDK lacks). **MCP and API tool use are different layers, not alternatives** — MCP exposes tools any client can call *via* API tool use; pick MCP when one tool entry point must reach multiple clients, raw API tool use when tools live in one product. **Anthropic SDK vs. Claude Agent SDK:** the Anthropic SDK is a convenience wrapper over the API (no agent loop); the Agent SDK is the managed runtime that *runs* the loop. Decision: one request/response → API or SDK; reusable tools across clients → MCP; Claude acting across turns inside the partner's product → Agent SDK.

**Claude Code — customization and governance layers.** A "layer" is a discrete config entry point controlling one aspect of how the agent thinks or acts — independent, composable, applied at a different execution point. Two groups: **shaping** (what the agent knows/does) and **governing** (what it's allowed to touch). Getting the split right is what makes an agent useful *and* safe.

| Layer | What it does | When it belongs here |
|---|---|---|
| *SHAPING* **CLAUDE.md** | A markdown file loaded into context at session start — standing instructions, project conventions, background knowledge. | Persistent context for every task in the project (coding standards, repo layout, team conventions). |
| *SHAPING* **Skills** | Markdown-defined procedures invoked on demand rather than loaded upfront, keeping main context lean. | Repeatable workflows the team shouldn't spell out each time (commit-push-PR, release-notes, schema-migration). |
| *SHAPING* **Subagents** | Additional agents to parse out sections of a task, or isolated context-window helpers for bounded tasks (code review, exploration) that would clutter the main thread. | Work that should run with read-only tools, a restricted tool entry point, or a different system prompt from the main session. |
| *SHAPING* **MCP servers** | External tools and data entry points connected over the standardized protocol. | When the same tool entry point must be reusable across clients (e.g. a Linear MCP server also usable from Claude.ai). |
| *GOVERNING* **Hooks** | Scripts firing on lifecycle events (before/after a tool, at session start, on stop) — deterministic gates the agent cannot skip. | Deterministic gates the agent must not skip, where the guarantee must come from **code**, not prompting. |
| *GOVERNING* **Permission boundaries & approval flows** | Six permission modes: **Default** asks before each action; **acceptEdits** approves file edits + common filesystem commands (mkdir, touch, rm, mv, cp, sed) but other Bash still prompts; **Plan mode** locks the session read-only until a plan is approved; **Auto mode** uses a classifier to approve safe / block risky actions (research preview, all plans, admin-enabled on Team/Enterprise, defaults to the Anthropic API provider; an env var enables CSP providers); **dontAsk** auto-denies anything that would prompt and runs only what allow rules cover (the mode for locked-down CI); **bypassPermissions** skips all checks (scoped to containers/CI only). | Any environment where the cost of an unintended action is non-trivial. *Permissions govern what the agent may touch; Hooks govern what must happen before/after an action.* |
| *GOVERNING* **Sandboxing & restricted execution** | Containment around the workspace — filesystem boundaries, network egress rules, constrained command surfaces. | Any deployment where a wrong action has real consequences and approval prompts alone aren't a sufficient backstop — the environment enforces the boundary, not just the agent's judgment. |

**CSP delivery routes — where API traffic terminates.** The same Claude model is available through four routes; what differs is which cloud account the spend lands in, which identity system authenticates, which region traffic terminates in, and which procurement contract already covers it. **The decision rule is not technical capability (the model behaves the same on each route) — it's what the partner has already committed to.** *Tradeoff: CSP-mediated routes (Bedrock, Vertex, Foundry) tend to lag the first-party API on new features by weeks, sometimes longer for major capabilities.*

| Delivery route | What it is / how reached | When to pick |
|---|---|---|
| **Anthropic first-party** | The direct API at api.anthropic.com, billed by Anthropic, authenticated with an Anthropic API key. SDKs (Python, TS, C#, Java, Go, PHP, Ruby) wrap it. | Partner has no binding cloud commitment, wants newest features the day they ship, or prefers to consolidate AI spend with Anthropic. **Default when no procurement constraint pulls the other way.** |
| **AWS Bedrock** | Claude as a managed model on AWS, via the Messages API at `/anthropic/v1/messages` on AWS infra, billed on the partner's AWS account, authenticated through IAM. Legacy path (InvokeModel/Converse via boto3/AWS SDK) remains. Regional availability matters; inference profiles solve cross-region routing. | Partner has a committed AWS enterprise agreement, runs the stack on AWS, wants AI spend to draw down against it. Identity, networking, audit inherit from the AWS account. |
| **GCP Vertex AI** | Claude in Vertex AI Model Garden, via the Anthropic Vertex client or Google's SDK, billed on the GCP project, authenticated with Google Cloud credentials. Enabled per project in the Model Garden console. | Partner runs on GCP, the ML stack lives in Vertex, wants a single billing/audit entry point across foundation models. |
| **Microsoft Foundry (Azure)** | Claude via Microsoft's Foundry catalog on Azure, billed on the Azure subscription, authenticated through Entra ID, deployed into the partner's Azure region. **Two hosting forms:** *Hosted on Azure* (GA, inference in the partner's Azure env — as of writing Opus 4.8, Sonnet 5, Haiku 4.5, verify current list) and *Hosted on Anthropic infrastructure* (other models, routes to Anthropic infra). | Partner has a Microsoft enterprise agreement, runs identity through Entra ID, footprint on Azure. **Strict data-residency / GDPR partners must verify the hosting form and compliance posture of the specific models before committing.** |

*What does not change across routes:* the model itself — prompting, evaluation strategy, tool use, and context-window behavior all transfer. *What changes:* the wrapper — model identifiers/version strings differ, regional availability differs, and CSP-side features wrapping inference (Bedrock inference profiles, Foundry model deployments, Vertex Model Garden access controls) are concepts the architect must know exist even if the partner's engineers own implementation.

**Skills as an integration mechanism** (not only packaging): a Skill can be attached via the `container.skills` parameter, published/versioned through the `/v1/skills` endpoint, and managed under version control. Skills require the **Code Execution Tool** to run — so this pattern carries a **sandboxed-execution dependency.** When the question is how a reusable procedure reaches Claude across entry points, a versioned Skill is one mechanism to weigh alongside MCP and direct tool use.

**Security, governance & regulated-industry constraints — some entry-point decisions are not yours to make.** When a partner is subject to attorney-client privilege, HIPAA, GDPR, FedRAMP, or an internal data-residency policy, those constraints **rule entry points in or out before cost, ergonomics, or build effort enter the conversation.** Claude.ai is hit most often (the consumer product wasn't designed to satisfy every enterprise data-handling requirement out of the box); the **API/SDK routed through a partner-approved gateway with logging, retention, and identity controls in the partner's own infrastructure** are the entry points that survive most regulated reviews. **Name the governing constraint first and let it eliminate options before preferences do.**

| Constraint | What it tends to rule out | What usually survives review |
|---|---|---|
| **Attorney-client privilege** | Consumer tiers of Claude.ai for privileged review, and anything touching privileged material through a surface the firm can't audit end to end. (Claude for Work adds admin controls + audit logging, but the firm must confirm the config meets its privilege bar.) | API/SDK behind the firm's own application, authenticated via SSO, routed through a firm-approved LLM gateway that logs every request — **the firm owns the audit trail end to end**, which is what privilege review turns on. |
| **HIPAA (PHI)** | Any entry point where a BAA is not in place for the **specific configuration** in use. A BAA for one config does not extend to another, so an uncovered route is ruled out even when the partner holds a BAA elsewhere. | API/SDK on a BAA-covered configuration via the delivery route the partner already uses. BAA existence isn't sufficient — feature eligibility matters; **beta features are generally excluded from BAA coverage unless explicitly listed.** |
| **GDPR & data residency** | Delivery routes where the region of model execution can't be pinned, and routes where data leaves the approved boundary at any step. | A CSP-mediated route (Bedrock or Vertex) with the **region pinned** to a covered jurisdiction and DPA terms inherited from the cloud contract. **Foundry is the route to check** — its residency guarantees aren't something this course can confirm; verify against current Foundry docs. |
| **FedRAMP / government** | Any path not on an authorized cloud environment at the required impact level. | **Claude for Government (C4G)** for FedRAMP High civilian; **Bedrock GovCloud** for FedRAMP High and DoD IL4/5; **Vertex Assured Workloads** for FedRAMP High and IL2. *Authorized gov environments run on a model lag — newest models reach them after commercial release; confirm which model the route offers.* |
| **Internal data-residency policy** | Routes outside the partner's approved cloud vendor list, regardless of technical capability. | The delivery route on the partner's approved CSP. **This is procurement, not engineering** — the right route is whichever one their CIO has already cleared. |

*Always verify current authorization scope for each constraint with Anthropic before committing. Forward pointer: Module 3 (Responsible AI, Safety & Risk) goes deep on guardrail design, data handling, and the full regulated-industry framework; this section's role is to surface the constraint at the point in the design conversation where it eliminates options — right here, at the entry-point and delivery-route decision.*

**⚠ Watch Out — "Claude Code picked outside engineering."** A regional bank's proposed "operations assistant" for branch staff (balance lookups, appointment scheduling, policy Q&A) had: Claude Code on branch laptops (per-branch CLAUDE.md); MCP servers for the customer DB, appointment system, policy corpus; subagents running compliance checks. Three failures, each visible in the proposal: (1) **the entry point was chosen before the user was named** — branch staff don't run terminals, so an engineering entry point is mismatched with the user; (2) **MCP was carried forward from a prior project as a default** — the reusability that justifies it didn't apply (no other Claude clients in the bank), so it paid integration cost for nothing; (3) **compliance, the highest-consequence path, was assigned to subagents** (weaker deterministic guarantees than server-side code) — the pattern was inverted. The right architecture was there from screen one: a **custom web app calling the API directly**, compliance in **deterministic server-side code**, UI behind the bank's **SSO** fitting a banking workflow, tool calls audited at the server boundary. **Lesson:** entry-point choice follows the user and the work — reaching for Claude Code or MCP because the last project used them pays for capabilities the partner doesn't need.

**Cost · Complexity · Risk:** each entry point carries non-trivial integration cost — don't pick more than one unless the use case spans them; the two most common mistakes are Claude Code on non-engineering work and treating MCP as the default integration layer regardless of whether its reusability is needed (the entry point follows the work, not the reverse); outgrowing the wrong entry point is expensive beyond the rewritten code — the conventions and user habits built around it — so starting on the right one is cheapest.

> **Checkpoint — "Pick the entry point and name the deciding tradeoff"** (a right entry point with the *wrong reason* is not correct — the reasoning is what's tested; scenario 1 worked: *claude.ai with a Project — deciding tradeoff is audience: a non-technical team needs a ready-made entry point, not a build-time interface*). *Answers, scenarios 2–6:*
> - **2 — regional bank, loan-officer assistant needing core-banking data, runs on AWS with an enterprise agreement → A (AWS Bedrock)** — deciding tradeoff **integration depth**: needs programmatic access to core banking data and must embed into existing AWS infrastructure.
> - **3 — law firm, privileged-document review, GC requires all AI behind the firm's own audit infra → B (Direct API/SDK behind the firm's app + gateway)** — deciding tradeoff **governance/control**: the firm must own the audit trail end to end, routing through infrastructure it controls.
> - **4 — logistics warehouse staff, non-technical, shared tablets → B (claude.ai with a Project)** — deciding tradeoff **audience**: non-technical staff need a ready-made interface usable without training, and Projects provide shared context.
> - **5 — healthcare, clinical-documentation assistant, holds a BAA with AWS confirmed to cover Bedrock, vs. a competing direct-API-with-separate-BAA proposal → C (AWS Bedrock)** — deciding tradeoff **governance/control**: the existing BAA covers this configuration, eliminating the compliance risk **before any other tradeoff applies.**
> - **6 — financial-services trade-commentary system, ≤400ms per trade, runs on GCP → A (Google Vertex AI)** — deciding tradeoff **latency**: Vertex keeps the request path inside the firm's existing Google Cloud environment, minimizing network round-trip.

---

## 11. Assembly & Recap — cumulative architecture exercise

> **Cumulative checkpoint — "A contract-review system for a mid-market law firm."** *The brief:* a 180-lawyer firm wants to speed contract review; senior associates spend ~12–18 hrs/week reading vendor/partnership contracts (avg 35 pages) to flag clauses conflicting with the firm's standard playbook; current output is a redlined PDF with margin comments. The firm uses **iManage** for storage, has a **CIO-approved private LLM gateway**, and is bound by **attorney-client privilege** (excludes consumer-grade tools). Target: **cut associate time per contract 60% while keeping the senior associate as final reviewer.** Four complete architectures are offered; three look reasonable but each fails on a single decision.
>
> **Model answer (verbatim, "Reveal the model answer"):** "Build on the direct API or SDK, embedded in a thin internal web app that authenticates via the firm's SSO and routes through the approved LLM gateway. A parallelized workflow reviews the contract section by section, with an evaluator pass enforcing a strict schema on the flagged-clauses output. Claude handles extraction, classification against the playbook, and draft redlines. The playbook stays in the firm's systems as a versioned source of truth, retrieved per clause at call time. iManage handles document fetch. Sonnet is the default with progressive context, extended thinking enabled per clause only where an eval set justifies it. The senior associate signs off on every output, and low-confidence clauses are flagged for attention."
>
> **Correct option: D** (it matches the model answer exactly). Why the others fail on one decision each:
> - **A** — builds on **Claude.ai** (uploading contracts into a Project): a consumer-grade surface, ruled out by attorney-client privilege before any other tradeoff.
> - **B** — loads the **full playbook into the system prompt on every call** (monolithic context) instead of retrieving the versioned playbook per clause — the wrong context strategy at scale.
> - **C** — hands the work to an **open-ended agent** with iManage tools and runs **Opus on every call** — an agent where the path *can* be enumerated (section-by-section) plus an unjustified top-tier default; the wrong pattern and the wrong model economics.

---

## Glossary (verbatim)

- **Adaptive thinking** — Extended thinking where the model itself, rather than you, decides whether to think and how much, based on the complexity of each request. It can reason at length on a hard problem and skip thinking entirely on a trivial one. You steer it with an effort level rather than configuring a token budget. On current Claude models it is the recommended control, and on the newest models it is the only one.
- **API** — Application Programming Interface. The direct way to send requests to Claude from your own code, with full control over the prompt, the model, the parameters, and how the response is handled. Using the API means you are building the surrounding application yourself: the user interface, the conversation history, the error handling, the logging. The tradeoff is maximum flexibility in exchange for owning the infrastructure around it.
- **Authoritative** — Authoritative means the source you have agreed to treat as correct: the partner's system of record, the live policy table, the current price list. When an answer is authoritative, it comes from that trusted source rather than from the model's recollection, so you can stand behind it.
- **Claude Agent SDK** — A managed agent runtime distributed as the `@anthropic-ai/claude-agent-sdk` package for TypeScript and Python. It gives a partner programmatic access to the same agent loop that powers Claude Code: iteration, tool execution, observation, termination, so the partner can embed an agent inside their own product instead of running Claude Code in a terminal. Distinct from the Anthropic SDK, which is a thin convenience wrapper over the API and does not run an agent loop.
- **Claude Code** — An agentic coding tool that reads files, edits code, runs commands, and executes multi-step engineering tasks under configurable permission boundaries. Distributed as a CLI, IDE plugins (VS Code, JetBrains, and others), a desktop application, and a web product at claude.ai/code. Claude Code is the entry point engineers use to do real development work, and it is customizable through CLAUDE.md, skills, subagents, hooks, MCP servers, and permission settings.
- **Claude.ai** — The end-user chat product hosted by Anthropic. Reached through the web, the mobile apps, and Claude Desktop. Users sign in, open conversations, upload files, share context through Projects, and connect external services through built-in connectors. No code is written. Claude.ai is the entry point for users, not builders, which is why a partner's engineering team usually does not consume Claude.ai when embedding Claude in their own product.
- **Corpus** — The body of documents a retrieval system searches over. A corpus might be a knowledge base, a set of policy documents, a product manual, or a collection of past tickets. The corpus is loaded and indexed ahead of time, which is why it works for stable reference material and not for live state.
- **CSP delivery route** — Cloud Service Provider delivery route: The path that API traffic takes to reach Claude. Anthropic offers a direct route at api.anthropic.com, and the same Claude models are also available through AWS Bedrock, GCP Vertex AI, and Microsoft Foundry on Azure. The route you choose determines where the spend is billed, how the call is authenticated, which region the traffic terminates in, and which contract covers it. It does not affect how the model behaves.
- **Deterministic rule** — A deterministic rule is a rule that always produces the same output for the same input. Same in, same out, every single time, with no variation.
- **Eval** — Eval short for evaluations is a structured test set used to measure whether a model is performing well enough on a defined task. An eval pairs inputs with expected outputs or quality criteria, runs them against the model, and produces a score you can compare across model versions, prompts, or configurations. Evals are how teams decide whether a change is an improvement or a regression before it reaches production.
- **Extended thinking** — The capability where the model works through a problem in a separate block of thinking tokens before it commits to a final answer, rather than responding in one pass. It helps on tasks where a one-shot answer would skip steps. Thinking tokens are billed as output tokens and add latency. How much thinking happens depends on the control mode: a thinking-token budget you configure yourself on older models, or adaptive thinking (see Adaptive thinking) on current ones.
- **IDE** — Integrated Development Environment. A software application that bundles a code editor, debugger, and other tools into one place for writing and running code (e.g., VS Code, PyCharm, Xcode).
- **Live state** — Data that changes during the lifetime of a conversation or process: an order status, an inventory count, a price, a calendar slot, a user's current session. Live state is distinct from static reference material because the correct answer at 10:00 a.m. may be wrong by 10:05. Systems that need live state require a direct lookup against the source of truth, not a stored snapshot.
- **MCP** — Model Context Protocol. An open standard that lets Claude connect to external tools and data sources through a dedicated server, instead of requiring you to write a custom integration for each one. An MCP server exposes tools, prompts, and resources that any MCP-compatible client can use, which means a single integration written once can be reused across applications. MCP shifts the work of building and maintaining tool definitions away from your application code and into reusable servers.
- **Monolithic** — The opposite of progressive: everything the model might need is loaded into context up front, in one block. Monolithic context is simpler to set up and fine for short, contained tasks, but it grows over time, pushes against the context window, and forces the model to attend to material that may not be relevant to the current step. Long-lived deployments built monolithically tend to degrade as the conversation accumulates.
- **Observability** — Ability to see what your system is doing, reconstruct why it behaved a certain way, and detect when something goes wrong.
- **Parametric knowledge** — Parametric knowledge means whatever the model learned during training and carries in its weights (its parameters). It is the model answering from memory, with no outside lookup. The opposite is knowledge the model pulls in at the moment of the request, like a document you hand it or a web search result.
- **Progressive** — An approach where context, instructions, or capabilities are loaded in stages as the work requires them, rather than all at once at the start. Progressive context gives the model only what it needs at each step, which keeps the working set focused and the cost of each call lower. The pattern shows up in skills that load reference files on demand and in agents that gather information through tool calls instead of receiving everything in the initial prompt.
- **Prompt caching** — Prompt caching is a feature that lets you store frequently used parts of a prompt, typically a long system prompt or a large document, so the model doesn't have to reprocess them from scratch on every request. The cached portion is computed once and reused across multiple calls.
- **Retrieval** — Fetching relevant information from an outside source at the moment of the request and handing it to the model along with the question. Instead of relying on what the model learned in training, you pull the current document, record, or passage and put it in front of the model so the answer is grounded in that source.
- **SDK** — Software Development Kit. A language-specific library (Python, TypeScript, and others) that wraps the API in idiomatic code for that language. The SDK handles the request formatting, authentication, retries, and response parsing so you can call Claude with a few lines of code instead of constructing HTTP requests by hand. The SDK is built on top of the API, so anything the API can do, the SDK can do, with less boilerplate. When an engineer says "SDK" they may mean this Anthropic SDK (a wrapper over the API) or the Claude Agent SDK (a managed agent runtime); however, these are two different things.
- **Shippable** — Ready for production use, not just a working demo. Shippable output meets the bar for accuracy, latency, cost, and reliability that the deployment actually requires, and it has passed the evals and review gates the team uses to release changes. The distinction matters because a prototype that handles the happy path is not the same as a system that handles the long tail of real user inputs.
- **Terminal** — A text-based interface for interacting with your computer's operating system by typing commands. Also called a command line or shell (e.g., Terminal on Mac, Command Prompt on Windows).
- **Tool use** — The capability that lets Claude call external functions, APIs, or services during a response instead of only generating text. The model decides when to invoke a tool, what arguments to pass, and how to use the result in its next step. Tool use is what turns Claude from a text generator into a system that can read files, query databases, search the web, or take action in other software.
- **Wrapper** — Code that surrounds or encapsulates another piece of code, library, or API to make it easier to use, add functionality, or translate between interfaces. For example, a Python wrapper around a C library lets you call C functions as if they were native Python.

---

## Recap — key takeaways

1. **Decomposition is the move that comes before architecture.** Split the work into three buckets — Claude / existing systems / humans — driven by how the model behaves on each piece. Designs that skip this force Claude into work another system would do at lower cost, or ask it to operate without the context a human would have.
2. **Choosing a pattern is choosing how much autonomy to grant.** Augmented LLM → workflow → agent is a spectrum from "Claude assists one step" to "Claude plans the whole sequence," with four workflow sub-patterns underneath. The decision depends on five factors — predictability, error cost, observability, latency, cost — and **the tightest constraint is the factor that decides.**
3. **Reach for the tested reference architectures before inventing your own.** Agent, RAG, Document-processing pipeline (Evaluator-optimizer), Routing, and Coding agent are documented because others already learned what breaks in each. Combine them when different parts break differently; pick one when still uncertain. **The most common mistake is using retrieval as a substitute for live state.**
4. **Choosing a model: start with Sonnet and treat every swap as a release.** Sonnet balances intelligence, speed, and cost for most workloads. Moving to Opus/Haiku needs an eval set defining "better" and a rollback criterion set *before* the swap. The same holds for context: **progressive** holds up over a long-lived deployment better than **monolithic**, which grows until it breaks.
5. **Pick the entry point by the work it has to do, not by what's already on the shelf.** Claude.ai, the direct API, the SDK, Claude Code, and MCP each carry a different core tradeoff (setup speed vs. depth of control, prebuilt UI vs. custom integration, breadth vs. focus). The right recommendation is the one where you can **name the tradeoff out loud when you make it** — which is also what tells you later when to switch.

*Module 1 establishes the platform decisions every downstream Architect choice depends on — the decisions you make at the platform layer set the ceiling for everything built above it. Next: **Module 2 — Enterprise Integration & Production** (deployment patterns, integration architecture, production reliability).*

---

### Sources cited by the module
- Anthropic Skilljar, **Claude 101** — model family (Opus, Sonnet, Haiku), Claude.ai and API entry points.
- Anthropic Skilljar, **Claude Code 101 In Action** — Claude Code customization stack, CLAUDE.md, subagents, MCP, Skills.
- Anthropic Skilljar, **AI Fluency Foundations** — the four-properties framework; next-token prediction, knowledge, working memory, steerability.
- Anthropic Skilljar, **Building with the Claude API** — RAG, chunking, hybrid retrieval, tool use, extended thinking, evaluation.

_Educational content; illustrative/fictitious examples. © 2026 Anthropic._

