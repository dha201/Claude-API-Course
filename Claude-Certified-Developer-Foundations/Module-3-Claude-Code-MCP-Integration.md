# Module 3 — Claude Code, MCP & Integration

This lesson is Module 3 of the Developer Foundations track. The notes cover the whole module as exam-prep study material:

- 5 teaching sections — Permission Modes & Human Gates · Durable Project Context · Packaging Workflows · MCP Servers · Enterprise Integration — each with its frameworks and the failure ("Watch Out") lesson condensed
- All reference/decision tables reproduced verbatim: the permission-mode matrix, the durable-context mechanism map, the packaging decision table, the MCP setup reference, and the authentication & integration checklist
- Every checkpoint (1–6) with its answer, plus the two-part cumulative integration task with the printed model answers (bug ID + corrected files — the strongest exam material)
- All config snippets, CLI commands, and MCP client/server JSON kept exact
- Full glossary (9 terms) and the seven-takeaway recap

> **Claude Certified Developer – Foundations Prep Course** · Module 3 (Foundations track)
> Source: SCORM deck `Developer_M3_vF2.html`.
> Study notes — condensed frameworks, reference tables, failure cases, and self-check
> questions extracted from the module. 21 screens · 8 sections · 142 minutes · 8 checkpoints.
>
> **Exam-scope flags:** this module contains **no** [Partner Track] / not-tested markers and
> **no** on-blueprint domain-number tags. Everything here is in scope. Checkpoints 1–6 ship as
> interactive exercises with **no printed answer key**; their answers below are **[reconstructed]**
> strictly from the module's own frameworks and marked inline. The two cumulative-task answers
> **are** printed in the deck and are reproduced verbatim.

---

## Orientation — what this module makes you able to do

Modules 1–2 set up the API components: prompts, tool schemas, context engineering, agent loops, multimodal ingestion. Module 3 builds directly on that foundation. Claude Code runs the **same model in your terminal**, adding a permission layer, a configuration system, and team-sharing features; MCP enables secure integration with external services. The module teaches the engineering decisions that sit *around* a working integration — it does not re-teach the agent loop, tool schemas, or context engineering.

**"The build" — one recurring problem:** code that works *on your machine, in your session, in staging* must hold up when someone else runs it, in production, against real company systems. Each local convenience can become a failure once the work leaves your machine: a permission mode deletes a file that was never in scope; one rule gets buried under hundreds of lines; a skill points at a path that exists on no other machine; a committed key leaks within hours; a staging-only config step takes down the production connection. The work is learning **which configuration decision prevents which failure**, before it shows up in front of a teammate or an auditor.

**By the end you can:**

1. Run Claude Code through the **explore → plan → code** loop and pick a permission mode that matches the risk of the work, without granting more authority than the task needs.
2. Read AI-generated code with calibrated trust — act on reliable findings, verify unreliable ones, and place a human review gate where a wrong call is expensive.
3. Give Claude Code durable project context via **CLAUDE.md, rules files, hooks, and subagents**.
4. Package a workflow as **skills, custom commands, and a plugin** — author a skill once that runs across Claude Code, the Messages API, and the Agent SDK.
5. Build an **MCP server** exposing tools/resources/prompts, select the **transport** that matches how client and server communicate, and set the **scope** that controls who loads it.
6. Connect Claude to **enterprise systems**, authenticate with patterns a regulated customer accepts, and scope a code-modernization engagement that survives a security review.

*Educational content; illustrative/fictitious examples. Verify against Anthropic docs — products evolve.*

---

## 1. Permission Modes & Human Gates

**Core idea:** Claude Code runs the Module-2 agent loop in your terminal but adds a **permission system that gates every action** before it happens.

**How it works through a task — explore, plan, code.** It does not write immediately. It reads files and traces logic to build a picture first (**explore**); once it understands enough it proposes a **plan** (a structured description of intended edits); only after you approve does it enter the **code** phase and execute. This matters twice over: it produces better output (fewer assumptions, more downstream effects caught), and it is where the modes plug in — **plan mode holds Claude Code in the explore phase**, blocking all edits and shell commands until you release it. A useful default for unfamiliar or high-stakes work.

**Permission modes control how often Claude Code stops to ask.** Each trades speed against oversight; the right choice depends on how well you know the codebase and how reversible the changes are.

| Mode | What it auto-approves | What it still gates | Limitations |
|---|---|---|---|
| **default** | Reads only. Prompts before nearly every edit or command. | All file edits and shell commands require confirmation. | Safe but slow on trusted work. The baseline for any new project or unfamiliar codebase. |
| **acceptEdits** | Reads, file edits, and common filesystem commands (`mkdir`, `touch`, `rm`, `rmdir`, `mv`, `cp`, `sed`) inside the working directory. Auto-approval is scoped to paths inside the working directory; protected paths still prompt. | All other shell commands; writes outside the working directory; writes to protected paths. | Trusted local work where shell execution still needs a human eye. Not appropriate if the agent must run scripts. |
| **plan** | Reads only. Researches and proposes; makes no edits. | All file edits and shell commands until you approve a plan. | Exploration/planning on sensitive or unfamiliar codebases. Not appropriate for tasks that must write output. |
| **auto** | Everything, but a separate **classifier** reviews each action first and blocks anything that escalates beyond your request, targets unrecognized infrastructure, or appears driven by hostile/inappropriate content. | Production deploys and migrations, mass deletes, credential exfiltration, and force-push to main are blocked by default. | Reduces prompts but does not guarantee safety; a research preview, not a substitute for reviewing sensitive ops. Availability depends on plan, model version, and admin settings — verify before build. |
| **dontAsk** | Only tools you pre-approved in an allow rule, plus read-only commands. **Auto-DENIES everything else.** | Every tool call not on the allow list is denied. No queue for confirmation. | Built for locked-down CI and scripts. Restricts well, but not a way to reduce friction on local interactive work. |
| **bypassPermissions** | All tool calls. No confirmation prompts and no safety checks. | Nothing in normal operation. Standard checks bypassed; only catastrophic deletes (`rm -rf /`, `rm -rf ~`) still trigger a last-resort prompt. | Only inside an isolated container or VM where the environment is disposable. **Never** on a developer workstation against a live codebase. |

**Where the configuration lives and who it applies to:**

- **User level** (`~/.claude/settings.json`) — applies to every project on the machine. For preferences that follow you everywhere (e.g., a preferred default exploration mode).
- **Project level** (`.claude/settings.json`, committed to the repo) — applies to everyone who clones the repo. For team-wide conventions, allow rules for the project's tools, and deny rules for paths that should not be touched.
- **Local project level** (`.claude/settings.local.json`, auto git-ignored) — personal overrides for one project, not committed to the team.
- **Enterprise level** (`managed-settings.json`, set by administrators) — cannot be overridden by users or project files. For org-wide security controls (deny edits to env files, block specific shell commands across all projects).

**Allow/deny rules layer on top of the selected mode. A deny rule always wins over an allow rule, regardless of mode.** The most durable governance control is an **enterprise-level deny rule**: no individual developer can remove it, and it applies even under a bypass mode.

