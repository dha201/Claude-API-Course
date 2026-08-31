# Module 4 — Stakeholder Engagement, Lifecycle & Go-to-Market

This lesson is Module 4 of the Architect Foundations track. The notes cover the whole module as exam-prep study material:

- 5 competencies — Structured Discovery · Tradeoff Framing & GTM · Feedback Loops & SLA · Documentation for Handoff & Audit · Entry-Point Selection & Outcomes — each with its frameworks and the failure ("Watch Out") lesson condensed
- All 7 reference tables reproduced: discovery translation table, tradeoff translation map, demo-design decisions, production-signal governance table, documentation completeness checklist, entry-point decision matrix, outcome-document template
- All 6 checkpoints with their answers, plus the 7-decision cumulative exercise with model answers (the strongest exam material)
- Full glossary (~19 terms) and the recap
- Exam-scope flags preserved — I kept the module's own [Partner Track] "not tested by the Architect exam" markers and the on-blueprint (6.4) tag inline, so you can prioritize what's actually testable

> **Claude Certified Architect – Professional Prep Course** · Module 4 (Foundations track)
> Source: SCORM deck `Architect_M4_vF2.html` (Skilljar path `claude-certified-architect-professional`, lesson 486650).
> Study notes — condensed frameworks, reference tables, failure cases, and self-check
> questions extracted from the module. 19 screens · 6 sections · 6 checkpoints.
>
> **Exam-scope flags** appear inline: items marked **[Partner Track]** are *not tested by
> the Architect exam* (retained for partner-track learners); one entry-point field is tagged
> on-blueprint **(6.4)**.

---

## Orientation — what this module makes you able to do

Modules 1–3 took a business problem to a designed, integrated, governed Claude deployment. Module 4 is the work that happens **in the rooms with stakeholders**: the discovery call that sets real requirements, the approval meeting where a tradeoff is won or lost, and the handoff where the design either survives your absence or quietly degrades.

**Five competencies, each extending from the last:**

1. **Structured discovery** — turn a stakeholder preference into a documented, testable constraint.
2. **Tradeoff framing & GTM** — present a decision a stakeholder can act on; design a demo against the buyer's real scenario.
3. **Feedback loops & SLA** — the decision layer above observability that decides which signals change behavior and what you owe when one breaks.
4. **Documentation for handoff & audit** — record decisions *and rejected alternatives* so the design survives your departure.
5. **Entry-point selection & outcomes** — route a live multi-platform deployment and turn results into reusable IP.

**They map onto the deployment lifecycle:**

```
discovery ──▶ design ──▶ handoff ──▶ monitoring ──▶ iteration
└── Discovery + Tradeoff ──┘   │          └── Feedback loop ──┘
                        Documentation
   Entry-point selection + Outcome document closes the loop
```

Identifying which lifecycle phase a decision belongs to is what lets you judge when one phase is ready to advance to the next.

---

## 1. Structured Discovery

**Core idea:** *A discovery call is a structured elicitation, not a conversation.* It reveals whether you're solving the right problem.

**Three-step filter:** **Listen** (business goal in plain language) → **Translate** (into requirements, assumptions, unresolved constraints) → **Write down** (before the conversation moves on). Skip the filter and the design silently inherits *your* assumptions.

**The core move is translation.** Stakeholders speak in **preferences** ("seamless," "fast," "simple," "intuitive"); design decisions are made against **constraints**. The preference sits on top; the constraint sits underneath it. An experience word is a *signal that more discovery is needed*, not a requirement in itself — writing down "seamless" means you have the stakeholder's summary of the experience, not anything you can design. The real work is the next question: *what would make it feel not seamless?* That surfaces the hidden constraints. Ask: what would break that experience? what must the user never notice? what has to happen behind the scenes? what must still be true when something goes wrong?

*Worked example — "we want this to feel seamless" can decompose into:* user never waits more than a second or two for the next step (→ **latency target**); user never re-enters information that exists upstream (→ **integration requirement**); exceptions move quietly to a human reviewer instead of showing a technical error (→ **handoff rule + safe failure path**); the workflow stays inside one application (→ integration constraint). The stakeholder names the *outcome* in business language; you turn it into something the system can build and be measured against. **A testable, bounded constraint is what the design is built against; the preference only tells you where to investigate.**

