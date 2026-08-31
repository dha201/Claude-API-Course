# Module 5 — Accelerators and IP Contribution

This lesson is Module 5 of the Developer Foundations track. The notes cover the whole module as exam-prep study material:

- 6 teaching sections — Packaging for Reuse · Contributing Back · Requirements & Lifecycle (functional/infra + systems lifecycle) · Deployment & Versioning · Comparing Platforms · Trust Boundaries — each with its frameworks and the failure ("Watch Out") lesson condensed
- All 8 reference tables reproduced verbatim: asset-type packaging table, packaging checklist, contribution-readiness reference, deployment-platform decision table (6 rows), cross-platform comparison reference, multi-component integration map, key-takeaways, and the sources table
- All 7 numbered checkpoints with answers, plus the 3-defect cumulative task **with the printed model answer** (the strongest exam material)
- Full glossary (5 terms, verbatim) and the recap
- Every Cost · Complexity · Risk box ("Handles well / Adds cost / Use a different approach") kept per section

> **Claude Certified Developer – Foundations Prep Course** · Module 5 (Foundations track)
> Source: SCORM deck `Developer_M5_vF2.html`.
> Study notes — condensed frameworks, reference tables, failure cases, and self-check
> questions extracted from the module. 25 screens · 9 sections · 139 minutes · 9 checkpoints.
>
> **Exam-scope flags:** this module carries **no [Partner Track] markers, no explicit
> not-tested markers, and no on-blueprint domain-number tags**. The only blueprint mention is
> the prose line "In blueprint terms, this is packaging for reuse" (untagged). Where a
> checkpoint printed no answer key, the answer below is **reconstructed from the module's own
> frameworks and marked _[reconstructed]_**. The cumulative task's model answer is printed in
> the source and reproduced verbatim.

---

## Orientation — what this module makes you able to do

The prior three modules took a business problem to a production agent wired into Claude Code with permission and context controls, MCP connections that pass a security review, and evals that prove it. Each was a *working build*. This module picks up **the moment code runs correctly** and asks the harder question: can someone else reuse it, can a maintainer accept it, can it survive a model update, and can a security or procurement team sign off on where it runs. The work is less about writing code and more about the decisions that make finished code reusable, deployable, and defensible to people who did not write it.

You either rebuild from scratch on the next engagement, or you **package once so the next team just configures** — the second path is what frees your time for new work.

**By the end you can:**

1. **Package** a working solution as a reusable accelerator (parameterized agent template, configurable MCP server, or portable eval suite) so the next engagement configures an asset rather than rebuilding.
2. **Contribute** a tool, pattern, or fix back through documented channels, prepared so a maintainer can accept it — turning a private asset into shared infrastructure.
3. **Choose where a Claude workload runs** across the first-party API, Amazon Bedrock, Google Vertex AI, and third-party platforms, and **version what ships** so a model or prompt change does not silently break production.
4. **Compare platforms** on latency, compliance, and cost so the choice is one procurement and security can sign off on.
5. **Build a multi-deployment application** and scope it so data and identity boundaries hold under a security or compliance review.

**"The build" throughline:** *a build that works is not yet a build that survives reuse, review, or deployment.* The same template must be configured for a team that never spoke to you; the same contribution verifiable by a maintainer who reconstructs nothing; the same model pinned so an upstream change is a decision not a surprise; the same platform cleared for residency; the same connected platforms holding boundaries under audit. **The point where code starts working is where this module's work begins** — and more of these decisions than you'd expect are driven by the customer's existing cloud, compliance posture, and review process.

*Educational content; illustrative/fictitious examples. Verify product specifics against Anthropic's website or docs — content may be outdated and your use is governed by Anthropic's terms.*

---

## 1. Packaging for Reuse

**Core idea:** An **accelerator** is a solution packaged so future engagements start from a working foundation rather than a blank repository. In blueprint terms this is *packaging for reuse*: separate engagement-specific code from the reusable core and parameterize the rest, exposing the customer-specific parts as parameters with documented defaults. The asset then **configures rather than gets rewritten**. Packaging while the build is fresh is cheaper than reconstructing intent months later, after the person who knew why a value was hardcoded has moved on.

**Most reusable work is one of three asset types — each packages differently.** Reaching for the wrong type can make an asset *look* reusable while still being hard to apply.

| Asset type | What it bundles | What correct packaging requires |
|---|---|---|
| **Agent Template** | The system prompt, the tool schemas, and the loop structure from a working agent. | Pull the domain-specific values into configuration with documented defaults, so a new team sets the values rather than editing the loop. |
| **MCP Server Package** | The tools the server exposes, with their inputs and the scope the installing team controls. | Document each tool input and let the installing team set the scope, so the server installs into a new environment without code edits. |
| **Eval Suite** | The graded test set and the judge rubric that prove the asset works. | Ship the dataset and rubric together so a new team can run them in their own context and confirm the asset still works there. The same eval suite also acts as the gate at deployment. When you promote a new model version to production, run it against a pinned baseline score before the version goes live. |