**Placing the review gate by worst-case cost.** Modes and deny rules decide what the agent does *without asking*; they don't decide where a *human* must still look. The question is the same one that separates a safe mode from a risky one: **what is the worst outcome if this action runs without a person checking it?** Lower cost → more you can let through; higher and harder-to-undo → more it needs a gate. Three placements follow (they apply whether the agent writes code or runs unattended, e.g. a bot that comments on/blocks a PR):

- **Let low-stakes, reversible actions through un-gated** (a formatting fix, an edit confined to the working directory). This is what `acceptEdits` is built for.
- **Gate any action hard to undo or reaching a sensitive path** — a write outside the working directory, a destructive shell command, an edit to a security-relevant/protected file. A **deny rule** enforces this deterministically; `default` or `plan` mode keeps the prompt in place while you decide.
- **Never let the agent be the only gate on a change to code your team has marked sensitive.** There the agent's work is an input to a human decision, not a replacement — a person reviews before merge no matter how confident the agent (or its own review) sounds.

The gate placement and the mode choice are the same decision from two sides: the mode sets the session default, the gate overrides it for the one action whose cost is too high.

> **⚠ Watch Out — "the bypass mode that removed the one prompt that mattered."** After three incident-free days of cleanup, the dev switched to `bypassPermissions` to stop the prompts ("just renaming old API endpoint references, nothing risky"). Claude matched pattern `/v1/legacy/` across **47 files in both `/src/` and `/deploy/config/prod/`**, ran a post-rename `cleanup.sh`, and deleted 3 production config files (environment-specific endpoint overrides) that were never in scope. In `default`/`acceptEdits` the script invocation would have prompted first. **Precise location of the gate:** it was the **script invocation** that would have prompted, not `rm` itself — `acceptEdits` auto-approves `rm` on paths inside the working directory, so direct `rm` commands would have gone through silently; only `default` prompts for those. **Rule:** a bypass silences *all* prompts, including ones you didn't anticipate, and also drops the protected-path guard. Set a deny rule on sensitive dirs *before* switching; for fewer prompts without losing the net, use a classifier-gated mode (`auto`) instead of a full bypass.

**Cost · Complexity · Risk:** *Cost* — `default` on trusted work adds prompt latency to every tool call, which accumulates on a long refactor. *Complexity* — multiple settings levels with an override hierarchy require consistent care; an enterprise deny rule contradicting a project allow rule must be understood by everyone maintaining the config. *Risk* — using the wrong mode for the context; a bypass mode set out of impatience on a non-isolated machine removes every safety prompt **and** the protected-path guard the other modes keep.

> **Checkpoint 1 — assemble the settings file and place the human gate** *(configuring Claude Code for a trusted local refactor of the payments module: auto-approve file edits, never run destructive shell commands, and `.env.production` must never be readable).*
>
> **Part 1 — select two `settings.json` pieces:**
> - Piece A. `{ "permissions": { "defaultMode": "default"} }`
> - Piece B. `{ "permissions": { "defaultMode": "bypassPermissions" } }`
> - Piece C. `{ "permissions": { "allow": ["Bash(npm run:*)"], "deny": ["Bash(rm:*)", "Bash(git push:*)"] } }`
> - Piece D. `{ "permissions": { "deny": ["Read(.env.production)"] } }`
> - Piece E. `{ "permissions": { "allow": ["Bash(*)", "Edit(*)"] } }`
>
> **[reconstructed]** answer: **C and D.** C allows the build command while **denying the destructive shell commands** (`rm`, `git push`); D **denies reads of `.env.production`**. B (bypass) and E (allow `Bash(*)`) both defeat the "never destructive shell" constraint and drop the protected-path guard; A (default) does not auto-approve edits. The deny rules satisfy the two hard constraints regardless of mode, since a deny always wins.
>
> **Part 2 —** during the refactor the agent proposes a change to a deployment config file that several production services read; where does the human gate sit? **[reconstructed]** answer: **(b)** — a human reviews and approves the change *before the write executes*, because a wrong value there is hard to undo and reaches systems outside the file. (a) lets a high-cost action through un-gated; (c) removes all pauses; (d) reviews too late.

---

## 2. Durable Project Context

**Core idea:** the permission layer controls what the agent *may do*; this layer controls what the agent *knows and how it behaves*, so rules defined in one session are still in effect at the start of the next.

**CLAUDE.md — the project file that loads into every session.** Claude Code reads `CLAUDE.md` at the project root on every start and **prepends its contents to your prompt before any message arrives**. Every convention, constraint, and command in it is present from the first prompt of every session without restating. `/init` scans the codebase and generates a starter file — a good baseline, **validate before using**; refine it to hold the rules that control outcomes (testing commands, framework conventions, paths not to touch, style decisions that differ from defaults). **Size is the main failure mode:** a growing file dilutes the rules that matter, consumes context window, and shrinks any single instruction's share. Hold it to constraints that change behavior; move everything else into Skills that load on demand.

**Rules instruction files — scoping guidance to where it applies.** CLAUDE.md is always on; rules files add a narrower layer. They live in `.claude/rules/` and can be scoped to specific paths via a `paths` glob in **YAML frontmatter** — a scoped rule enters context only when Claude works with matching files. **Scoping comes from the frontmatter, not file placement:** subdirectories (e.g. `.claude/rules/database/`) are organizational only; a rules file *without* a `paths` field loads unconditionally at launch with the same priority as CLAUDE.md, wherever it sits. Put broad memory and universal constraints in CLAUDE.md ("never modify the database schema"); put narrow, path-specific guidance in a rules file ("all SQL in the database module must include an explicit transaction boundary") scoped like:

```yaml
---
paths:
 - "src/db/**/*.sql"
---
```

**Hooks — running your own scripts at fixed points in the lifecycle.** A hook intercepts and controls tool calls before/after they execute. A CLAUDE.md instruction ("run Prettier after every edit") is followed *most* of the time; a hook makes it happen **every single time**, because it fires independently of what the model decides. Hooks are defined in settings files and configured via `/hooks`. Each binds a **lifecycle event**, an optional **matcher** (scopes it to tool types), and a **command**:

- **PreToolUse** — runs *before* a tool call. Can examine the call and **exit with code 2 to block it**, writing the reason to stderr as feedback the agent sees. This is how you enforce access controls at the config layer rather than hoping the agent respects a CLAUDE.md line.
- **PostToolUse** — runs *after* a call completes; cannot block. Right place for automated side effects: formatter after an edit, tests after a change, logging for an audit trail.
- **UserPromptSubmit** — runs when you submit a prompt, before the model processes it. Inject context or validate the request before work starts.
- **Stop** — runs when the model finishes responding. Follow-up actions at end of turn: notifications, cleanup, committing the audit log.
- **Notification** — runs when Claude Code sends a notification (needs permission for a tool, or has been idle 60 seconds). Route signals to an external channel/logging system.
- **SessionStart** — runs when a session starts/resumes. Initialize state, validate env vars, confirm required services are reachable before work begins.
- **SessionEnd** — runs when a session ends. Teardown, final audit writes, closure notifications.

