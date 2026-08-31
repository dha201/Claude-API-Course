# Keyur Patel · pre-screen cheat sheet

**Today 4:30 PM EST · Teams · 30–40 min · Req 1015986 · PR-3 AI Engineer (Tooling & Governance) · AWS for Goldman Sachs**

---

## 1. What they're asking for

| # | What the JD asks for | Its own words | Where you ask |
|---|---|---|---|
| **A** | **Code transformation** <br>AGT-002, AGT-031 | "Develop and refine automated code transformation processes using AI-assisted methodologies" · "Proven experience with AI-assisted code transformation tools and environments" | Block 6, then depth in 4 |
| **B** | **Agent orchestration** <br>AGT-005 | "Design and implement agent orchestration solutions to streamline system workflows" · "Strong understanding of agent orchestration and workflow automation" | Blocks 2, 3 |
| **C** | **Asset library + promotion gates** <br>AGT-004 | "Manage and maintain asset library structures and ensure proper governance through promotion gates" · "Maintain and improve internal governance frameworks for software delivery" · "Familiarity with internal governance frameworks and promotion gate processes" | Block 5 |
| **D** | **Infra + container build** <br>AGT-009, AGT-010 | "Support infrastructure provisioning using cloud development kits and templates" · "Contribute to application assessment activities and container build processes" · "Familiarity with infrastructure provisioning using **CDK templates or similar tools**" | Block 6 |
| **E** | **Ways of working** | "Ability to work collaboratively within structured enterprise problem-solving methodologies" · "Excellent problem-solving, communication, and teamwork skills" | Blocks 3, 6 |

### Adjacent counts

Exact tool match is not the bar. Grade the capability, not the brand name.

| They ask for | Accept |
|---|---|
| CDK | Terraform, CloudFormation, Pulumi. He has deep Terraform. |
| GitLab MR pipeline | GitHub Actions, Jenkins, any CI he owned. Not in the JD any more anyway. |
| Container build | Docker, Kubernetes, ECR/ACR, any image built in a pipeline |
| AI-assisted code transformation | Any generated code that shipped. Codemod, scaffolding, template generator, migration script. |
| Asset library, promotion gates | Any artifact registry, module registry, or release gate he owned |

**The one thing to hold in your head.** The six AGT codes are not task areas, they're six agents. This role builds the agents that do the migration, plus the library and gates that decide whether what they emit can be trusted.

---

## 2. Who you're talking to

- ~20 months in AI-engineer roles. Duke Energy Nov 24 – Aug 25, R.E. Mason Nov 25 – now. Three-month gap between.
- GenAI work back to ~2023 at Boston Scientific, but in a data-science job.
- **~15 years professional, 9 of them manufacturing quality engineering.** IQ/OQ/PQ, design controls, CAPA, computer system validation, FDA QMS. He spent a decade deciding what evidence a thing needed before release. That is the governance half of this role in a different vocabulary. Test whether it transferred.
- Resume gives you his stack in exhaustive detail and nothing about what any project was for.
- SOP = Standard Operating Procedure. The step-by-step doc a plant operator follows. FDA cares what's in it. That's why his system has human approval attached.
- Nothing on the resume shows source-to-source code transformation. Closest is the Azure to AWS pipeline migration at Duke.

### What you're grading as "senior"

Not years, not tool breadth. Four things:

1. **He removes things.** Senior engineers delete capability. Mid engineers add it.
2. **Why, not what.** He remembers the fork and why he picked a side, not just the outcome.
3. **Blast radius, unprompted.** Asks what happens when it fails, not just whether it works.
4. **Disagrees, then commits.** He'd join an architecture he didn't choose. Can he say where he'd differ and still work inside it?

---

## 3. The call

### Block 1 · Open (0–2)

> Thanks for making time. I'm Triet, I work with Dexian on the technical side. This is a screen for the AI Engineer role on the tooling and governance side. I'll go deep on two or three things rather than run the whole resume, and I'll leave the last few minutes for you.

Don't name the AGT list. Once he knows the checklist you stop learning anything.

---

### Block 2 · What did you build (2–8) · group B

> I've got your resume in front of me and there's a few things listed at R.E. Mason. **Which one did you spend the most time on?**

> Okay. Before the tech, just tell me what it was for. **What was the problem?**

> And who was actually using it? **Is it live now?**

Then:

> Alright, so how'd you build it?

> **Walk me through what happens when someone asks it a question.** Start from them typing, take me to the answer coming back.

**Listen for** users named in plain language, a request traced end to end without hunting.
**Red flag** goes to the tech stack when you ask what it was for. Can't name a user. Doesn't know if it's live.

*What he picks is data. Reaching for the shiniest stack over the one he lived in tells you something before he answers.*

---

### Block 3 · How he decides (8–14) · groups B, E · seniority

> In that system, where did you draw the line between what the model decides and what your code decides?

> Give me something specific you took away from the model after it got something wrong.

Then the one that matters for a contractor:

> This role orchestrates its agents with a state machine, so the sequence is fixed and only the judgment inside each step is model-driven. **Does that match how you'd build it? What would you argue for instead?**