*Wrong approach, most common form:* shipping an agent as **loose scripts** instead of a template. The scripts run, so they look reusable, but every customer-specific value is buried in a different file, and the next team copies-and-diverges instead of configuring one asset.

**Also required beyond parameterizing:**
- **Document the code *and* the assumptions.** Code describes behavior; documentation covers what a future builder can't infer from source — environment assumptions, expected inputs, failure modes already handled, and the eval that defines whether it still works. Without this the next team treats the asset as a black box and rebuilds it.
- **Bundle the audit log as part of the package.** A regulated reviewer asks what data the asset touches, what identity it acts under, and what log it leaves. An accelerator without these passes a demo and stalls at the first security review.

**The packaging checklist** — each column is a decision made once per asset:

| Asset type | What to parameterize | What to document | What to bundle for audit |
|---|---|---|---|
| **Agent template** | Every value that changes per customer: prompts, paths, scopes, credentials by reference, and thresholds. | Environment assumptions, expected inputs, handled failure modes, and the eval that defines working. | The data touched, the identity acted under, and the log of what the asset did. |
| **MCP Server** | Scopes, credentials by reference, and per-customer paths. | Expected inputs per tool, scope boundaries, and handled failure modes. | The data touched, the identity acted under, and the log of what the asset did. |
| **Eval Suite** | Thresholds and dataset paths that change per customer or environment. | The rubric logic, what the scores mean, and the baseline the asset is pinned to. | The data touched, the identity acted under, and the log of what the asset did. |

**⚠ Watch Out — "the template that shipped fast and could not be reused."** Under a deadline, a team hardcoded the values that made the demo (repo path, model name, review thresholds, prompt fragments) and shipped on time, labeling it reusable. Months later a second team could not configure it *because there was nothing to configure* — every changeable value was baked into the loop, no doc said which values were customer-specific vs. load-bearing, and no bundled eval confirmed it worked in the new context. They rewrote it from scratch. **Why it broke:** the build was treated as finished the moment it ran, not the moment it could be reused; a working template does not announce that it can't be reused. **Rule:** a template that *runs* has not been *packaged* — the warning signs are the absence of three things (parameters, documentation, bundled eval). Package while the build is fresh; the knowledge of what is customer-specific is most expensive to reconstruct after the people who had it have moved on.

**Cost · Complexity · Risk:**
- **Handles well** — parameterizing while the build is fresh turns one delivery into an asset the next engagement configures in hours.
- **Adds cost/complexity** — separating generalizable from customer-specific parts and documenting assumptions adds real time to the first build.
- **Use a different approach** — for a one-off a customer will never reuse, packaging overhead isn't worth it: ship the build and move on.

> **Checkpoint 1 — Fix the broken accelerator template** _(no printed answer key — reconstructed below)_
> Given `agent_template.py` for a "reusable" code-review agent, one defect: a customer-specific value is hardcoded where a parameter belongs.
> ```python
> def build_review_agent():
>     return Agent(
>         model="claude-opus-4-8",
>         system_prompt=SYSTEM_PROMPT,
>         tools=[read_file, run_linter],
>         repo_path="/home/acme/checkout-service",  # customer repo
>     )
> ```
> _(Confirm current model ID at platform.claude.com/docs/en/about-claude/models at build time.)_
>
> **Answer _[reconstructed]_:** the hardcoded value is `repo_path="/home/acme/checkout-service"` (a per-customer repo path). Corrected: parameterize it —
> ```python
> def build_review_agent(repo_path):
>     return Agent(
>         model="claude-opus-4-8",
>         system_prompt=SYSTEM_PROMPT,
>         tools=[read_file, run_linter],
>         repo_path=repo_path,  # set per engagement
>     )
> ```
> *(A later checkpoint plants this same hardcoding defect among two others under multi-layer load.)*

---

## 2. Contributing Back

**Core idea:** Contributing back means moving an asset **from private reuse to shared infrastructure through a documented channel**. You've already done most of the work: packaging for internal reuse pulled out the parameters (shows it configures rather than rewrites), wrote down the assumptions (tells the maintainer what environment it expects), and bundled the eval (gives a way to confirm it works). The contribution channel carries the version, install steps, and components as a single unit so a team that never spoke to you gets the same working setup.

**Match the contribution to the channel built for it.** Each channel is built for a specific kind of contribution:
- **Claude Cookbook** — a GitHub repository of focused reference implementations; designed for **self-contained single- or multi-pattern implementations** demonstrated clearly and working end to end.
- **Open-source MCP servers and tools** — each lives in **its own repository** with its own contribution conventions.
- Sending a **full multi-component application** to the Cookbook is a mismatch — the repo reviews one focused pattern, not an entire application, so an oversized submission stalls. Putting a full application where a focused example belongs is one of the most common reasons a contribution never gets reviewed.

**What makes verifying a contribution possible** — the bar is set by what a maintainer needs to check, not by how clever the code is. Four things:
1. **The code does one thing.** A sprawling contribution forces a reviewer to reconstruct your intent before evaluating it.
2. **An example shows it running.** A reviewer shouldn't have to build a harness to see the behavior.
3. **A test proves it works.** Lets a maintainer verify the result without reproducing the reasoning.
4. **A short statement names the assumptions.** Otherwise the first failure becomes the maintainer's problem.