A PreToolUse hook that blocks edits to a production config path enforces that constraint at **every tool call during every session, regardless of permission mode**. That is the difference between a guardrail and a convention.

**Subagents — delegating work to an isolated context.** A subagent runs a task in its own separate context and returns only its output. It **does not inherit** your conversation history, accumulated files, or session state — it starts from a clean slate, does the work, hands back the result. The built-in subagents differ in what they load, which determines how your project rules apply (**always check the current list in the docs**; the specific split holds across versions): **Explore and Plan skip CLAUDE.md and git status** to keep research fast, so project-level rules and repo state are *not* in their context; the **general-purpose** subagent loads both. For tasks where project constraints must be respected, use general-purpose or a custom subagent that explicitly loads the rules it needs. **Custom subagents also do not automatically see your skills** — a custom subagent in `.claude/agents` needing a skill must list it in the agent's front matter; built-in agents have no preloaded skills, so skill-backed behavior requires a custom subagent.

**Durable-context mechanism map** — decide which mechanism carries a piece of project knowledge (each trades context cost against reliability):

| Mechanism | What it loads | When it runs | Context cost | Belongs here |
|---|---|---|---|---|
| **CLAUDE.md** | Full file contents prepended to context at session start. | Every session, unconditionally. | Persistent per session. Dilutes with size. | Universal project constraints, commands, and framework decisions. |
| **Rules file** | File contents. Scoped via a `paths` glob in YAML frontmatter; without `paths`, loads like CLAUDE.md. | When Claude reads a file matching the rule's `paths` patterns. Unscoped rules load at session start. | Path-scoped: adds to context only when triggered. Unscoped: same persistent cost as CLAUDE.md. | Path-specific guidance that would be noise everywhere else. |
| **Hook** | Runs your script at the lifecycle event. No content added to context. | At the configured event (PreToolUse, PostToolUse, etc.). | Minimal: only the script output if routed back to Claude. | Enforced guardrails, automated side effects, audit logging. |
| **Subagent** | Task context only. Isolated from the main session. | When dispatched by the main session for a delegated task. | Returns a summary, not the full task history. | Exploration, investigation, and tasks whose output would otherwise bloat the main context. Also tasks that can be broken down and parallelized. |

*Handles well:* projects you return to across many sessions, where a stable rule set, per-directory variation, or unconditional guardrails repay the setup. *Use a different approach:* one-off tasks you won't revisit — for a quick exploration of an unfamiliar codebase the setup overhead isn't warranted.

> **⚠ Watch Out — "the CLAUDE.md that kept growing until the rules stopped landing."** Over two months of team additions the file reached **847 lines** (framework prefs 1–40, testing 41–90, style 91–210, dependency rules 211–320, path restrictions 321–360, **historical decisions log 361–700, archived notes 701–847**). The prompt said "refactor the auth module… **do not modify `/legacy/tokens/`**." The path restriction sat at **line 347** — but the agent read and **edited `/legacy/tokens/store.ts`** anyway. The rule was present and accessible; the failure was **dilution** — 846 other lines reduced the effective weight of the one instruction that mattered. **Rule:** CLAUDE.md is a working set of rules that change behavior *now*, not a growing append log. Path-specific → a rules file. Historical context → a separate reference doc read on demand. Past a few hundred lines, audit it. The one rule you cannot afford to dilute should be the shortest path to a hook.

> **Checkpoint 2 — drag the correct value** *(a hook that enforces a path restriction; two blanks):*
> ```json
> {
>  "hooks": {
>   "________": [
>    {
>     "matcher": "Read",
>     "hooks": [{ "type": "command", "command": "________" }]
>    }
>   ]
>  }
> }
> ```
> **[reconstructed]** answers: **Blank 1 = `PreToolUse`** (the event that runs *before* a tool call, so it can block the read). **Blank 2 = "a script that reads the tool call from stdin, checks the file path, and exits with code 2 when the path is `.env.production` (writing the reason to stderr)"** — only exit code 2 blocks; a script that merely logs (PostToolUse-style) or warns and exits 0 cannot stop the read.

---

## 3. Packaging Workflows

**Core idea:** the mechanisms above live in `.claude/` and are version-controlled with the project. Packaging lets a teammate **install the whole setup in one step** instead of repeating your manual configuration.

**Skills are reusable workflows the agent loads on demand.** A skill is a portable Markdown file (`SKILL.md`) in `.claude/skills`. The **front matter identifies the skill and describes when it applies**; the body holds the steps. The same skill can run in Claude Code, be invoked through the Messages API, or be loaded by the Agent SDK. What changes across the three is not the file — it's **where it runs, how it loads, and what it may touch:**

| Runtime | How the skill loads | Where steps run | What you need to know |
|---|---|---|---|
| **Claude Code** | Discovered from `.claude/skills` on the filesystem. Loads on a description match or when invoked by name. | Your terminal session, against your local files, under the active permission mode and deny rules. | Filesystem-based; governed by the settings layer. |
| **Messages API** | Sent along with the request and run inside the **code execution container**, not your app's environment. Requires **code-execution and skills beta headers**. | Inside Anthropic's code execution container, not your machine. Filesystem/tool access is whatever the container provides. | A skill assuming local files or local tools won't behave the same — it isn't running where those files are. |
| **Agent SDK** | Loaded by the agent the SDK runs, but whether filesystem settings (CLAUDE.md, skills) load is controlled by **`settingSources`** (TS) / **`setting_sources`** (Python). Do not rely on a default — set it explicitly; confirm current default behavior against the SDK reference at build time. | In the process the SDK runs (your environment), once you've told it to load filesystem sources. | Common surprise: a skill that worked in Claude Code does nothing under the SDK because `settingSources` was never set, so it never loaded. |
| **Claude Managed Agents** | Defined once as an API resource that names model, system prompt, tools, MCP servers, and skills. Anthropic loads it **server-side**; no filesystem discovery on your side. | Inside a sandbox Anthropic provisions and runs, not your environment. Your app sends user events and reads streamed results. | Public beta requiring the **`managed-agents-2026-04-01`** beta header; sessions stored server-side, so **not currently eligible for Zero Data Retention or HIPAA BAA**. Skills attach when defining the agent resource, not at session time — update the definition to change which skills are available. |

**Three portability rules:**

- **Write the description as the matching criterion** — the model loads a skill by comparing your request to its description, so a description that identifies *when* the skill applies works in every runtime; a vague one fails to load in all of them.
- **Don't assume a local filesystem or local tools exist inside the skill body** — a skill that shells out to a local command works in Claude Code but breaks on the Messages API (a container without that command). Confine steps to what the runtime guarantees, or document the dependency.
- **Subagents don't inherit skills** — a subagent starts clean, so a skill the parent relied on must be listed for the subagent explicitly, in every runtime that supports subagents.

*You can author a skill once, but "runs everywhere" is something you design for.* A skill scoped to a clear description and free of local-environment assumptions ports cleanly; one that assumes a specific local environment does not.