**Listen for** something he revoked from the model and why. Sequencing fixed, judgment loose. Reaches for repeatability, audit, or cost on his own. Disagrees clearly, then says he'd go along with it.
**Red flag** wants the orchestrator to be a planning agent. Treats determinism as a limitation. Never had to constrain a model. Or disagrees and can't let it go.

---

### Block 4 · How does it know it's right (14–22) · group A · the decider

> So before anyone actually looked at it, did the system have any way of telling whether what it produced was any good?

> Here's what I'm curious about. With a document, someone has to read it to know it's right. **If the agent had been writing code instead, would you check it differently?**

**You're listening for one word. Run.** Build it, compile it, run the tests, compare behavior to the old version.

- Gets there in a sentence, unled → 4
- Gets there after you offer it ("would you run it?") → 3
- Stays on judges, rubrics, DeepEval → 2
- "We had human review" is the whole story → 1

If he gets there, push: *and when there aren't any tests to run? What tells you it's fine then, and where does the doubtful stuff go?*

---

### Block 5 · When it goes wrong (22–28) · group C

> **Tell me about a time one of your agents did something you didn't expect. What did you change afterward?**

> If an agent is opening merge requests and provisioning infrastructure at a bank, where do you put the human and what do you let run unattended?

> There's an asset library here with promotion gates. What would you gate on, so something an agent generated is trusted enough for someone else to reuse?

**Listen for** a real incident with a diagnosis. The fix was structural, a gate in code or a permission or a cap. Not a prompt tweak. Separates reversible from irreversible on his own.
**Red flag** nothing unexpected ever happened. Or the fix was better instructions.

*This is where the quality-engineering decade shows up or doesn't. Watch whether a "gate" means an automated check that fails a build, or a signed approval and a document trail.*

---

### Block 6 · Quick coverage (28–32) · groups A, D, E

Say it out loud so it doesn't feel like an interrogation:

> Last few quick ones, mostly so I've got something to write down for Britni.

**A · code transformation** — the weakest area on his resume, so ask directly.

> Have you ever had a script or an agent write code that actually shipped? Doesn't have to be big. A codemod, a scaffolder, a migration script, generated config.

*Accept anything real. Listen for whether he checked its output or trusted it.*

**D · infrastructure** — the question is ownership, not the tool.

> Your Terraform at Duke. Did you own the modules other teams consumed, or were you consuming someone else's?

> And anything that built container images as part of a pipeline?

*Owner beats consumer by a mile. Terraform is fine, they wrote "or similar tools."*

**E · ways of working** — should be his strongest, given the FDA background.

> This runs on a gated cadence. Waves, a definition of done, quality gates somebody else owns. Have you worked somewhere that structured?

*FDA design controls are more rigid than any software gate. If he doesn't connect his own quality-engineering background here, that's worth noting.*

---

### Block 7 · Close (32–38)

His questions first. Then:

- Fully remote works? Any location constraint to flag?
- Earliest start, and what notice do you owe R.E. Mason?
- Anything else active that might move faster than this?

**No verdict.** Not warm, not cool. "Britni will follow up with next steps."

---

## 4. Reactions, any time he's talking

Don't fire prepared questions after he stops. Pull on what he just said.

| When he | Say |
|---|---|
| Says "we" for the third time | Which bit of that did you write yourself? |
| Names a router, supervisor, classifier | How does that decide? Model call or a rule? |
| Skips something in half a sentence | Back up a second. What was that one doing? |
| Names a framework | What's LangGraph actually giving you that you'd otherwise write? |
| Drops a number | What was it before? |
| Something sounds painful | That sounds like it was a pain. What made it a pain? |
| Answers stay abstract | What file would I open? What's in it? |
| Finishes clean, nothing fired | **What was the hardest call in there?** |

**Silence works.** Thin answer, wait three seconds before you say anything. He'll fill it.

**If it's running at 30 not 40:** drop Block 3 and move its state-machine question into Block 6. Keep 2, 4, 5, 6.

**If he's clearly thin by minute 10:** don't spend 25 more minutes proving it. Ask what he built end to end himself, what he could demo, where he'd need ramp-up. Close at 20. An early honest no serves Britni better than a padded 40.

---

## 5. Right after, while it's fresh

Four paragraphs, within the hour.

1. **What he's actually built.** The project, who used it, whether it's live, which parts were his.
2. **The verification answer.** Did he say run it, and how fast. This is the one that decides it.
3. **Senior or not, and why.** Against the four markers in section 2. Name the evidence, not the impression.
4. **Where the JD and the job diverge.** The JD's required quals are soft, no language, framework, scale or model platform named. The AGT work is not soft. Say whether he clears the written bar, whether he clears the real one, and what AWS's own interviewer would find the floor with.

Then a line per JD group, so she can map it:

```
A  Code transformation .......... [1-4]
B  Agent orchestration .......... [1-4]
C  Asset library + gates ........ [1-4]
D  Infra + container build ...... [1-4]
E  Ways of working .............. [1-4]
```

Gaps with context and a risk level. "No CDK" is useless to Britni. "Built orchestrator-worker agent systems, but every one emits prose rather than code, moderate risk, and the thing a second conversation should test" she can act on.

Verdict: advance / advance with reservations / do not advance.