**Rights and attribution come *before* technical review.** Licensing and attribution decide whether a contribution can be accepted *at all*. Code carried in from a customer engagement may have constraints on where it can go. Confirming you have the right to contribute it, and attributing anything you built on, is a gate the contribution must pass first — skipping it turns a contribution into a problem the legal team must unwind later.

*Worked example:* the **customer service agent** case — a reusable conversation-handling pattern built during an engagement gets stripped of customer specifics and prepared as a general Cookbook example. The contribution-back motion is shared across all three curriculum roles; **the Developer's job is technical readiness** (focused code, example, test, assumptions, rights check). The engagement context comes from the broader team.

**The contribution-readiness reference:**

| Channel | What a maintainer checks | Licensing and attribution | The example and test bar to clear |
|---|---|---|---|
| Cookbook for a focused example, or the tool or server's own repository for a tool or fix. | That the code does one thing and that they can read it in full. | Confirm that you have the right to contribute code from an engagement, with prior work attributed. | A runnable example plus a test that proves the behavior, not just a description of it. |

**⚠ Watch Out — "the pull request a maintainer could not verify."** A developer opened a PR with the exact code that solved their problem; it sat three weeks with no review. The maintainer's explanation: *"It probably works for you. The problem is I can't tell. There is no test I can run, no example that proves the behavior, and nothing saying what it assumes about the environment… A focused PR with a test and an example gets reviewed fast because there is nothing left for me to reverse-engineer."* **Why it broke:** the code was correct, but the maintainer couldn't verify it without reconstructing the author's work — a gap the author overlooks because they already hold the missing context. **Rule:** before opening a contribution, add the example, the test, and the short assumptions statement; those three move it from the back of the queue to a fast review.

**Cost · Complexity · Risk:**
- **Handles well** — a packaged asset needs only the example, test, and rights check to become shared infrastructure others build on.
- **Adds cost/complexity** — clearing the maintainer bar and the licensing gate is real work on top of making the code run for you.
- **Use a different approach** — when code carries an engagement licensing constraint you cannot clear, do not contribute it: escalate to the owner instead.