| Handles well | Adds complexity | Use a different approach |
|---|---|---|
| A task-specific procedure authored once and reused across the interactive terminal, an API integration, and a headless SDK job. | Each runtime loads and sandboxes the skill differently, so you must account for beta headers on the API and `settingSources` on the SDK. | For instructions that must apply to every session in a project, CLAUDE.md is still the right tool. Skills are for on-demand, portable procedures. |

**Custom commands — an explicit entry point.** A custom command is a shortcut for a defined procedure. In current Claude Code, **skills are the recommended format** for both explicit and automatic invocation: invoke a skill directly with `/skill-name`, or Claude loads it automatically when relevant. The older `.claude/commands/` directory format still works but is **legacy**. Use `disable-model-invocation: true` in the frontmatter for a workflow that only runs when you explicitly call it. **Plugin commands are namespaced automatically:** the plugin's name becomes the prefix, so a `run-tests` command in a plugin named `payments` is invoked as `/payments:run-tests` — this is why two plugins can both ship `run-tests` without colliding. Treat the plugin name as part of the interface; renaming the plugin renames every command.

**Plugins — the packaging layer that makes a setup installable.** A plugin bundles **skills, hooks, subagents, and MCP servers** into a single installable unit, distributed through a **marketplace** (a catalog of plugins). The official Anthropic marketplace is available automatically; add third-party marketplaces hosted in a GitHub repo with `/plugin marketplace add <owner/repo>`. Teammates then run one install command to get the same setup — the plugin replaces a page of manual steps with a **versioned, auditable install**. Placement: **skills go in a skills directory; hooks, subagents, and settings go in their respective locations.** The plugin manifest describes the bundle; the install command wires it in. Plugins download at individual or enterprise-wide level.

**Enterprise admins** deploy plugins org-wide through managed settings. A **managed marketplace allowlist** gates which marketplace sources users may add — but the allowlist *restricts* what users can add, it does **not** register marketplaces automatically. To push a marketplace to all users without them running `add`, pair the allowlist with **`extraKnownMarketplaces`** in managed settings. Because managed settings sit above user and project settings, a plugin deployed at managed scope takes priority and cannot be overridden. *(Verify exact setting names against the reference.)*

**Packaging decision table:**

| Layer | What it is | Who it is for | When to reach for it |
|---|---|---|---|
| **Skill** | A Markdown file in `.claude/skills` that loads when its description matches the task or when invoked by name. | An individual developer or team using Claude Code interactively. | When a task-specific procedure should stay out of context until needed (a PR review, a deployment checklist that only loads when the work calls for it). |
| **Custom command** | A named shortcut that runs a defined procedure when you invoke it explicitly. | Developers who want a predictable, explicit entry point for high-frequency procedures. | When the procedure has a clear name and you want to trigger it directly rather than relying on description matching. |
| **Plugin** | A versioned bundle of skills, hooks, subagents, and MCP servers distributed through a marketplace. | A team that wants one-step installation of a shared, versioned setup. | When a working setup lives on one machine and needs to be shared, versioned, and kept consistent across a team. |

**Cost · Complexity · Risk:** *Cost* — skills add context cost on activation; a plugin adds install/maintenance overhead. Pay the setup cost once (plugin install) or repeatedly (every developer runs the manual steps). *Complexity* — a plugin that hard-codes absolute paths installs correctly for the author and fails for everyone else; any path or environment assumption baked into a skill or hook command is the thing most likely to break across machines. *Risk* — a plugin carries only the components it bundles; a deny rule or hook the author relied on locally is **not included unless explicitly listed**, so a guardrail the skills depend on does not carry over.

> **Checkpoint 3 — place the skill in the right runtime** *(four teams reuse the same review-checklist skill):* **[reconstructed]** matches (each option maps one-to-one):
> - **Load when asked for a review in the Claude Code terminal** → Place `SKILL.md` in `.claude/skills` with a description that matches review requests.
> - **A service calls the Messages API** → Send the code-execution and skills beta headers and write the skill so its steps don't depend on local files or local tools.
> - **A scheduled headless job uses the Agent SDK** → Enable filesystem sources by setting `settingSources` explicitly (don't rely on a default; confirm current default against the SDK reference at build time).
> - **A product team wants it inside a long-running Anthropic-hosted agent, reachable by agent ID across sessions** → Define the agent as an API resource that lists the skill and set the `managed-agents-2026-04-01` beta header; write the skill so it doesn't depend on local files (it runs in Anthropic's sandbox).

> **⚠ Watch Out — "the plugin that installed on your machine and failed on everyone else's."** A clean install tells you the package was *assembled* correctly, not that it will *run* — install copies files; execution resolves the paths/variables they point at against the running machine. A dev built a deployment-workflow skill, packaged it as a plugin, tested locally (passed), shipped via the internal marketplace; every teammate's **install succeeded but every run failed**. Root cause: the `SKILL.md` carried an absolute path `/Users/alexmorgan/projects/deploy-utils/validate.sh` — a directory that existed only on the author's machine. A second skill leaned on an env var `DEPLOY_TOKEN` set in the author's shell profile and never mentioned in the README; **three teammates spent two hours** tracing it. The absolute path sits in the file as plain text a reviewer can catch; the env var is worse — nothing in the package announces the dependency, so the skill runs fine until the step that needs it. **Rule:** any path in a skill/hook command/plugin component must be relative to the project root or use an env var for the base path — use **`$CLAUDE_PROJECT_DIR`** for scripts stored in the project and **`${CLAUDE_PLUGIN_ROOT}`** for scripts bundled in the plugin. Bundle (or share) every asset the plugin depends on; document and **validate every required env var at install time**; test the install on a clean machine before distribution.

> **Checkpoint 4 — fix the broken plugin definition:**
> ```
> ---
> name: deploy-validate
> description: Validates a deployment configuration before release.
> ---
> ## Steps
> 1. Run the validation script: /Users/alexmorgan/projects/deploy-utils/validate.sh
> 2. If the script exits with a non-zero code, report the error to the developer.
> 3. If validation passes, confirm the deployment configuration is safe to proceed.
> ```
> **[reconstructed]** — **Part 1 (defect): C** — the absolute path `/Users/alexmorgan/projects/deploy-utils/validate.sh` in step 1 (exists only on the author's machine). **Part 2 (fix): C** — reference the script from the project root using `$CLAUDE_PROJECT_DIR`, so it resolves no matter where the project is cloned. (A/B keep a machine-specific path; D removes the skill's purpose.)

---

## 4. MCP Servers

**Core idea:** an MCP server is the layer that **exposes tools to Claude from outside your codebase**. When you wire a tool directly, the schema and logic live in that app's code, and three apps needing the same service each maintain their own integration. **Model Context Protocol (MCP)** separates tool definitions from individual applications and turns them into a **server** — build the capability once, and every MCP client that connects gets access without re-implementing it. Claude Code has a **built-in MCP client**; on connect it discovers the server's tools and can invoke them during a session.

**MCP servers expose tools, resources, and prompts:**