**Four questions that turn discovery into requirements:**

| Bucket | What it captures |
|---|---|
| **What the system must do** | Capabilities as business outcomes; separates Claude's work from existing systems / humans |
| **What the system must not do** | Boundaries, prohibited actions, must-route-to-human cases. Stakeholders rarely volunteer these — ask explicitly |
| **What the system must cost** | Budget in terms the stakeholder controls: latency target, per-interaction cost ceiling, volume forecast |
| **What the system must prove** | Evidence obligations. In regulated workflows, proof obligations are part of the requirement set — find them now, not in legal review weeks later |

**Output = a translation table** (one row per item keeps reasoning intact into design):

| Stakeholder statement | Implied constraint | Required architectural decision | Assumption to document |
|---|---|---|---|
| "We want this to feel seamless." | Stay within an agreed latency budget; failures must not expose internals or break flow | Set a **p95 latency target** as a design constraint; design a graceful, internal-safe failure state | Assumes "seamless" = perceived responsiveness + continuity. Confirm. |
| "It just needs to read the form and route it." | Routing may be a deterministic business rule | Keep routing in the rule engine; Claude extracts, the system routes | Assumes routing logic owned outside the model. Confirm owner. |
| "Clinicians will review the output anyway." | A licensed human must authorize output before it enters a record with legal/clinical consequence | Build human-in-the-loop authorization as a **mandatory** checkpoint | Assumes review is an architectural gate. Confirm authority + timing. |
| "We're in healthcare, so be careful with data." | Likely a proof obligation under a health-privacy regime | Treat audit-trail + data-handling evidence as a core requirement from day one | Assumes covered workflow with formal obligation. Confirm scope with compliance. |

**⚠ Watch Out — "the discovery call that turned into a design session."** A competent architecture *sketch* offered mid-call ends the questions the call exists to ask. A plausible sketch makes the stakeholder assume the questions were answered. In the healthcare example, the "quick review step" was actually a mandatory clinician-authorization gate; dictation carried PHI; the network spanned two states with different retention rules — all missed because sketching started first. **Rule:** finish the four-category question set *before* proposing anything; treat every "it's just a review" as a constraint to chase.

> **Checkpoint (find the undocumented assumption):** Given requirements traced to stakeholder statements, the **60-day transcript retention** item was the undocumented assumption — **no stakeholder statement supported it**. (The others traced to "we send it ourselves," "feel instant," "anything big requires sign-off.")

**Cost · Complexity · Risk:** a long-enough discovery call is far cheaper than redesign after a hidden constraint surfaces in compliance review; real-time preference→constraint translation takes practice; the expensive failure is an unstated constraint that survives testing and becomes a production-review blocker when change is costliest.

---

## 2. Tradeoff Framing & Go-to-Market

**Your job is not to resolve the tradeoff before the meeting — it is to make a decision possible.** Present options clearly enough that the stakeholder makes an *informed* choice they can defend to their own leadership.

**The decision frame (name all elements every time):**
1. What do we **gain**?
2. What do we **give up**?
3. What happens if we choose this now but must **reverse it later**? ← *the one most people skip; it turns "better technical answer?" into "better business choice?"*
4. *(Regulated)* What does this do to our **compliance posture**?

**Why present options at all:** if you present only the conclusion, the decision *looks* clear but is weak — when the downside appears later, the stakeholder feels they approved a recommendation without understanding what came with it. Technical precision is necessary but not sufficient: the executive isn't asking "what's the better *technical* answer?" — they're asking "what happens to the business if we make the wrong choice?" The room needs translation, not more detail.

**Frame the decision as a package, not a verdict:** the options considered, the criteria you weighed them against, your recommendation, and the risks that remain. The stakeholder is not adopting your architecture — they're accepting a decision they must defend to their own leadership. This is the AI-Fluency competency **Description** applied to the stakeholder side. Three rules in practice: (1) **lead with the business outcome**, not the architecture; (2) **frame limitations honestly** — a security stakeholder trusts a system whose limits are clearly stated; (3) **anticipate the peer-proof demand** — the stakeholder must justify the choice to others, so they should leave with that justification in hand.

**Tradeoff translation map (architecture → stakeholder decision language):**

