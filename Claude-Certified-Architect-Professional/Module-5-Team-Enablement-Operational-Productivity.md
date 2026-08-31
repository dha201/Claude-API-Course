# Module 5 — Team Enablement and Operational Productivity

This lesson is Module 5 of the Architect Foundations track — the final module. The notes cover the whole module as exam-prep study material:

- 3 core competencies — Team Setup (environment · rollout · Skills distribution · spend) · Developer Workflows (AI integration + verification discipline) · Operational Support (symptom→cause + self-sufficiency) — each with its framework and the failure ("Watch Out") lesson condensed
- All 3 reference tables reproduced verbatim: Skill distribution mechanisms · where Claude helps at each workflow stage · symptom → architecture cause → first action
- All 3 checkpoints with their answers — the team-distribution scenario set, the verification-checklist exercise (with the module's model answer), and the 5-question module quiz
- Full glossary (7 terms) and the recap
- Exam-scope flags: this module carries **no** [Partner Track] markers and **no** on-blueprint domain-number tags — nothing to prioritize out, everything here is in scope

> **Claude Certified Architect – Professional Prep Course** · Module 5 (Foundations track)
> Source: SCORM deck `Architect_M5_vF2.html` (Claude Certified Architect Foundations · M5).
> Study notes — condensed frameworks, reference tables, failure cases, and self-check
> questions extracted from the module. 9 screens · 4 sections · 3 checkpoints.
>
> This is the smaller, closing module of the track. It assumes the system from Modules 1–4
> is already built and asks how a team adopts and sustains it.

---

## Orientation — what this module makes you able to do

Modules 1–4 made you an Architect who can take a deployment from a stakeholder's first sentence through design, integration, governance, and handoff. Module 5 is about the **team around that deployment**: getting people productive with Claude and keeping them productive once the system is live. Every prior module taught you how to *build and configure* Claude; this one assumes the system is built and asks **how does a team adopt it well, and how does it stay healthy without pulling you into every issue?**

**Three competencies, run in order — set up the environment, raise the daily workflow, keep the system healthy:**

1. **Configure Claude tooling and environments for a team** — the shared configuration, the rollout pattern, the Skills distribution strategy, and the spend controls that belong in team setup.
2. **Improve developer workflows with AI tooling** — and define the review discipline that keeps AI-generated work trustworthy before it reaches production.
3. **Support debugging and operational issue resolution** — connect symptoms to architecture causes and build the team toward self-sufficiency.

**They build on each other:** the Skills you distribute in setup are the same assets a developer workflow leans on; the review discipline you establish for those workflows is what an operational issue tests under pressure.

---

## 1. Team Setup — configuring Claude tooling and environments for teams

Configuring Claude for *yourself* takes minutes; configuring it for a **team** is different — you need shared defaults so everyone starts from the same baseline, reusable assets that can be updated and revoked centrally, and spend that stays bounded as usage scales across dozens of people. The Architect owns **four team-setup decisions**: environment, rollout, Skills distribution, and spend.

**Deploy the environment as a shared configuration.** A team environment is a *baseline every developer starts from*, not a set of personal setups. For Claude Code that means a project-level baseline the team agrees on — a shared `CLAUDE.md`, an agreed set of tools and MCP servers, and a permission posture — so people don't discover ad hoc settings and drift apart. That baseline is something you review, version, and improve once for everyone.

**Roll out through champions, then batches.** Team adoption rarely succeeds as a single all-hands switch-on. Identify a **champion per department/team** who gets access first, proves the workflow in practice, then seeds adoption batch by batch. The champion absorbs the early friction, builds the local examples, and becomes the first line of support — so the Architect is not the only person who can answer questions.

*Worked example:* A 200-person engineering org wants Claude Code across four departments. Instead of enabling all four at once, the Architect enables one champion per department, gives each two weeks to convert a real workflow (a code-review assist, a test-generation step), and has each champion run a 45-minute session for a first batch of five peers. By the broad rollout, every department has a working example, a local expert, and a champion-tuned `CLAUDE.md`. The same rollout as a single mass email would have produced a spike of confused first-time prompts and a quiet retreat to old habits.

**Skills distribution — the team-scale version of reuse.** Skill packages are repeatable procedures shipped as versioned, reusable units. At team scale the question is *how you create, version, publish, grant/revoke access to, and roll back* a Skill. There are **four ways to distribute a team Skill**, differing in who can access it and how much control you retain. (Note: *centrally managed Claude Code configuration* — server-managed settings delivered on authentication and refreshed on an hourly polling cycle — is a **settings mechanism, not a Skills distribution path.**)

### Skill distribution mechanisms

| Distribution mechanism | Best when | Governance and rollback |
|---|---|---|
| **Org-provisioned Skill** (Organization settings › Skills) | A capability should reach everyone in the organization. | Owner-managed availability and removal across the org; users can toggle individual skills off but cannot remove them. No version pinning or native rollback; updates require manual re-upload. |
| **Plugin assigned to a group / org** | A procedure or tool set should reach specific teams, or that needs governed rollout. | Group targeting, install preferences controlling whether a plugin is required, installed by default, or available to users (exact labels per the current admin UI, support article 13837433), and version-controlled updates from a connected repo. Strongest governance option for group-scoped distribution. It is not the only mechanism with a path back to a prior version: API Skills support explicit version pinning, and Claude Code project Skills roll back with the repository that carries them. |
| **Claude Code project Skill** | A tool or convention one team shares across its own projects. | A filesystem artifact in the project repository (`.claude/skills/`), versioning with the repository and scoped to the projects that carry it. |
| **API Skill** (Messages API container) | A capability called programmatically by the partner's own products. | Governed in the calling system; supports explicit version pinning; reuse is machine-to-machine rather than human-facing. |

Packaging a team workflow as a distributable Skill is how a good *local* practice becomes a *team standard*: the procedure travels as one governed artifact instead of as undocumented know-how, and updates propagate through versioning rather than re-explaining.

**Set the spend posture before the first bill.** Admins should set cost guardrails *intentionally* rather than inherit defaults: **model defaults** (which model a session starts on), **model allowlists and restrictions** (which models the team may switch to), **effort guidance** (how hard the model works), and **spend, rate, and per-user caps**. Module 2 showed that leaving model choice unmanaged can quietly route work to a more capable, more expensive tier than the task requires — at team scale that choice multiplies across every member and every request.

**⚠ Watch Out — "the skill that shipped with no way back."** A platform team packaged its release-notes procedure as a skill, bundled it into a plugin, and assigned it to its 40-engineer group — but pushed it as a flat bundle *without* the version-controlled updates and rollback a plugin provides. A week later a well-meaning edit changed the prompt and the skill produced notes in the wrong format across every team, and the fix required a manual re-edit while bad output kept shipping. **Rule:** a shared asset with no version and no way back is a liability the moment more than one person depends on it — when it needs versioning, group targeting, or rollback, distribute it inside an organization-managed plugin and name an owner.

**Cost · Complexity · Risk:** setup time (shared config, rollout plan, Skills packaging up front) is far cheaper than later reconciling forty configurations that have drifted apart; the hard part is **distribution governance** — who can reach, update, and revoke each shared asset, decided per asset; the biggest failure mode is a shared asset (skill, config) with **no versioning or rollback**, so one bad change propagates to the whole team before anyone can stop it.

> **Checkpoint — design the team distribution strategy.** For each scenario, choose the mechanism *and* the factor that makes it right (a correct mechanism paired with the wrong reason does not pass). Answers follow directly from the distribution table:
>
> - **A — compliance-review procedure every department must run identically, centrally updatable and roll-back-able → Plugin distributed org-wide** (to all relevant groups). *Deciding factor:* the requirement for central update + rollback (version-controlled updates), which only the plugin path provides. *(Confirmed by module quiz Q2.)*
> - **B — capability that should be available to every member, no versioning/rollback need → Org-provisioned Skill** (Organization settings › Skills). *Deciding factor:* it reaches everyone at once and there is no governance/rollback requirement to justify the heavier plugin path.
> - **C — coding convention and tool set the engineering team shares on every project → Claude Code project Skill.** *Deciding factor:* it lives in the project repo (`.claude/skills/`) and versions with the repository the team already carries across its projects.
> - **D — reusable capability several of the partner's own products must call programmatically → API Skill** (Messages API container). *Deciding factor:* the reuse is machine-to-machine/programmatic, with version pinning governed in the calling system.

---

## 2. Developer Workflows — improving developer workflows with AI tooling

A team can have Claude configured perfectly and still get little from it. The difference is their **workflow** — how AI assistance is woven into how developers work, and the discipline that keeps its output trustworthy. This section raises the workflow bar *without lowering the quality bar*.

**Integrate assistance into the workflow that already exists.** AI tooling pays off when it lives *inside* the existing workflow — the editor, the review process, the test loop — not in a separate chat window visited occasionally. The Architect finds where AI assistance removes real friction. Integration is also how a team's knowledge gets encoded: conventions, review standards, and repeated procedures that usually live in people's heads become Skills and project configuration Claude applies consistently, so good practice travels with the tooling rather than depending on who's in the room.

### Where Claude helps at each workflow stage, and the review discipline it still needs

| Workflow stage | Where Claude can help | Review discipline it still needs |
|---|---|---|
| **Writing code** | Drafting boilerplate, tests, and first-pass implementations from a clear spec. | Correctness and security review; the author must understand what was generated. |
| **Reviewing code** | Summarizing a diff, flagging likely issues, explaining unfamiliar code. | Human judgment on the call; AI flags are input, not a verdict. |
| **Debugging** | Proposing hypotheses from a symptom and a trace. | Verify the hypothesis against evidence before acting on it. |

**Two failure modes recur:**

1. **Lumpy adoption** — a few developers use AI tooling heavily and the rest barely touch it, so the team never realizes the real gain and the practice never standardizes. The champion-and-batch rollout from Team Setup prevents this by spreading usage deliberately.
2. **Stalling at basic chat** — the team uses Claude as a question-answering box and never advances to higher-value workflows (tool use, repository-aware assistance, packaged skills) because no one enabled them past the first step. *Access is not adoption* — you configure for real enablement within current workflows.

**Diligence — the discipline that keeps AI-generated work trustworthy.** Diligence is one of the four **AI Fluency** competencies: *taking responsibility for what we do with AI and how we do it.* **Deployment diligence** specifically means taking responsibility for verifying and vouching for the outputs we use or share. Applied to developer workflows: hold AI-generated code to the same standards as any other code — **correctness, security, maintainability** — and watch for the subtle failure where engineers accept output they no longer fully understand because it *looks right* and passes a check.

The concrete deliverable diligence produces is a **verification checklist**: the explicit set of checks an AI-generated output must pass before production, produced internally to a team's needs, covering **all four dimensions — correctness, security, maintainability, and human understanding.** Wherever a check can be made automatic, it should be: a regression test suite and an eval set turn correctness/behavior verification from a reviewer's judgment call into a **gate that runs on every change**. The checklist defines *what must be true*; evals and tests prove it repeatably instead of re-deriving it by hand.

**⚠ Watch Out — "the merge nobody could explain."** A team adopted AI-assisted coding and shipped noticeably faster. Three weeks in, a generated change passed code review and tests and went to production, where it leaked data through an input it never validated. In the post-incident review the author could not explain why the code handled that input the way it did — it looked plausible, tests were green, and no one asked the question the checklist would have forced: *can the person merging this explain what it does and why?* Speed had quietly replaced understanding — exactly the **judgment erosion** diligence exists to catch.

**Cost · Complexity · Risk:** AI assistance lowers the cost of producing code, which *raises the volume reaching review* — the verification checklist keeps that volume from overwhelming the quality bar; the hard part is **cultural, not technical** (holding AI-generated code to the same review standard, especially when it ships faster and looks right); the biggest failure mode is **judgment erosion** — shipping output the team no longer understands because it passed shallow checks, until an input no one reasoned about reaches production.

> **Checkpoint — define the verification checklist.** Write one concrete check for each of the four dimensions AI-generated code must pass before production. **Model answer (verbatim):**
>
> - **Correctness:** Tests exist and pass, and the behavior matches the stated requirement including edge cases.
> - **Security:** No secrets in code; inputs are validated; any tools or external calls use least-privilege access.
> - **Maintainability:** The code reads clearly, follows team conventions, and contains no unexplained complexity.
> - **Human understanding:** The developer submitting the change can explain what the code does and why, including how it handles the inputs it was not explicitly tested against.

---

## 3. Operational Support — supporting debugging and operational issue resolution

There's always a time when a live deployment surprises its team. When it does, the Architect connects *what the team is seeing* to *why it is happening* — and upskills the team so next time they feel empowered to resolve it themselves.

**The support role is translation, not firefighting.** When an operational issue lands, the team usually identifies a **symptom, not a cause** (latency spiked, outputs degraded, a tool started failing). The Architect's value is connecting the operational symptom to its **architecture cause** — the same diagnostic discipline Module 2 built for production systems, now applied *in support of a team that owns the deployment.* Resolving one incident yourself is firefighting; teaching the team the symptom-to-cause path they can follow again is **support that lasts.**

### Symptom → likely architecture cause → first action

| Symptom | Likely architecture cause | First action |
|---|---|---|
| Output quality degraded gradually, but there was no code change | A model or prompt change, or retrieval drift as the corpus grew. | Compare against an eval set; check what changed in the model, prompt, or corpus. |
| Latency spiked | Context size grew, a tool got slow, or a cache stopped hitting. | Use telemetry and request traces to find the slowest span: check token counts per request and the slowest tool call, and confirm cache behavior. |
| Intermittent tool failures | Authorization, rate limits, or an unhandled error path. | Inspect the failing tool's auth and limits; trace one failed call end to end. |
| Cost rose without a usage change | Model tier crept up, or caching regressed. | Check per-request model tier and cache hit rate against the budget model. |

**Build self-sufficiency — runbooks and escalation paths.** Self-sufficiency is *engineered* into functioning teams. A **runbook** captures the known symptom-to-cause-to-action paths so the team resolves recurring issues without the Architect (the table above is the foundation of a good runbook). An **escalation path** names who handles what and when an issue leaves the team, so people know the boundary of what they can resolve and what must be escalated. The goal is a team that needs you only when *new* problems arise.

**⚠ Watch Out — "the drift that waited for a quarterly review."** A support team watched a deployment's dashboards stay green for an entire quarter while answer quality quietly slid. No one connected the slow decline to its cause — a growing retrieval corpus the index had not kept pace with. The symptoms were visible the whole time, but the runbook entry that says *gradual quality decline with no code change points at the model, the prompt, or retrieval drift* was missing. With that path written down, a first-line engineer could have resolved it in an afternoon; without it, it waits for a review.

**Cost · Complexity · Risk:** teaching the symptom-to-cause path costs more of the Architect's time up front than fixing the incident directly, but it is the only version of support that *reduces future load instead of repeating it*; the hard part is **resisting the urge to firefight** — the durable fix is helping the team create a runbook entry and an escalation path; the biggest failure mode is a **slow degradation no one connects to a cause**, so it runs until a scheduled review catches it rather than the team catching it the day it starts.

---

## Module Quiz — five scenarios across the three topics

Five scenario questions; choose the best answer (the module's feedback names the principle). Correct answers below follow from the frameworks above.

| # · Topic | Question | Best answer |
|---|---|---|
| **1 · Team setup** | Rolling out to four departments at once and adoption is uneven — best next move? | **B** — Enable a champion in each department first, prove the workflow, then seed adoption in batches. |
| **2 · Skills distribution** | A procedure must be run identically by every department and be revocable from one place — how distributed? | **B** — Bundled into an organization-managed plugin distributed to all departments, with group/org targeting, version-controlled updates, and rollback. |
| **3 · Developer workflows** | Team ships AI-generated code faster but a security issue slips through — what was most likely missing? | **C** — A verification checklist that AI-generated code must pass before production, including a security dimension. |
| **4 · Judgment** | A developer can't explain why an AI-generated change handles an input the way it does, but tests pass — what should happen? | **B** — Hold it until the author can explain the behavior and its rationale (the human-understanding check). |
| **5 · Operational support** | Output quality degraded over two months with no code changes — where does the Architect look first? | **B** — A model or prompt change, or retrieval drift as the corpus grew — connect the symptom to an architecture cause. |

---

## Glossary

The key terms used across this module, in alphabetical order.

- **Champion-per-department rollout** — An adoption pattern that enables one champion per team first to prove the workflow, then seeds adoption batch by batch.
- **Escalation path** — A named definition of who handles what and when an operational issue leaves the team.
- **Runbook** — A captured set of known symptom-to-cause-to-action paths that lets a team resolve recurring operational issues without the Architect.
- **Shared configuration** — A single team baseline (for example a project `CLAUDE.md`, agreed tools, and permission posture) that every member starts from, instead of individual setups that drift apart.
- **Skills distribution** — Getting a Skill in front of the right people through one of four mechanisms, each with different access, versioning, and rollback behavior: org-provisioned Skills (Organization settings › Skills) for organization-wide availability; plugins assigned to a group or org for scoped distribution with install preferences, version-controlled updates, and rollback; Claude Code project Skills versioned with the repository and scoped to a team; and API Skills called programmatically with explicit version pinning.
- **Spend posture** — The model defaults, model allowlists and restrictions, effort guidance, and spend, rate, and per-user caps set as part of team configuration keep consumption within bounds.
- **Verification checklist** — The explicit set of correctness, security, maintainability, and human-understanding checks AI-generated output must pass before production.

---

## Recap — four things that hold across everything here

1. **Team setup is shared configuration, distribution, and spend posture decided up front.** A team environment is a shared baseline plus a Skills distribution approach — org-provisioned for everyone, plugins for group/org targeting with versioned updates and rollback, project Skills for one team, API Skills for programmatic reuse — all bounded by model and budget guardrails.
2. **Adoption is engineered through champions and batches.** A champion per team proves the workflow and seeds adoption; access without enablement stalls at basic chat, and lumpy adoption never standardizes the gain.
3. **Diligence keeps AI-assisted work trustworthy.** Hold AI-generated code to correctness, security, and maintainability standards, and require that the author can explain what shipped — captured as a verification checklist that gates before production.
4. **Operational support is translation plus self-sufficiency.** Connect symptoms to architecture causes and leave behind runbooks and escalation paths so the team needs you for the *new* problem, not the familiar one.

*That completes the Architect track: you can take a deployment from a stakeholder's first sentence through design, integration, governance, handoff, and deliver it to the team that adopts and runs it. A deployment the team cannot operate, debug, and improve will not stay productive — you now have the patterns to keep it running.*

---

### Sources

- Anthropic Skilljar, *Building with the Claude API*: tool use, API integration mechanics, and baseline Skills concepts carried into team distribution.
- Claude Code configuration docs (code.claude.com): `CLAUDE.md` instructions vs. enforceable settings, permissions, hooks, MCP, and managed settings.
- Claude Code Skills and organization Skills provisioning docs: Skill package structure, project Skills, plugin-based distribution, and owner-provisioned org-wide availability.
- Organization plugin management (support.code.com): plugin marketplaces, group assignment, install preferences, required/default install, hide/deprecate behavior, manual upload, GitHub sync, update, and removal mechanics.

_Educational content; illustrative/fictitious examples. Verify against Anthropic's website and docs, which control._