- A **resource** is **read-only data the server exposes for the client to fetch and place into context directly**, rather than the model calling a tool. The client requests it by address; the server returns the data. Two forms: a **direct resource** has a fixed address for data taking no parameters (e.g. a list of available documents); a **templated resource** puts a parameter in the address (e.g. a document address taking a document identifier). Reach for a resource when you want known data in context from the start of a turn and pulling it in directly is cheaper/more predictable than a tool call. *Resource support varies across clients — verify your client can inject resources before relying on this.*
- A **prompt** is a **pre-written instruction template the server exposes** so a client can invoke a vetted prompt by name instead of each user writing their own. Useful when specific wording produces materially better results than what a user would type, and you want every client to get the same quality — maintained in one place, reused everywhere the server connects.

**Transport — how Claude Code talks to the server** (the communication channel; the right one depends on where the server runs):

| Transport | What it is / when to use |
|---|---|
| **stdio** | Runs the server as a **local process on the same machine** as the client; the client launches it as a subprocess and communicates over standard input/output. Correct for a local tool, personal script, or a dev server on your own machine. Does **not** work for a server shared across a team or hosted remotely. |
| **HTTP** | The **recommended transport for any server that does not run locally.** Connects over a standard HTTP connection; supports servers on a different machine. You register it by providing the URL and the client connects over the network. Shared team servers and hosted integrations use HTTP. |
| **SSE** (Server-Sent Events) | An older transport that **predates and has been superseded by HTTP; no longer recommended for new servers.** If you encounter it in existing config/docs, treat it as legacy. |

**Context cost.** Each connected MCP server contributes tool definitions that would occupy the context window if loaded upfront. By default Claude Code **defers** these and uses a **search step** to discover and load only the relevant tools when a task calls for them — only the tools called for enter context. An **opt-in mode** loads tool definitions upfront when they fit within **roughly 10% of the context window**, deferring only when that limit is exceeded. Either way, connect only the servers you need — every connected server adds to the pool of definitions the model must account for.

**Prompt caching — paying once for reusable requests.** Every request reprocesses its input from scratch, including parts identical to the last request. Caching stores the processing done on a **stable prefix** so a follow-up reuses it. The first request writes the prefix; follow-ups sending identical content up to the same point read it at a fraction of the cost. **Content must match exactly** — one changed character before the cache point invalidates it and forces a fresh write. Strongest candidates: a long system prompt, a large set of tool definitions, a reference document you ask several questions about. You turn it on by **marking a cache breakpoint** (there is no global on-switch): in the Messages API add a `cache_control` field of type `ephemeral` to the last block you want cached — this caches everything up to and including that block. **Up to four breakpoints.** The request is processed in a fixed order of **tools, system prompt, messages**, so a breakpoint after the tools caches the tool definitions while keeping the messages dynamic. **Lifetime:** default **5 minutes from the last read** (each read resets the clock — suits back-and-forth every few minutes); an opt-in **1-hour** lifetime via `ttl: 1h` on the breakpoint suits longer gaps (an agent pausing between steps). If the window expires first you pay the write cost again for no read benefit. **Caching only applies above a minimum token threshold (1,024 tokens for most current models)** — short prompts won't cache even with a breakpoint.

**Retrieval-augmented generation (RAG) — pulling in only the knowledge a request needs.** A model reads everything in its context window every request, so loading more docs up front leaves less room for the work. RAG stores the material outside the context window, finds the parts most relevant to the request, and supplies only those. Two forms:

- **Classical RAG** does the hard work upfront: source material is split into chunks, each chunk converted into an **embedding** (numbers capturing its meaning) stored in a database; a question is converted the same way, and the most similar chunks are retrieved. *(Like a librarian who read every book before opening and pulls the right summary cards instantly.)*
- **Agentic search** skips the upfront indexing — no pre-built database; the model figures out what it needs the moment you ask, then fetches it: searching live sources, reading documents on demand. *(Like a researcher who goes and finds the answer.)* You've likely seen it already: Claude Code discovering/loading only the MCP tools it needs; Claude.ai Projects surfacing only the most relevant document sections when the knowledge base outgrows the active window.

Both find a relevant slice and generate from it; the difference is **timing** — classical matches against an index built in advance, agentic searches at the moment of need. Two properties: **it scales** (as source material grows, per-request cost stays flat — a question pulls back roughly the same amount of text whether the base holds ten docs or thousands); **it's only as good as what it finds** (if retrieval misses the doc, the model never sees it — so organization matters: descriptive filenames like "Q3 refund policy, updated August 2024" beat "notes_final_v3.pdf"; grouping related files helps).

**Configuration scope — who loads the server** (each scope corresponds to a config location):