| Architectural decision | Gain | Give up | Cost of a wrong, reversed choice |
|---|---|---|---|
| Larger context window vs. retrieval over chunks | Simpler design, full doc in view, fewer moving parts early | Higher per-call cost + slower as volume grows (*evaluate **prompt caching** for static content before treating per-call cost as fixed*) | Re-architecting after cost spikes + credibility hit of an avoidable expense surprise |
| Trade logging detail for lower latency | Faster perceived response, smoother UX | Reduced per-interaction visibility | In a regulated workload, a compliance gap requiring remediation |
| Single delivery route vs. multi-platform | Lower build complexity, one auth/logging profile | Less flexibility for regional/compliance/procurement needs | Delayed/blocked cutover if the route can't meet a late data-residency or deployment requirement |

**⚠ Watch Out — "the approval that was not an informed choice."** An accurate, complete presentation can still answer the *wrong question*. The Architect recommended a larger context window (full policy doc in view every call, no retrieval layer); the CTO asked only "what's the cost per call?", got an accurate answer (~4¢/interaction, *"caching could bring the input portion down if the doc is static"*), and approved — *"let's keep it simple."* Six weeks later that 4¢ × call volume was a five-figure monthly line. The CTO's note: *"I approved a direction, not a number… if the document was static, why weren't we caching it? And… I needed to know what unwinding that would cost once the system depended on it."* Two elements (gain = simplicity, per-call cost) landed; the **reversal cost** — the load-bearing one — never entered the conversation. **Rule:** name all three elements every time, and name the reversal cost *especially* when the design feels obviously simpler.

> **Checkpoint (insurer, audit-trail obligation):** Recommend **Option A** (logging built in → full audit trail). The element missing from Option B's presentation is **the reversal cost** — what it costs to restore logging after the design depends on the latency gain.

### Go-to-Market subskills

**Demo design** *(scenario-specific beats capabilities):* a **capabilities demo** answers "what can this system do?"; a **scenario-specific demo** answers "what does this do with *my* problem, workflow, and constraints?" Only the second creates *confidence*; the first only creates interest. A weak, generic demo makes the buyer doubt you understood the problem.

**[Partner Track]** Four demo-design decisions to make *before building screens:*

| Decision | What the Architect decides | Why it decides the outcome |
|---|---|---|
| **Scenario selection** | A workflow the buyer recognizes from their own operations (familiar data shapes, approval steps, edge cases) | Recognition persuades more than a polished generic tour |
| **Limit placement** | Decide in advance which 1–2 limitations to name, framed as intentional scope boundaries | Naming a limit early reads as discipline; a limit *discovered* mid-demo drops confidence. In regulated settings, upfront disclosure is a positive signal |
| **Sales-team collaboration** | Shape the narrative with sales before building | Avoids answering questions the buyer never asked / overpromising |
| **Data preparation** | Data resembling the buyer's in structure & volume (anonymized but structurally faithful for regulated buyers) | Buyers judge the demo by its data; realistic fields make it argue for itself |

*Limit placement runs against instinct* — prepare with: What is the limit? Why does it exist? What happens if the use case must go beyond it?

**[Partner Track] Joint scoping with the Anthropic Applied AI team** — arrive with three things: (1) a documented view of requirements & constraints from discovery; (2) a proposed pattern / small candidate set with tradeoffs already named; (3) a short list of open questions only the Applied AI team can answer (model behavior, scaling, eval approach, safety, pattern fit). *It's a place to refine, not to learn the basics.*

**Objection categories (each needs a different response):** **Capability** (can it do the thing?), **Governance/compliance** (can it be trusted, controlled, evidenced?), **Design-choice** (why this and not that? — answer with the tradeoff + what the alternative would have cost, using the same translation structure).

**[Partner Track]** The GTM engagement map tracks demo design as a workstream (scenario, identified limitations, confirmed data source, sales sign-off) — matters most for parallel opportunities and mid-cycle Architect handoffs.

**Cost · Complexity · Risk:** prep is cheaper than a stalled opportunity or a withdrawn approval; the two instinct-fighting skills are *naming reversal cost* and *placing limits clearly*; the expensive failure is **false alignment** — approved in the room, reversal cost never made explicit.

---

## 3. Feedback Loops & SLA Management