> **Checkpoint 2 — Choose the contribution channel and the readiness fix** _(no printed answer key — reconstructed below)_
> Three cases, each matched to (1) its channel and (2) the one readiness item its snippet is missing.
> - **Case A** — a focused tool wrapping a single API into a clean function; the snippet is the function and nothing else.
> - **Case B** — a full customer-service application shared whole, including its UI and deployment scripts.
> - **Case C** — a one-line fix to an existing Cookbook example; the corrected line is carried in from a customer engagement.
>
> **Match 1 — case → channel _[reconstructed]_:**
> - A → **the tool's own repository**
> - B → **the Cookbook, but only after the reusable pattern is stripped out as a focused example**
> - C → **the Cookbook example's own repository**
>
> **Match 2 — case → missing readiness item _[reconstructed]_:**
> - A → **a test that proves the wrapper behaves**
> - B → **reduction to a single focused pattern** (a whole application doesn't fit a review built for one pattern)
> - C → **the rights check** (engagement code can carry a licensing constraint that blocks the merge before any technical review)

---

## 3. Requirements & Lifecycle

This section has two teaching screens (requirements capture, then the systems lifecycle) with a checkpoint after each. The deployment-platform decisions later all **assume the requirements already exist** — this is where they come from.

### 3a. From business problem to functional & infrastructure requirements

**Functional requirement** — names *what the system must do*, stated with enough detail to check. A business problem ("help support agents answer faster") is **not yet a requirement**; the functional requirements derive from it (e.g. "classify each ticket into one of four queues; draft a reply citing the relevant policy; never auto-send without human approval"). The discipline: write each as a **checkable statement of behavior** — a vague goal can't be designed against or verified; a specific one becomes a line in an eval and a criterion at review.

**Infrastructure requirements** — the non-functional constraints the deployment must satisfy. Most aren't stated in the business problem; you derive them by asking the questions it implies:
- **Latency** — how fast must a response be, *measured where the user is*?
- **Scale** — how many requests, and at what peak?
- **Residency** — where must data be processed, and under which regulation?
- **Identity** — who acts, under what credentials, and what must be auditable?

Latency, scale, residency, and identity **most often decide the deployment platform**, and are easiest to capture at the start, before a platform is chosen for other reasons.

**Document requirements so a decision can be defended.** The deployment decision is reviewed by people who didn't gather the requirements. A short **requirements record** — functional behaviors, infrastructure constraints, and the regulation each constraint comes from — lets you defend a platform choice as *following from the requirements* rather than from familiarity. This record is the input the deployment decision reads from.

**Cost · Complexity · Risk:**
- **Handles well** — turning a business problem into checkable functional and infrastructure requirements before any platform is chosen.
- **Adds cost/complexity** — eliciting infrastructure constraints up front takes a scoping conversation the team is tempted to skip.
- **Use a different approach** — for a throwaway prototype with no review and no regulated data, lightweight notes are enough.

> **Checkpoint 3 — Extract the requirements** _(no printed answer key — reconstructed below)_
> Scenario: a regulated EU bank wants an agent that summarizes customer call transcripts for its support team, with summaries reviewed before they are stored in the EU.
> - **Q1 — a valid *functional* requirement:** **B — "The agent produces a summary that a human approves before it is stored."** _[reconstructed]_ (A is a vague goal; C and D are infrastructure/constraint statements.)
> - **Q2 — a valid *infrastructure* requirement:** **C — "Transcript data is processed in the EU."** _[reconstructed]_ (A is a latency goal stated loosely; B and D describe system behavior, i.e. functional.)

### 3b. Systems lifecycle for Claude applications

The requirements just captured are the first phase of a longer arc. Naming the arc as the **systems lifecycle** places the module's deployment, versioning, and boundary work in the right phase rather than arriving as unrelated tasks. A Claude application moves through the same lifecycle as any engineered system:

1. **Requirements** — capture functional and infrastructure needs
2. **Design** — choose the platform, the model, and the trust boundaries
3. **Build** — write the agent, tools, and prompts
4. **Test** — evals, unit, integration, and end-to-end checks
5. **Deploy** — pin the version, gate promotion on the eval
6. **Operate** — instrument cost, latency, and errors; enforce guardrails
7. **Iterate** — feed production findings back into requirements

**Gating between phases.** A **gate** is a decision to move from one phase to the next — where a regulated engagement keeps control. You don't move from *design* to *build* until the platform satisfies the residency requirement; you don't move from *deploy* toward full production until the new version clears the eval against the pinned baseline. Placing work in the right phase, and refusing to skip a gate, is what keeps a Claude application reviewable.

**Cost · Complexity · Risk:**
- **Handles well** — placing each piece of engineering work in the lifecycle phase it belongs to, with a defined artifact and gate.
- **Adds cost/complexity** — gating between phases adds checkpoints a team under deadline is tempted to skip.
- **Use a different approach** — a one-off experiment may collapse phases, but a regulated deployment cannot.

> **Checkpoint 4 — Place the work in the right phase** _(no printed answer key — reconstructed below)_
> Phases available: requirements, design, test, deploy, operate.
> - (a) pinning the full model ID and keeping the prior version → **deploy** _[reconstructed]_
> - (b) gating promotion on the eval result before a version goes to production → **deploy** _[reconstructed]_
> - (c) deciding data must be processed in a specific region → **requirements** _[reconstructed]_
> - (d) instrumenting token cost and latency per call in production → **operate** _[reconstructed]_
> - (e) choosing Amazon Bedrock because the customer holds its compliance posture there → **design** _[reconstructed]_

---

## 4. Deployment & Versioning

**Core idea:** A packaged or contributed asset is merely code until something runs it. Now the question is **where it runs and how to lock its version**, so an upstream change doesn't become an untracked production change. That decision is rarely about technical merit alone — in practice it's shaped by **where the customer already has cloud infrastructure, identity management, and compliance agreements.** The first question is usually which platform the customer already trusts and operates on.

**The customer's cloud usually determines the platform.** The same model runs in several deployment environments:
- **First-party Claude API** — Anthropic's own environment; typically receives new features first.
- **Claude Platform on AWS** — accessed through the customer's AWS account using Anthropic's own model IDs and lifecycle; inference is **Anthropic-operated, outside the AWS boundary.**
- **Amazon Bedrock (two integrations):** *Claude in Amazon Bedrock* uses the Messages API at `/anthropic/v1/messages` with broad feature parity (a features-not-supported list exists — confirm feature-specific requirements against Bedrock docs); *Claude on Amazon Bedrock (legacy)* uses the InvokeModel/Converse APIs with ARN-versioned identifiers.
- **Google Vertex AI** — the same, inside Google Cloud.
- **Third-party platforms** (e.g. Microsoft Foundry) — embed Claude inside a product the customer already uses. **Foundry offers two hosting forms:** *Hosted on Azure* (currently Claude Opus 4.8, Claude Sonnet 5, Claude Haiku 4.5, inference running end-to-end on Azure infrastructure, GA) and *Hosted on Anthropic* (all other Foundry Claude models, inference on Anthropic-operated infrastructure). **Residency assumptions for regulated customers depend on the hosting form of the specific model** — confirm the hosting form and current model split with Microsoft at build time.

**Identity and data location are answered by the platform, not your code.** Bedrock uses AWS identity and keeps data inside the customer's AWS boundary; Vertex uses Google Cloud identity and boundary. Both offer regional routing when residency is a constraint. Matching the platform to the customer's existing compliance agreement avoids a data-residency review from scratch.

**Pin the version so an upstream model change is not a silent production change.** Every Claude model ID points to a specific snapshot. Aliases such as `opus` and `sonnet` are convenient but evolve over time and may resolve to different versions across platforms. **Pin the specific full model version rather than the alias** so an upstream update is a deliberate choice. Then version the prompt and the asset alongside the code, and **keep the prior version available so a regression can be rolled back.** An unpinned deployment makes every upstream model update an untracked change to your output.

```python
# Pre-4.6 example: a convenience alias can resolve to a new
# version without you knowing
model = "claude-haiku-4-5"

# Pre-4.6 pinned snapshot: the version is fixed until you change this line
model = "claude-haiku-4-5-20251001"
```
*For Claude 4.6 and later, the model ID alone pins to a specific snapshot; for earlier models, the ID plus a date suffix is required. Verify the current convention at platform.claude.com at build time.*

**Promote a version through the eval.** Send a new version to a portion of traffic, compare against the pinned baseline, and promote or roll back on the result. This is where the eval stops being a one-time test and becomes the **deployment gate.**

**The deployment-platform decision table:**

| Platform | Identity and data model | When to choose it | How versioning is pinned |
|---|---|---|---|
| **First-party Claude API** | Anthropic identity and terms. | The customer has no binding cloud or residency constraint and wants the newest capabilities. | Pin the full model ID and keep the prior snapshot. |
| **Claude Platform on AWS** | Anthropic identity and terms, accessed through the customer's AWS account; inference is Anthropic-operated outside the AWS boundary. Model lifecycle follows Anthropic's deprecation schedule. | The customer is on AWS but wants Anthropic model IDs, lifecycle, and feature parity with the first-party API. | Pin using the same model ID format as the Claude API (for example, `claude-opus-4-8`). Lifecycle follows Anthropic's schedule. (Confirm at publish time.) |
| **Claude in Amazon Bedrock** | Messages API at `/anthropic/v1/messages`, broad feature parity with the first-party API; confirm feature-specific requirements against the Bedrock documentation. Data stays inside the customer's configured AWS boundary. | The customer is on AWS, wants broad feature parity with the first-party API (confirm feature-specific requirements), and holds a compliance posture there. | Pin the full model ID using the `anthropic.` prefix format. Partner retirement dates differ from Anthropic's schedule. Confirm at publish time. |
| **Claude on Amazon Bedrock (legacy)** | AWS identity and billing, InvokeModel/Converse APIs with ARN-versioned model identifiers. | The customer is on an existing Bedrock integration using InvokeModel or Converse and has not migrated to the Messages API. | Pin via ARN-versioned model identifiers per Bedrock's versioning controls. |
| **Google Vertex AI** | Google Cloud identity, Identity and Access Management (IAM), and billing, with regional or global endpoints for residency. | The customer is on Google Cloud and holds a compliance posture there. | Pin the full model ID before rollout using Vertex's model ID format. Partner retirement dates differ from Anthropic's schedule. |
| **Third-party platform** | The wrapping product's identity and billing model. Note: Claude in Microsoft Foundry offers two hosting forms: Hosted on Azure (currently Opus 4.8, Sonnet 5, and Haiku 4.5; inference end-to-end on Azure) and Hosted on Anthropic (all other Foundry Claude models). Confirm residency and compliance terms with Microsoft before selecting this path for a regulated customer. | The customer already runs the platform that embeds Claude. | Pin per the platform's versioning controls. |

**⚠ Watch Out — "the deployment that broke when the model alias moved."** A team shipped against the alias that pointed at the recommended version. It worked — then the alias advanced. Production log:
```
--: deploy: model="opus" status=ok
--: alias advanced -> new opus version (no app change)
--: parser: KeyError "summary" in response payload
--: Error: output shape changed; downstream parse failed
--: rollback attempted -> no pinned prior version retained
--: incident: hotfix parser; root cause = unpinned deployment
```
**Why it broke:** the application never changed, but the alias did; no pinned prior version was retained, so there was nothing to roll back to; the hotfix repaired the parser but left the unpinned deployment in place. **Rule:** an alias resolves to a *moving target*; a pinned full model ID is a *fixed snapshot*. Pin the full model ID, keep the prior pinned version for rollback, and gate the new version through your eval so an output-shape change shows up in a test run instead of in production.

**Cost · Complexity · Risk:**
- **Handles well** — matching the platform to the customer cloud and pinning the version keeps a migration reviewable and a rollback possible.
- **Adds cost/complexity** — pinning, retaining prior versions, and gating promotion on the eval add release-process overhead to every deployment.
- **Use a different approach** — for a throwaway prototype that never touches production, a moving alias is fine: pinning is for what ships.

> **Checkpoint 5 — Match the deployment platform and version pin to the scenario** _(no printed answer key — reconstructed below)_
> Scenario: a customer runs AWS with a data-residency requirement and needs to roll back a model update. Select the one correct piece in each group; leave out what doesn't belong.
> - **Platform Group:** **Amazon Bedrock** _[reconstructed]_ (AWS + residency; first-party and Vertex don't fit)
> - **Identity Group:** **AWS identity reference** _[reconstructed]_
> - **Model reference group:** **A pinned full model ID** _[reconstructed]_
> - **Rollback Group:** **Retain the prior pinned version** _[reconstructed]_

---

## 5. Comparing Platforms

**Core idea:** You've chosen a platform and pinned its version — but "right for their cloud" is not yet an argument procurement and security will sign off on. Measure the three dimensions that decide the placement.

**Measure latency from the customer's region.** Latency depends on where the platform runs relative to the customer and on how access to new features is routed. A platform in the customer's own cloud region can cut round-trip time vs. a first-party endpoint farther away — the trade-off being that the **first-party API typically receives new capabilities first.** The number is only accurate when measured **from the customer's actual region against their actual payload** — a laptop measurement hides the round-trip penalty. Within Bedrock specifically, the **global-vs-regional endpoint choice is also the primary residency control** and can affect cost; measure both options from the customer's region before committing.

**Compliance often determines the platform.** A customer who already holds a certification on one cloud is unlikely to re-certify on another. **Data residency** = a rule that a customer's data must be processed in a specific country or region. Certifications and audit access differ by platform, and a regulated financial or healthcare customer treats these as **pass-or-fail, not tradeoffs.** The first-party Claude API may not offer EU data residency (confirm regional coverage at platform.claude.com) — **EU-only residency typically requires Bedrock or Vertex AI.** On third-party platforms such as Microsoft Foundry, hosting is per-model: Azure-hosted Foundry models run inference end-to-end on Azure; **Anthropic-hosted Foundry models do not satisfy EU regional residency requirements** — confirm per model and deployment with Microsoft. Raise the compliance constraint during scoping or it surfaces at contract review after the work is done.

**What drives total cost beyond the per-token rate.** Per-token rates are broadly aligned across platforms; **total cost moves on egress, platform fees, and integration effort.** A lower token price can cost more in total once data transfer and integration are factored in. Instrument cost per call for each platform; confirm current pricing pages at scoping.

**The cross-platform comparison reference:**

| Dimension | How it differs by platform | How to measure it | Where each platform wins |
|---|---|---|---|
| **Latency** | A platform in the customer's region shortens the round trip, while the first-party API may reach new features first. | From the customer's actual region against their actual payload. | An in-region cloud platform wins on round-trip latency, while the first-party API is advantaged on earliest feature access. |
| **Compliance** | Data residency, certifications, and audit controls are determined by the deployment platform. | Against the customer's existing certification and residency requirements during scoping. | The cloud platform the customer has already certified wins, because it needs no re-certification. |
| **Cost** | Token price, data egress, platform fees, and integration effort all vary. | Total cost per call per platform, including egress and integration, rather than token price alone. | The platform with the lowest total cost for the actual workload wins, which is not always the cheapest token. |

**⚠ Watch Out — "the platform picked on familiarity that failed residency."** A developer building for a regulated customer chose the platform the team had shipped on before; the integration came together quickly and passed its functional tests. At the security review the reviewer asked where data was processed — the selected platform did not satisfy the residency requirement, while a less-familiar platform would have via regional deployment options the customer had already cleared. The placement was rejected and the integration rebuilt. **Why it broke:** familiarity optimized for "could we build quickly," never for "would it pass the residency review" — and because compliance wasn't raised during scoping it arrived at go/no-go, the most expensive place to discover it. **Rule:** a platform that's easy to build on is not necessarily one the customer is *allowed* to run; for regulated customers the residency/compliance constraint is often pass-or-fail — identify it early in scoping and let it influence the placement before familiarity does. Checking early costs a scoping conversation; checking late costs an entire rebuild.

**Cost · Complexity · Risk:**
- **Handles well** — measuring all three dimensions per platform turns a placement into one a procurement team will sign off on.
- **Adds cost/complexity** — instrumenting latency, compliance, and cost across platforms requires real measurement work before any code ships.
- **Use a different approach** — when the customer's compliance requirement is already pass-or-fail, skip the full comparison: that constraint determines the placement on its own.

> **Checkpoint 6 — Diagnose the platform mismatch from a comparison trace** _(no printed answer key — reconstructed below)_
> ```
> platform_selected = "team_default"  # chosen on familiarity
> latency_test: measured from dev laptop -> 180ms (looked fine)
> customer_region: eu-west, payload 12 KB
> compliance_check: data residency = EU-only required
> result: REJECTED reason="data processed outside EU on selected platform"
> ```
> **Answer _[reconstructed]_: Option 2 — remeasure latency from EU-west and select the platform whose region satisfies EU-only residency.** (Option 1 optimizes a laptop-measured latency that isn't the failing test; Option 3 addresses cost, not residency. The mechanism is a familiarity-picked platform failing a pass-or-fail residency requirement, so only re-selecting for residency fixes it.)

---

## 6. Trust Boundaries

**Core idea:** The accelerators, deployments, and tradeoffs now come together in a **single application.** Connecting components multiplies the places where identity, secrets, and untrusted input can cross. The discipline: **identify every boundary before connecting anything.**

**Map which component does what before you connect them.** A **multi-component app** coordinates more than one Claude capability into a single workflow — e.g. an API request triggers a Claude Code task, which reaches a customer system through an MCP server. Each component contributes a capability the others don't have; every connection between them creates a place where identity, secrets, and untrusted input can cross.

**The trust boundary is where data moves.** A **trust boundary** = the point where data or instructions move from one deployment environment to another — exactly where the injection and access controls from the prior module apply. Content fetched by a Claude Code task is **untrusted** when it reaches the next component; the receiving component should treat it as **data, not instructions.** The core discipline: identify every seam as a boundary — don't assume a component is trusted just because it worked correctly on its own.

**Least privilege applies to the whole application.** **Least privilege** = giving each component only the access its task needs and nothing more. Each component operates under an identity, and **the application is only as contained as its most privileged seam** — a single component scoped too broadly is the weak point even when every other component is properly scoped. Scope each component to the least privilege its role requires; this is what keeps a steered component from reaching beyond its intended task.

**Scoping for a regulated review pulls the module together.** A regulated review requires justifying audit logging, data-residency decisions, and permission controls across the full application. For regulated deployments, **Bedrock and Vertex AI are typically the platforms that satisfy regional residency constraints.** Confirm **ZDR and HIPAA BAA** eligibility for each component against the Anthropic Trust Center and platform.claude.com before scoping.

**The multi-component integration map:**

| Component | What it contributes | The trust boundary at its seam | The control that enforces it |
|---|---|---|---|
| **First-party API** | Orchestrates the workflow and holds the entry point. | The request entering the app from outside. | Input validation and the identity the call runs under. |
| **Claude Code task** | Runs the agentic work and may fetch external content. | Content it fetched, which is untrusted downstream. | Treat fetched content as data at the next seam. |
| **MCP server** | Reaches a customer system to read or act. | The system access it holds on the app's behalf. | Scope the server to least privilege and log the access. |

**⚠ Watch Out — "the seam nobody marked as a boundary."** A developer wired up three components that each passed their own tests. Pairing session: *Dev B — "Where does the Claude Code task send what it fetched?" Dev A — "Straight into the next call as part of the prompt. It is just the content we pulled from the customer page." Dev B — "That content is untrusted. If it carries instructions, the next component runs them, because we never mark that seam as a boundary." Dev A — "But each component was trusted on its own." Dev B — "Right, and the seam between them was not."* **Why it broke:** each component passing its own tests said nothing about the seam between them; the boundary existed in the data flow but wasn't marked, so no control checked it. **Rule:** a component trusted in isolation does not make the seam leaving it trustworthy — mark every place data or instructions cross deployment environments as a boundary and put a control there that treats fetched content as data, not instructions. The seam nobody identifies is the one a steered action crosses.

**Cost · Complexity · Risk:**
- **Handles well** — naming every seam as a boundary and scoping each component to least privilege makes a multi-component app deployable under review.
- **Adds cost/complexity** — mapping seams, enforcing controls at each, and logging boundary crossings adds design and audit work to every integration.
- **Use a different approach** — when a seam cannot be secured, do not ship around it: escalate to a human owner.

> **Checkpoint 7 — Complete the multi-component boundary configuration** _(no printed answer key — reconstructed below)_
> ```python
> # components wired: API -> Claude Code task -> MCP server
> fetched = code_task.run(fetch_url=customer_page)
>
> # BLANK 1: control on the seam receiving untrusted fetched content
> next_call(input=____(fetched))
>
> # MCP server reaches the customer system (most privileged component)
> mcp_server = MCPServer(
>     system=customer_db,
>     scope=____,  # BLANK 2: identity scope
> )
> ```
> Token bank (two are distractors): `treat_as_data`, `least_privilege_read_only`, `run_as_instructions`, `full_access`.
> - **BLANK 1 → `treat_as_data`** _[reconstructed]_ (untrusted fetched content becomes data, not instructions; `run_as_instructions` is the distractor that would execute injected content)
> - **BLANK 2 → `least_privilege_read_only`** _[reconstructed]_ (the most privileged component is scoped to the minimum its role requires; `full_access` is the distractor)

---

## Cumulative task — find all three, explain each, write the correction (with printed model answer)

**Brief:** a runnable packaged accelerator deployed for a **regulated AWS customer**, across platforms, with **three planted defects — one per layer**: packaging, deployment-and-versioning, and multi-component boundary. (This is a two-screen task: *Diagnose*, then *Assemble and verify*.)

**The deployment as shipped:**
```python
# Packaged code-review accelerator, deployed for a regulated AWS customer
def build_agent():
    return Agent(
        model="opus",
        system_prompt=SYSTEM_PROMPT,
        repo_path="/home/acme/checkout",
        tools=[read_file, run_linter],
    )

deploy(platform="amazon_bedrock", identity=aws_role_arn)

# multi-component step: Claude Code task fetches a customer page
fetched = code_task.run(fetch_url=customer_page)
next_call(input=fetched)
```

**The corrected deployment (verbatim from the module):**
```python
def build_agent(repo_path):  # parameterized for reuse
    return Agent(
        model="us.anthropic.claude-opus-4-8",  # pinned full Bedrock model ID
        system_prompt=SYSTEM_PROMPT,
        repo_path=repo_path,  # set per engagement
        tools=[read_file, run_linter],
    )

deploy(platform="amazon_bedrock", identity=aws_role_arn,
       retain_previous_pinned_version=True)  # rollback target kept

fetched = code_task.run(fetch_url=customer_page)
next_call(input=treat_as_data(fetched))  # untrusted -> data, not instructions

# verify before promoting: gate the version through the bundled eval
assert eval_suite.run(model="us.anthropic.claude-opus-4-8") >= baseline_score
```

**Model answer (verbatim):** *The first defect was a hardcoded repository path. Parameterizing it restores reuse: a new engagement sets the value rather than editing the loop. The second defect was a moving model alias. Pinning the full Bedrock model ID (with the `anthropic.` prefix) with a retained previous version restores controlled rollout and gives a rollback target if the new version regresses. The third defect was fetched content passed directly as instructions. Wrapping it in `treat_as_data()` closes the trust boundary: content from an untrusted source is treated as data, not as something the agent should act on. The eval assertion gates promotion on a proven baseline score before the version ships.*

*Grading: "All three defects landed · pass" vs. "I missed one or more · retry."*

---

## Recap — five key takeaways

1. **Package while the build is fresh.** An accelerator keeps the reusable logic, exposes the customer-specific parts as documented parameters, and bundles the eval and the audit log alongside the asset. Correct packaging produces an asset teams *configure*. The knowledge of what is customer-specific is most expensive to reconstruct after the people who held it have moved on.
2. **A maintainer accepts what they can verify.** Match the asset to the channel built for its shape, then clear the review bar: focused code, a runnable example, a test, and a statement of assumptions — with **licensing rights confirmed before the technical review.** A contribution a reviewer cannot verify sits at the back of the queue.
3. **Pin what ships.** Choose the platform on the customer's cloud and compliance posture, then pin the specific model version rather than the moving alias and keep the prior version available. *An alias is like asking for the current edition of a book — convenient, but the text can change; pinning cites a fixed edition,* so an upstream model change is adopted deliberately with a rollback path.
4. **Measure the dimension that decides the placement.** A platform choice is defensible only when latency (from the customer's region), compliance (against their existing certification), and cost (total per call, not token price) are measured. For regulated customers compliance is usually pass-or-fail; raising it during scoping prevents it rejecting the build at contract review.
5. **Mark every seam as a boundary.** A multi-component app is only as contained as its most privileged seam. Scope each component to the minimum access its role requires and treat every point where data crosses as a trust boundary. Fetched content is data, not instructions. Trust at a component boundary must be **explicitly established** — it does not carry over from the component that sent the data. When a seam cannot be secured, it goes to a human owner rather than being shipped.

**What comes next:** you can now take a working build all the way to a deployable, auditable asset — package it, contribute it, place and version it on the right platform, defend that placement, and connect components so the boundaries hold. That completes the build-to-deploy arc for this persona. **The throughline: the point where code starts working is where this module's work begins.**

---

## Glossary (verbatim)

- **Accelerator** — A working solution packaged so the next engagement configures it rather than rebuilding it. Customer-specific parts are exposed as documented parameters, the assumptions are written down, and an eval is bundled to prove the asset still works in a new context.
- **Contribution readiness** — What a maintainer needs to verify a contribution: focused code, a runnable example, a test that proves the behavior, a statement of environment assumptions, and confirmed rights to contribute the code.
- **Deployment platform** — Where a Claude workload runs. The six are: the first-party Claude API, Claude Platform on AWS, Claude in Amazon Bedrock, Claude on Amazon Bedrock (legacy), Google Vertex AI, and third-party platforms. The same model can differ by platform on identity, data residency, latency, and cost.
- **Model alias versus pinned ID** — An alias such as `opus` or `sonnet` resolves to a recommended version that updates over time and can differ by platform. A pinned full model ID is a fixed snapshot. Pinning is what keeps an upstream model change from being a silent production change.
- **Trust boundary** — The seam where data or instructions move from one deployment environment to another in a multi-component app. Content fetched by one component is untrusted when it reaches the next, so the receiving component treats it as data, not instructions.

---

## Sources — Anthropic public references (time-sensitive)

| ID | Source | Type | Used for |
|---|---|---|---|
| **S1** | platform.claude.com (Claude in Amazon Bedrock, Claude on Vertex AI) | Product documentation | Deployment platforms, identity and data models, residency routing, regional and global endpoints. |
| **S2** | platform.claude.com (Model IDs and versioning, Model deprecations) | Product documentation | Pinned model IDs, alias resolution, lifecycle and retirement, partner-set schedules. |
| **S3** | anthropic.com and the Anthropic GitHub organization (Cookbook) | Product and repository | Contribution channels, the Cookbook as a home for focused examples, contribution conventions. |
| **S4** | Building with the Claude API (Skilljar) | Course source | Eval datasets, graders, and the evaluation pipeline used as the deployment gate. |
| **S5** | Claude Code 101 In Action (Skilljar) | Course source | Claude Code agentic tasks and MCP server roles in a multi-component workflow. |

*Module completion recorded 4 of 9 checkpoints passed in the source deck. Educational content; illustrative/fictitious examples. Re-verify model IDs, platform coverage, residency, and pricing at build time. © 2026 Anthropic.*