- **Local scope** — stores config in `~/.claude.json` under the current project's path. Applies only to the project you're in; not shared. For a server tied to one project you're not ready to commit, or tooling that only makes sense there.
- **User scope** — stores config in your personal Claude settings, available across all your projects. Still personal (teammates don't see it, not in the repo). For a personal utility you use in every project (a local DB tool, a script you rely on regardless of codebase).
- **Project scope** — writes config to a **`.mcp.json` at the repo root**. Committed to version control → everyone who clones gets the server automatically. For a server the whole team can access. Note: a project-scoped server **runs from each teammate's machine** — for a stdio server, the committed config stores the launch command and every clone spawns its own local subprocess, so each teammate needs the runtime (e.g. Node for an `npx`-launched server) installed locally.
- **Enterprise scope** — deploys through a centrally managed configuration controlled by an administrator; admins push servers to all users without individual config steps. For shared internal services, security tooling, or any server that must be present across the org.

**Permission rules that target a single MCP tool, not the whole server.** Connecting a server exposes its full tool list, but you rarely want the agent reaching every tool without checking. An MCP tool is identified in a permission rule by **`mcp__server__tool`**. An allow rule on `mcp__github__create_issue` lets that one tool run without a prompt while every other GitHub tool still prompts; a deny rule on a write-capable tool blocks it while read-only tools stay available. **A deny on one tool overrides an allow on the server.** The **API MCP connector** adds another control: an `mcp_toolset` object lets you set an **`enabled`** flag per tool — register a server but expose only the tools you want the model to *see*. A permission rule decides whether an exposed tool may *run* (governance); the enabled flag decides whether the model *sees* it at all (context-cost & scope). Often used together. *Verify exact rule syntax and the connector beta header against the docs before publishing.*

**The GitHub MCP server — a concrete example.** A remote server maintained by GitHub exposing tools for repository management (review PRs, open issues, search code, more). It uses **HTTP transport** because it's hosted remotely; you register it by URL and the client connects over the network. **Scope:** project when the whole team needs the same repo tooling, local when only you need it. **Authentication uses a Personal Access Token** — generate it in GitHub, pass it as a **Bearer token in the request header** of your MCP config. The token **must be supplied through an environment variable and referenced in the config file**; it must **not** be committed inline to `.mcp.json`, because a token written directly into a committed file enters repository history and cannot be removed by overwriting the file in a later commit.

**OAuth** is a different mechanism, used by servers that authenticate individual users through a browser-based sign-in flow (**Linear** is an example). On first connect, the client redirects to the service's sign-in page; after you approve, a token is issued and stored automatically — no credential copied or managed by hand. OAuth is right for any integration where the service's authorization is tied to user identity. *GitHub MCP uses a service credential you generate and store; Linear MCP initiates a sign-in flow that handles the credential for you. Both are remote HTTP servers following the same transport and scope logic — the authentication step is what differs.*

**MCP setup reference:**

| Context | Transport | Scope | Config location | Secrets handling |
|---|---|---|---|---|
| Personal local tool (runs on your machine only) | stdio | Local | `~/.claude.json` (per-project entry) | Environment variables only. Never in config file. |
| Shared team server (all teammates connect to same service) | HTTP | Project (`.mcp.json`) | `.mcp.json` committed to repo root | OAuth or env variables. API keys must never be committed to `.mcp.json`. |
| Personal experiment (not ready to share) | stdio or HTTP | Local | Personal Claude settings | Environment variables only. |
| Organization-wide deployment (admin-managed) | HTTP | Enterprise | Managed settings (admin-controlled) | Secrets managed by administrator. Config locked to prevent override. |

**Cost · Complexity · Risk:** *Cost* — each connected server adds its tool definitions to the context window; the more servers, the larger every request. Load only what a task needs. *Complexity* — transport and scope are independent but interact: a stdio server cannot be project-scoped for sharing because it runs on one machine. Match transport to where the server runs *before* choosing scope. *Risk* — **committing an API key inside `.mcp.json` is the most common mistake in this section**; the key travels into repository history where rotating later is not enough to remove the exposure. Secrets go in env variables; the config file holds only the server address.

*Handles well:* a reusable integration used across sessions and shared with the team, stable enough to maintain as a separate process (the GitHub server). *Adds cost/complexity:* teams not managing env secrets carefully — more servers means more places a secret can be mishandled, concentrated on the committed `.mcp.json`. *Use a different approach:* a one-off task where the tool logic can live in the codebase and needs no reuse — for a single-project integration used by one person, wiring the tool directly may be simpler.

> **⚠ Watch Out — "the API key that traveled with the configuration file into the repository."** A dev connected to a data-warehouse MCP server with a service-account API key, put the key **directly in `.mcp.json`** to get it working fast, planning to move it to an env var before sharing — then committed `.mcp.json` so teammates could clone and connect. Within 48 hours the key was in **four places**: the local machine, repository history, three teammate machines, and the CI runner's filesystem. The dev moved the key to an env var and committed the corrected file — but the key was still in commit history, so the service account had to be **rotated**, which broke two external services configured with the same key (three hours to fix). Corrected `.mcp.json` uses an env-variable reference:
> ```json
> // Before (do not use)
> { "type": "http", "url": "https://warehouse.internal/mcp",
>   "headers": { "Authorization": "Bearer sk-abc123..." } }   // inline credential
> ```
> ```json
> // After (correct)
> { "type": "http", "url": "https://warehouse.internal/mcp",
>   "headers": { "Authorization": "Bearer ${WAREHOUSE_MCP_TOKEN}" } }   // env variable reference
> ```
> **Rule:** API keys committed to a config file are committed to repository history; overwriting in a later commit removes them from the current version but not from history — any inline credential in a committed file must be treated as **compromised and rotated**. Prevent it with **two layers**: (1) a CLAUDE.md convention that credential values must never be written inline to `.mcp.json`; (2) a **PreToolUse hook** that inspects writes/edits to `.mcp.json` for inline-credential patterns and exits with a blocking code. The instruction communicates intent; the hook enforces it deterministically.

> **Checkpoint 5 — match transport and scope to each deployment scenario:** **[reconstructed]**
> - **A local SQLite query tool used only on your dev machine** → **stdio + Local.**
> - **A code-search service on your company's infra the whole engineering team should access** → **HTTP + Project (`.mcp.json`).**
> - **An experimental web-scraping server tested this week against one repo, not ready to share** → **stdio or HTTP + Local.**
> - **A security-scanning server IT needs on every developer's Claude Code installation** → **HTTP + Enterprise (managed settings).**

---

## 5. Enterprise Integration

**Core idea:** for a team-only internal server the GitHub personal-access-token pattern covers authentication. What changes in a **regulated environment** is that identity, secret-handling, and data-residency questions a prototype ignores become **requirements the production deployment must answer**.

**Why enterprise integration differs from a working prototype.** A prototype answers one question: *does the connection work?* A production enterprise integration must also answer: **Who is the model acting as, and is that identity auditable? What data can it access, and where does that data leave the org? Can an administrator lock the config so no individual developer can change the auth setup? Can access be logged well enough to satisfy a compliance audit?** These are the same identity/access/compliance requirements that apply to any external system touching regulated data — treating them as part of the integration design is what separates a demo from something deployment-ready.

**Authentication patterns by service type:**

| Service type | Pattern |
|---|---|
| **Remote services with user identity** | Use **OAuth.** The MCP server returns **401 Unauthorized** to signal auth is required; the client initiates a browser-based sign-in; after the user approves, a token is issued and stored. No secret copied by hand. The expected pattern for cloud services, SaaS tools, and any integration where the user's identity is part of the authorization model (Linear MCP). |
| **Remote services with service identity** | Use an **API key passed through an environment variable.** The key identifies the service account and **must never be committed** to a config file — it lives in the environment at execution time. For a CI pipeline using the Agent SDK, the key is injected as a secret by the pipeline runner, not baked into the code. |
| **Local services with file-system access** | **stdio transport with no network authentication.** The security boundary is the **file-system permission model**; a **deny rule** in the settings files is the governance layer. |

**Managing the secret after authentication — storage, rotation, separation from config.** Choosing the auth pattern establishes the connection; keeping it is a separate problem. The earlier MCP key leak was not a bad choice of auth method — it was a credential that **lived in the wrong place and could not be cleaned up once it spread**. Three practices, each addressing a specific exposure:

1. **Separation** — a credential never travels with the config that references it. The file holds a **variable reference**; the value lives somewhere the file does not. Config files get committed, shared, and cloned; an inline value rides along with every copy and enters repository history in a way overwriting does not remove. Keep the value out of the file and the file stays safe to share.
2. **Where the value goes** — for a value that lives on one machine or in one pipeline run, an **environment variable injected at execution time** is enough (the CI runner sets it as a secret; nothing written to disk). For a value several services/people need, a **secret store** is better: a managed service that holds credentials, returns them to authorized callers at runtime, and records who read what — it centralizes the value so a **single rotation updates every consumer at once** and removes the scattered per-service copies. Env variable when local and short-lived; secret store when shared or must be audited.
3. **Rotation** — replacing a credential on a schedule and immediately after any suspected exposure. **Rotation is the only appropriate response to a leaked key** — an exposed key cannot be made secret again. This is why inline credentials are so costly: a value baked into committed code cannot be rotated cleanly (the old value stays in history and every hardcoded consumer breaks on change). A credential read from a secret store or env variable rotates without touching the code that uses it, because the code references it by name and the name doesn't change.

Two habits make rotation cheaper: **scope each credential to the narrowest access its task needs** (a leaked key reaches only what that integration required), and **keep a record of which services use each credential** (so a rotation doesn't surface its consumers by breaking them).

**What regulated industries add on top of working authentication.** A financial-services or healthcare customer asks where data is processed, how access is logged, and whether an admin can lock the config during an audit window:

- **Enterprise managed configuration** answers the lock question — an admin-deployed server config that users cannot override means the auth setup is consistent across the org and does not depend on each developer's settings file.
- **Audit hooks** answer the logging question — a **PostToolUse hook that logs every tool call and its parameters to an audit store** provides the record a compliance review needs; it fires deterministically for every call regardless of what the model decides, and the log is not something the model can skip.
- **Data residency** answers the processing question — a server configured with an **HTTP endpoint in a specific region**, combined with a platform deployment that **pins processing to that region**, gives a compliance reviewer a checkable answer to where data goes.

**Code modernization — applying the full module to legacy change.** A useful test case because it concentrates the risks each tool manages: large-scale changes to an unfamiliar legacy codebase carry high blast radius, unpredictable dependencies, and limited reversibility. The **explore/plan/code loop** is the core workflow: **plan mode** holds the agent in read-only explore while you review proposed edits, spot anything touching unexpected paths, and push back before a file is modified. **Hooks** enforce guardrails preventing edits to specific paths during the most sensitive phases. **CLAUDE.md** carries the target patterns so the agent applies them consistently rather than drifting back to the legacy patterns it reads around it. A responsible scoping approach addresses three questions **before the session starts**:

- **Blast radius** — which systems depend on the code being changed, and what breaks downstream if an edit is wrong?
- **How changes are audited** — is there a PostToolUse hook logging every tool call, and does that log satisfy whoever must review what the agent touched?
- **Who approves each phase before the next begins** — plan mode enforces the explore/execute boundary, but the approval decision itself is yours to define and document before work begins.

These apply to **any high-risk agentic task**; modernization just surfaces them clearly.

**Authentication and integration checklist:**

| Service type | Auth method | Where secrets live | What gets logged | Who can lock the config |
|---|---|---|---|---|
| Remote with user identity (SaaS, cloud) | OAuth | Token issued by OAuth provider and stored by client. | PostToolUse hook to audit log. | Administrator via enterprise managed settings. |
| Remote with service identity (internal API) | API key in environment variable | Environment only. Never in committed config. | PostToolUse hook to audit log. | Administrator via enterprise managed settings. |
| Local (file system, local DB) | File-system permissions | No credential needed. Deny rules enforce path access. | PostToolUse hook to audit log. | Deny rules in enterprise managed settings. |

**Cost · Complexity · Risk:** *Cost* — OAuth adds a one-time setup step per user per service; API-key management requires a rotation process; audit logging via PostToolUse adds small per-call overhead. *Complexity* — regulated environments add requirements absent from a prototype; identifying them during scoping is the discipline that keeps integrations on schedule. *Risk* — concentrates when a prototype moves toward production: a system with **hardcoded credentials, no audit log, and no central lock will not pass a regulated customer's security review**. The fixes aren't hard, but they must happen before the review.

*Handles well:* any integration touching data a regulated customer cares about, where the tooling already supports enterprise managed settings and audit hooks — scoping security up front adds little overhead and prevents a final-review stall. *Adds cost/complexity:* teams unfamiliar with OAuth flows or enterprise secrets management — these patterns require coordination with security/IT in most regulated orgs, and the timeline must account for it. *Use a different approach:* a prototype or PoC that will never see production data — the full checklist isn't warranted for a demo, but applying the env-variable habit for secrets costs nothing and is good practice.

> **⚠ Watch Out — "the OAuth connection that worked in staging and failed in production."** OAuth worked end-to-end in staging, so the production cutover felt routine. Every production sign-in failed with a **redirect URI mismatch**: the OAuth app was registered for `staging.mycompany.com`, and **`production.mycompany.com` was not on the allowed redirect-URI list** — each sign-in hit the check, failed the match, and looped back to the sign-in screen. Not a code defect (staging tests all passed) — a config step that **applies per host and per environment**. The security reviewer added a second flag: most enterprise customers **require separate OAuth app registrations for staging and production**, so reusing one app across environments is itself an issue. **Rule:** OAuth redirect URIs are registered per host — a working staging connection does not mean production is configured. Before moving any OAuth-authenticated MCP integration to a new environment, **add the new host's redirect URI to the app registration**, verify whether separate registrations are required per environment, and put the registration step in the deployment checklist so it isn't discovered at the first production sign-in.

> **Checkpoint 6 — diagnose the authentication failure from a trace:**
> ```
> [MCP Client] Connecting to https://data-api.internal/mcp ...
> [MCP Client] GET /auth/token, 401 Unauthorized
> [MCP Client] Reading credential from: /home/jenkins/.config/mcp-credentials.json
> [MCP Client] Credential value: WAREHOUSE_TOKEN= sk-****[redacted]
> [MCP Client] Retrying with credential, 401 Unauthorized
> [MCP Client] Connection failed after 3 attempts
> ```
> **[reconstructed]** — **Fix B.** The mechanism is a **rejected/invalid credential read from a file on disk** (`/home/jenkins/.config/mcp-credentials.json`) — the server returns 401 both before and after retry, so the stored key is bad *and* it's living in a file rather than an injected secret. Correct targeted fix: **rotate the rejected key, then move the credential out of the file and inject it as an environment variable in the CI pipeline runner config, updating the MCP configuration to reference the variable.** (A re-writes the same bad pattern back to a file; C swaps auth methods unnecessarily for a service-identity/CI context where an API key in an env var is the right pattern.)

---

## Cumulative Integration Task (with printed model answers)

Three bugs are planted across the layers this module covers — one in the Claude Code configuration layer, one in the plugin/packaging layer, one in the MCP/authentication layer.

**Part A — Bug ID.** For each file, identify the bug and describe what it does or fails to do at runtime.

```json
// File 1: .claude/settings.json
{ "permissions": { "defaultMode": "bypassPermissions", "deny": ["Read(.env.production)"] } }
```
```
// File 2: .claude/skills/migration-validate/SKILL.md
---
name: migration-validate
description: Validates migration scripts before they run against production.
---
## Steps
1. Run: /Users/priya/scripts/validate-migration.sh
2. Report validation results.
```
```json
// File 3: .mcp.json
{ "mcpServers": { "data-warehouse": {
  "type": "http",
  "url": "https://warehouse.internal/mcp",
  "headers": { "Authorization": "Bearer sk-prod-warehouse-abc123" }
} } }
```

**Model answer (verbatim):**

- **File 1 (settings.json):** `defaultMode` is `bypassPermissions`; removes every confirmation prompt on a production workstation, including for destructive operations. The deny rule for `.env.production` is correct; only the mode is wrong.
- **File 2 (SKILL.md):** Step 1 uses an absolute path `/Users/priya/scripts/validate-migration.sh`; this path exists only on the author's machine and will not resolve on any teammate's machine after they clone the project.
- **File 3 (.mcp.json):** The API key `sk-prod-warehouse-abc123` is committed inline in the Authorization header; it enters repository history where it cannot be removed by overwriting the file in a later commit, and must be treated as compromised.

**Part B — Assembly.** Write the corrected version of all three files.

**Model answer (verbatim):**

```json
// File 1: settings.json (corrected)
{ "permissions": { "defaultMode": "acceptEdits", "deny": ["Read(.env.production)"] } }
```
```
// File 2: SKILL.md (corrected)
---
name: migration-validate
description: Validates migration scripts before they run against production.
---
## Steps
1. Run: $CLAUDE_PROJECT_DIR/scripts/validate-migration.sh
2. Report validation results.
```
```json
// File 3: .mcp.json (corrected)
{ "mcpServers": { "data-warehouse": {
  "type": "http",
  "url": "https://warehouse.internal/mcp",
  "headers": { "Authorization": "Bearer ${WAREHOUSE_MCP_TOKEN}" }
} } }
```

*Rationale (verbatim):* `settings.json` sets `defaultMode` to `acceptEdits` inside `permissions` — auto-approves file edits and common filesystem commands but gates destructive shell commands, the right tradeoff for a production migration workstation. The skill uses `$CLAUDE_PROJECT_DIR` so the path resolves from the project root on any machine after cloning. The MCP configuration references the credential as an environment variable so it is never committed to repository history.

---

## Recap — seven key takeaways

1. **Permission mode is a risk decision, not a speed decision.** Modes range from prompt-before-everything to prompt-for-nothing; match the mode to the risk profile of the work and environment, not to a preference for fewer prompts. A bypass mode on a workstation against a live codebase removes every checkpoint between the agent and your files. A **deny rule** on the path that must not be touched, set at project or enterprise level, covers the gap a mode alone does not.
2. **An AI code review gives you a set of findings to triage, not a verdict to apply.** Trust findings the reviewer can prove from the diff in front of it (a missing null check, an unclosed resource) and confirm them on the lines it cites; treat any claim about runtime behavior or another system as a **hypothesis to test**. Put the human gate where a finding turns into a hard-to-reverse action, and raise accuracy by giving the reviewer the conventions it would otherwise have to guess.
3. **A skill is portable, but "runs everywhere" is something you design for.** The same `SKILL.md` runs in Claude Code, on the Messages API, and through the Agent SDK, but each loads and sandboxes it differently: filesystem discovery in Claude Code, beta headers and a code-execution container on the API, `settingSources` on the SDK. A skill scoped to a clear description and free of local-environment assumptions ports cleanly; one that assumes its home terminal does not. In every runtime, **subagents start clean — they do not preload skills**.
4. **Durable context requires the right mechanism for each concern.** CLAUDE.md is session-persistent project memory but dilutes with size; rules files scope guidance to where it applies; hooks enforce guardrails deterministically, not probabilistically; subagents keep exploration out of the main context. Forcing all four into CLAUDE.md produces a single file that is harder to maintain and easier to ignore.
5. **A shareable setup requires portable components.** A plugin referencing an absolute path to the author's home directory installs on one machine and fails on all others. Shared skills, hooks, and plugin components must reference paths **relative to the project root**, and any env-variable requirement must be documented or validated at install time. Test the install from a clean machine before distributing.
6. **Transport and scope are independent decisions with dependent consequences.** stdio is for servers on your machine; HTTP for anything hosted remotely or accessed by multiple developers. Local scope keeps a server personal; project scope shares it via `.mcp.json`. The combination must match deployment intent: a shared team server requires HTTP + project or enterprise scope. **A stdio server in `.mcp.json` looks shareable but is not.**
7. **Enterprise integration requires identifying the security requirements before deployment.** A regulated customer asks about identity, data residency, access logging, and configuration control. The answers: **OAuth** for user-identity services, **environment variables** for service credentials, **PostToolUse hooks** for audit logging, **enterprise managed settings** for configuration lock. None is hard to implement, but all are hard to retrofit after a production deployment has failed a security review.

*Next: Module 4 — Production Engineering, Evals, and Security: measuring whether Claude Code integrations work correctly at scale, building eval harnesses, and designing production-grade safety guardrails. The permission modes, hooks, and authentication patterns from this module are the foundation those evaluations test against.*

---

## Glossary (key terms from this module)

- **Claude Agent SDK** — a programmable interface exposing the same agent loop Claude Code runs in the terminal. Lets developers invoke the loop from code, set the permission mode and available tools, and run tasks without an interactive session. **The same permission model and deny rules that apply in the terminal apply in the SDK.**
- **CLAUDE.md** — a Markdown file at the root of a Claude Code project; contents prepended to the context window at the start of **every** session. Holds the universal project constraints, conventions, and commands that should apply unconditionally across all sessions. Files beyond **roughly 200–300 lines** risk diluting critical rules through content weight.
- **Hook** — a command bound to a lifecycle event in Claude Code's execution (PreToolUse, PostToolUse, UserPromptSubmit, Stop). Unlike CLAUDE.md instructions, hooks run **deterministically** at the configured event regardless of what the model decides. A PreToolUse hook can **exit with code 2 to block** a tool call before it runs.
- **MCP (Model Context Protocol)** — an open communication layer that lets an MCP client (such as Claude Code) connect to an MCP server exposing **tools, resources, and prompts**. The protocol defines how the client discovers and calls the server's tools. Using MCP moves tool definition and maintenance out of individual application code into a reusable server any MCP client can attach to.
- **MCP transport** — the communication channel between an MCP client and server. **stdio** runs the server as a local subprocess on the same machine; **HTTP** connects to a remotely hosted server over a network. The choice determines where the server can run and who can connect.
- **Permission mode** — a Claude Code setting controlling how often the agent stops to request confirmation before executing tool calls. Ranges from **default** (prompts before nearly every action) to **bypass** modes (no prompts). **Deny rules override any mode**; a deny rule at the enterprise settings level cannot be bypassed by any individual configuration.
- **Plugin** — a versioned bundle of Claude Code components (skills, hooks, subagents, and MCP server configurations) distributed through a marketplace. Installing gives the recipient the same setup as the author in a single step. Enterprise admins can deploy plugins org-wide through managed settings.
- **Rules instruction file** — a file that scopes guidance to a specific path or condition in Claude Code. Unlike CLAUDE.md (loads every session unconditionally), a rules file activates only when Claude Code works in the directory it supervises. Keeps path-specific guidance out of the main project memory file.
- **Subagent** — a separate execution context launched by Claude Code to handle a delegated task. Does not inherit the main conversation's context or accumulated files; starts clean, performs the task, and returns only a summary. Using subagents for exploratory/investigative work keeps the main session context from filling with content that won't be reused.

---

### Sources cited by the module
Claude 101 (Skilljar) · Claude Code 101 In Action (Skilljar) · Building with the Claude API (Skilljar) · `code.claude.com` · `platform.claude.com` · `docs.claude.com`.

_Educational content; illustrative/fictitious examples. Verify current requirements against Anthropic docs at build time. © 2026 Anthropic._