**The feedback loop is the decision layer *above* the observability stack** — it decides which signals change behavior and whose. Observability records what's happening; *monitoring is not a feedback loop.* This is the **monitoring-and-iteration** lifecycle phase.

Live deployments **drift**: a support assistant launches in solid shape, then usage patterns change, new prompt styles appear, and issues get more complex — some responses slow, some answers start missing the mark. Nothing breaks *dramatically*, which is exactly what makes drift hard to catch; quality erodes gradually, and a team without a loop won't see the decline until users already feel it.

Observability gives the raw material (latency, error rates, eval scores, usage patterns), but **a signal by itself is not a decision** — one spike may be noise, another may be a real problem, a third matters only if it keeps happening. The feedback loop is the judgment layer that turns a *measurable* system into a *manageable* one.

**The loop answers five questions:**
```
Signals ─▶ Triage ─▶ Decide ─▶ Act ─▶ Review
```
- **Signals:** what is the system showing us?
- **Triage:** what needs attention now vs. later?
- **Decide:** team fix, stakeholder review, or no action?
- **Act:** what correction / guardrail update / escalation?
- **Review:** did the response work; does the rule need to change?

*(Analogy: a train-station control room — sensors show where trains are late; a human still decides if it's minor, if passengers must be told, if the schedule changes.)*

**An SLA names three things** — (1) what we measure, (2) what counts as a breach, (3) what happens on breach — and **thresholds must trace to a tangible source**, never arbitrary:
- Latency → the user-experience expectation from discovery
- Availability → how business-critical the deployment is
- Quality → the eval results / acceptance criteria already established

*Traceability keeps the SLA defensible.* **Cost is the expectation that breaks most often** — production volume routinely runs 1–2 orders of magnitude above pilot. Pre-empt with a consumption forecast at production volume, a named spend-control posture (caching, model tiering, budget alerts), and the model-tiering narrative *before* the first invoice.

**Regulated deployments add scheduled checkpoints** that fire even when nothing is wrong (periodic output audits, scheduled residency confirmation). These are *design-time* obligations. Build the governance table **before launch** — it turns policy into an operating routine.

**Production-signal governance table:**

| Signal type | Review trigger | Architect action | Regulated-industry checkpoint |
|---|---|---|---|
| **Output quality (eval score)** | Score crosses threshold from the eval suite | Diagnose prompt vs. data vs. model drift → iterate or re-architect | Periodic output audit vs. documentation standard, **on schedule, regardless of score** |
| **Latency p95** | Crosses budget set from UX requirements | Investigate bottleneck; tune or escalate if the budget itself is wrong | Usually none — unless latency masks a logging/traceability gap |
| **Cost per interaction** | Crosses the envelope agreed in discovery | Identify driver; bring a tradeoff to the stakeholder if the budget needs revisiting | Usually none — unless cost controls are a regulated operating constraint |
| **Data-residency configuration** | Scheduled confirmation | Confirm & record residency posture; flag drift immediately | Residency confirmation on the established schedule |

**⚠ Watch Out — "the observability stack that replaced the feedback loop."** Over a 90-day window, eval score drifted down weeks 4–7 but **never crossed an error-rate threshold, so no alert fired**; no review was scheduled; the quarterly review finally caught it in week 12 — *seven weeks late.* Every metric was collected; nothing *decided it mattered.* **Rule:** build the governance table mapping each signal to a trigger, an action, and an **owner** — include slow drifts, not just hard failures.

> **Checkpoint (triage nine signals):** buckets = **Internal monitoring** (p99 +40ms still in budget; seasonal token bump; new template with flat error rate), **Architect review** (eval score down 3 weeks; cost/interaction over budget), **Stakeholder review** (scheduled data-residency confirmation; quarterly output audit due), **Noise** (one malformed request from a known bad client; a 2 a.m. batch retry that then succeeded).

---

## 4. Documentation for Handoff & Audit

**The feedback loop keeps the system healthy while you run it; documentation keeps it functioning after you're gone.** This is the **handoff** lifecycle phase.

**One document serves three readers — serving only one makes it incomplete:**

| Reader | What they need |
|---|---|
| **Handoff recipient** (inheriting engineer) | Decisions made **+ rejected alternatives + why each was rejected**. Without rejected options they reverse the right decision for the wrong reason |
| **Compliance reviewer** | Each obligation → its technical control → the owner → the **evidence artifact** proving the control operates. *Reviewers require evidence, not assertions* |
| **Returning Architect** (you, months later) | A document that stands alone: **dated decisions, assumptions labeled as assumptions, open items with owners + resolution criteria** |

**Why rejected alternatives are load-bearing, not filler:** a design delivered without them can't be understood by someone who wasn't in the room — they'll either **reverse the right decision for the wrong reason** or **defend the wrong decision** because they can't tell which tradeoff it was resolving. The rejected options are what explain *why the design is shaped the way it is*. A diagram carries *what the system is*; without the rationale it can't tell the successor which choices are load-bearing and which are just preferences.

**Completeness test:** *Can a competent Architect who was not in the room make a **safe change** after reading the document?* If no, it's not complete — decisions are dated, assumptions are labeled *as assumptions* (not embedded as facts), and open items have owners + resolution criteria.

**Documentation completeness checklist:**

| Field | Captures | Primary reader |
|---|---|---|
| **Decision** | The architectural choice made, incl. date | All three |
| **Rejected alternatives** | Options considered but not chosen | Handoff recipient |
| **Tradeoff named** | The tradeoff the decision resolved (gains / costs / reversal) | Handoff recipient + returning Architect |
| **Owner** | Person/team responsible going forward | Compliance reviewer + handoff recipient |
| **Evidence artifact** | Proof the control is actually operating | Compliance reviewer |
| **Audit-ready status** | Whether evidence is current & sufficient | Compliance reviewer |

**⚠ Watch Out — "the design rationale that lived in the Architect's head."** A financial-services Architect left 12 weeks post-launch; the successor inherited a thorough diagram **with no rationale**. Fixing a performance issue, they switched context strategies — reintroducing a data-handling pattern that **broke the data-residency rule**. The diagram showed *what*, not *why*; the original in-region choice was load-bearing for compliance but never written as a decision with a named tradeoff + rejected alternative. **Rule:** *if it's never written, it leaves with you.*

> **Checkpoint (place six artifacts on Handoff↔Compliance × Intention↔Evidence):** Decision log w/ rationale & Assumption register → *Handoff·Intention*; Architecture diagram & Deployment runbook → *Handoff·Evidence*; (design intent) → *Compliance·Intention*; Control register w/ evidence links & Test-result summary → *Compliance·Evidence*.

---

## 5. Entry-Point Selection & Outcomes

Returns to route selection (from an earlier module) **with the full production picture.** The question is no longer "which route survives the compliance pre-filter?" but **"which route performs best across latency, cost, and compliance for a *live* deployment?"** *Entry-point capabilities change — re-verify every specific claim against `platform.claude.com/docs` and `anthropic.com` at build time.*

**Cross-platform deployments expose problems a single entry point never shows:** model-identifier strings differ across routes; feature availability can lag on cloud-mediated routes vs. the direct API; **regional availability on Bedrock/Vertex requires explicit configuration — defaulting to a global endpoint is the common pattern that breaks data residency.**

**Entry-point-responsibility map** — for any multi-entry-point workflow, document *which entry point owns which task and why*, before writing integration code. (E.g., direct API for back-end inference, Claude Code for an engineering sub-task, Bedrock for a regulated data path — each boundary has its own auth, logging, failure profile.) Prevents the common failure of an entry point chosen for one task quietly absorbing another because routing was never documented.

**Deployment entry-point decision matrix:**

| Platform | Latency profile | Compliance posture | When to pick it |
|---|---|---|---|
| **Direct Anthropic API** | Newest features first, fewest hops | Strong default — confirm coverage by configuration | **Default**, unless procurement/residency points elsewhere |
| **AWS Bedrock** | Region-configurable; possible feature lag vs. direct | Fits AWS procurement + region rules *when configured explicitly* | Partner standardized on AWS, needs in-region execution |
| **GCP Vertex AI** | Region-configurable; possible feature lag vs. direct | Fits GCP procurement + region rules *when configured explicitly* | Partner standardized on GCP with a Vertex procurement path |
| **Microsoft Foundry (Azure)** | Varies by hosting form: *hosted-on-Azure* runs inference in the partner's Azure env (GA); *hosted-on-Anthropic* routes to Anthropic infra | Verify residency & coverage per route — **don't assume from the platform name** | Partner procurement/residency requires that specific route |

**Outcome document** — makes value legible to a sponsor who wasn't on the build. **Six fields (6.4 on-blueprint):**

| Field | Records |
|---|---|
| Use case + scope boundary | What the deployment does *and does not* do |
| **Metric before** | The business metric before deployment |
| **Metric after** | Same metric after, same definition |
| **Control in place** | What makes the before/after **auditable**, not merely asserted |
| Measurement owner | Who owns ongoing measurement after the engagement closes |
| **[Partner Track]** Reuse potential | How the pattern transfers to other customers/engagements as IP |

*Technical metrics alone don't make the document — the **before-and-after business outcome + reuse notes** are what turn it into reusable IP.* Without the *before* number there's no story; without the *control*, the *after* number is an assertion.

**⚠ Watch Out — "the outcome document that measured the wrong thing."** An Architect wrote it from the easiest-to-export metrics — volume, average latency, error rate. The sponsor took it to the CFO, whose first question was *"what did it save or produce in business terms?"* — unanswerable. Missing: **before-and-after on the target business metric** (claims-processing time) and **the auditable control**. Complete as a technical record, useless as a case for expansion.

> **Checkpoint (pick platform + required outcome fields):** set the three variables (primary cloud, obligation level, performance constraint); the model maps to a recommended primary/secondary platform and the outcome fields the combination needs (e.g., strict-obligation/residency cases require an *auditable control + measurement owner*, and reuse potential to make it partner IP).

---

## Cumulative exercise — regulated multi-platform deployment (with model answers)

**Brief:** A regional healthcare network (health-privacy obligation, audit-trail + data-residency, spans two states) deploys a clinical-documentation assistant across two clouds. Nurses dictate; the assistant drafts the structured note; **a licensed clinician must authorize every note before it reaches the record.** Partner is AWS-standardized but runs non-regulated back-end on the direct API. You're 4 weeks in; the CFO wants to know what it's worth.

| # · Phase | Decision (model answer, condensed) |
|---|---|
| **1 · Discovery** | *Must-prove constraint:* the health-privacy obligation with audit-trail requirement. *Requirement row:* deployment must produce an auditable record of every model-generated note reviewed by a licensed clinician, traceable to the interaction. *Assumption:* confirm scope with compliance before design. |
| **2 · Tradeoff** | Trim-logging-for-latency: **Gain** faster clinician workflow; **Give up** per-interaction audit detail needed for the obligation; **Reversal cost** restoring logging after the build depends on the latency gain = redesign of the interaction layer + a compliance-exposure gap that must be disclosed/remediated. |
| **3 · Feedback loop** | *Signal:* periodic output audit vs. health-privacy documentation standard. *Trigger:* **calendar-based (quarterly), fires regardless of eval/error metrics.** *Owner:* compliance lead. *Action:* stakeholder review + audit record to compliance officer. |
| **4 · Documentation** | *Decision-log row:* context strategy = **explicit in-region execution via Bedrock, not a global endpoint.** *Rejected alternative:* global Bedrock endpoint (simpler config). *Tradeoff:* simpler setup vs. residency compliance. *Load-bearing:* a successor without this rationale reverts to global config to fix perf and breaks residency (the financial-services postmortem). |
| **5 · Entry point** | *Primary:* **AWS Bedrock, explicit in-region** (partner AWS-standardized, residency governs); verify HIPAA BAA / data-sovereignty is satisfied by the config in use. *Secondary:* direct API for non-regulated back-end. *Config step:* **set the region parameter explicitly in the Bedrock client — don't rely on default endpoint resolution.** |
| **6 · Outcome document** | *Before:* avg time from dictation to clinician-authorized note (baseline). *After:* same metric, same definition, post-deployment. *Auditable control:* the **clinician-authorization log** (timestamped record tying clinician, note, interaction). |
| **7 · Phase transition** | *Gate artifact:* the outcome document (before/after metric + auditable control + measurement owner) gates the transition to the CFO's expansion decision. *Judgment:* **not yet satisfied at week 4** — the *after* metric needs post-deployment runtime. Correct action: name the measurement owner, confirm the control is logging, schedule outcome-document completion at a defined post-launch milestone. |

---

## Glossary

- **Control register** — table mapping each regulatory obligation → technical control → accountable owner → inspectable evidence artifact; becomes the living record governing production life.
- **Decision log (with rationale)** — record of each choice *plus* the alternatives rejected and the tradeoff each resolved, so a successor doesn't reverse a load-bearing choice.
- **Deployment lifecycle** — discovery → design → handoff → monitoring → iteration; naming a decision's phase tells you when a phase is ready to advance.
- **Discovery** — a structured elicitation (listen → translate → write down) turning a business goal into requirements, assumptions, constraints.
- **Documentation completeness** — the test that a competent Architect not in the room can make a *safe change* after reading; requires decision, rejected alternatives, tradeoff, owner, evidence, and labeled assumptions.
- **Entry-point-responsibility map** — documented record of which entry point (direct API, Claude Code, Bedrock, Vertex, Foundry) owns which task and why, written before integration.
- **Evidence artifact** — concrete proof a control operates (signed agreement, config screen, authorization record, returned log query). A control asserted without an artifact is a claim, not proof.
- **Feedback loop** — the decision layer above observability (Signals→Triage→Decide→Act→Review) mapping each signal to a trigger, owner, action.
- **Governance table** — pre-launch table mapping each production signal to its trigger, the Architect's action, and any scheduled regulated checkpoint.
- **Joint scoping** *(Partner Track)* — working session with the Applied AI team; arrive with documented requirements, candidate patterns w/ tradeoffs named, and open specialist questions.
- **Limit placement** — deciding in advance which 1–2 limitations a demo names, framed as intentional scope boundaries.
- **Outcome document** — six-field artifact making a deployment's value legible to a sponsor not on the build; before/after business outcome + reuse notes make it reusable IP.
- **Requirement vs. assumption** — a requirement traces to something the stakeholder actually said; an assumption is taken for granted and never stated (the unsourced assumption is the most dangerous).
- **Reversal cost** — what it costs to undo a decision after the system is built around it; the third tradeoff element, most often omitted, most often decisive.
- **Scenario-specific demo** — built against the buyer's own workflow/data/constraints ("what does this do with *my* problem?"); only this creates confidence.
- **SLA** — commitment naming what's measured, what's a breach, what happens on breach; thresholds trace to UX expectation, business criticality, or eval criteria.
- **Tradeoff framing** — presenting a decision as gain / give-up / reversal cost (+ compliance posture when regulated) to make an informed decision possible.
- **Translation (discovery)** — converting a preference ("seamless," "fast") into a testable, bounded constraint.
- **Translation table** — discovery output: one row per item = statement as said · implied constraint · required decision · assumption to confirm.

---

## Recap — five things that hold across everything

1. **Structured discovery** — run four-category discovery, translate every preference into a constraint, write each as a requirement row with its assumption labeled.
2. **Tradeoffs & GTM** — present every tradeoff in three elements *including reversal cost*. **[Partner Track]** design the demo against the buyer's real scenario (limitations named first); enter joint scoping with requirements, candidate patterns, and open questions.
3. **Feedback loops & SLA** — build the signal→trigger→action→owner decision layer, set SLA thresholds from real sources, wire regulated checkpoints to run on a schedule.
4. **Documentation** — write the decision, rejected alternatives, and the tradeoff each resolved *while you still hold the reasoning*; carry the control register forward as reviewer-grade evidence.
5. **Entry point & outcomes** — choose the route on latency/compliance/cost with an entry-point-responsibility map; capture the before metric, the auditable control, and the reuse note so the outcome document justifies expansion.

*Next module: team enablement & operational productivity — configuring Claude tooling for a team, trustworthy AI-assisted developer workflows, and operational health of a live deployment.*

---

### Sources cited by the module
Building with the Claude API (Skilljar) · Claude 101 (Skilljar) · AI Capabilities and Limitations (Skilljar) · `platform.claude.com/docs` (model names, route availability, residency config — re-verify at build) · `anthropic.com` partner-program docs (GTM stages, IP-contribution) · Anthropic Applied AI team docs (joint-scoping structure).

_Educational content; illustrative/fictitious examples. © 2026 Anthropic._
