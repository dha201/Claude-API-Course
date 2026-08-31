# Module 1 — MSO Foundations

This lesson is Module 1 of the Claude Certified Developer – Foundations track. The notes cover the whole module as exam-prep study material:

- 4 teaching sections — How LLMs Behave · Models & Reasoning Modes · Prompting Modes · The Technical Substrate — each with its core frameworks
- Reference tables built faithfully from the module's own prose: the model-family tiers, the two-lever model/reasoning composition, the three prompting modes, and the four request/response shapes (sync · streaming · async · batch)
- Both checkpoints (the module quiz and the "predict the behavior" exercise) — these are **interactive widgets with no printed questions or answer key in the source**; the exercise's four-foundation reasoning is **reconstructed inline** from the module's own frameworks and marked as such
- A glossary compiled from the terms the module defines inline (tokens, context window, sampling, non-determinism, model tiers, adaptive thinking, prompting modes, SDK/REST, streaming, async, batches), the verbatim five-takeaway recap, and the sources list

> **Claude Certified Developer – Foundations Prep Course** · Module 1 (Foundations track)
> Source: SCORM deck `Developer_M1_vF2.html`.
> Study notes — condensed teaching narrative with verbatim learning objectives,
> reference frameworks, glossary definitions, recap, and self-check material
> extracted from the module. **9 screens · 4 teaching sections · 2 checkpoints**
> (module quiz + "predict the behavior" exercise; the deck shows "of ? checkpoints,"
> so the exact count is not printed — these two graded widgets are the checkpoints).
>
> **Exam-scope flags:** this module contains **no `[Partner Track]` markers and no
> on-blueprint domain-number tags** (e.g. no "(6.4)"). All content is in scope; nothing
> is flagged out. (Stated explicitly because the sibling template carried such flags — this one does not.)
>
> **What "MSO" stands for:** the deck never expands the acronym in the extracted text.
> Inferred from the content, **MSO = Model · Sampling · Operations** — the three
> foundation layers the module builds: the **Model** (family, tiers, reasoning modes),
> **Sampling** (tokens, context window, sampling, non-determinism — how generation
> behaves), and the **Operational** substrate (SDK/REST, sync/streaming, async/batch —
> how a developer reaches Claude). Prompting modes sit on the Model/prompting layer.
> *(Expansion is reconstructed, not quoted from the deck.)*

---

## Orientation — what this module makes you able to do

*Screen: Orientation · 2 min.* Before you write a line of code against Claude, it helps to know what the words mean. This module introduces the **model fundamentals** and the **technical foundations** that the rest of the Developer course assumes you already have. Its output is a shared vocabulary — tokens, context, sampling, model tiers, prompting modes, and the transport mechanics of the API — so later modules can build on those terms directly.

**Learning objectives (verbatim). By the end of this module, you will be able to:**

1. Explain what a token is, how the context window works as a fixed budget, why sampling makes outputs vary, and what non-determinism means for testing and evals.
2. Describe the Claude model family and its capability tiers, and distinguish choosing a model from enabling a reasoning mode such as extended thinking.
3. Choose between zero-shot, one-shot, and multi-shot prompting, and weigh the cost and quality trade-off of adding examples.
4. Describe how a developer accesses Claude: SDK versus raw REST, synchronous versus streaming responses, and asynchronous patterns for high-volume work.

**The module's four foundations** (its own framing, from the exercise brief): **sampling · prompting mode · request shape · context budget.**

> *Educational content. Not legal, financial, or professional advice; adapt to your own situation. Anthropic's products evolve quickly, so verify specifics on Anthropic's website or docs. Examples are illustrative and often fictitious; a mentioned company/product implies no endorsement or affiliation. Your use of Anthropic products is governed by Anthropic's terms, policies, and documentation, which control if anything here conflicts.*

---

## 1. How LLMs Behave — tokens, context, sampling, non-determinism

*Screen: Teaching · 12 min.* Four behaviors of the model that every later decision inherits.

### Tokens — the unit of input, output, and cost

Claude does not read characters or words directly; it reads **tokens**. The characters-per-token average depends on the model's tokenizer and differs between model generations, so **treat any chars-per-token rule of thumb as model-dependent** and confirm current tokenizer behavior at build time. Everything the model processes is counted in tokens: your prompt, the conversation history, tool definitions, tool results, and the generated response. Tokens are the unit of **both pricing and budget** — when you estimate what a feature costs or whether an input fits, you are counting tokens, not words. Useful habit: **think in tokens**, since that is the unit the API bills in and the context window measures.

### The context window — a fixed budget

The context window is the **total number of tokens the model can take in for a single request**. It holds everything at once: the system prompt, the full conversation so far, injected documents, every tool result, and the model output. It is a fixed budget with **two distinct edge behaviors**:

| Situation | What happens |
|---|---|
| Input alone already larger than the window | **Rejected with a validation error *before* generation begins** |
| Input fits, but generation reaches the ceiling | Current models **stop and return the output generated so far** with a `model_context_window_exceeded` stop reason — *not* an error |

Either way, keeping a long session running requires the application to **trim or summarize history before each call**. In development the window rarely fills (test inputs are short); in production, longer inputs and more turns fill it faster. This is the failure **Module 2** explores in detail.

### Sampling — why the same prompt can give different answers

A language model does not pick one fixed next token. At each step it produces a **probability distribution over possible next tokens and samples from it**. Settings such as **temperature** shape that distribution: lower temperature concentrates probability on the most likely tokens (more repeatable); higher temperature spreads it out (more varied). Because the choice is sampled rather than fixed, the same prompt run twice can return different wording even when both answers are correct.

**Sampling controls are model-dependent:** the newest Claude models **do not accept non-default sampling parameters** — setting `temperature`, `top_p`, or `top_k` returns a **400 error**, and behavior is steered through prompting instead. Even where temperature is accepted, **temperature 0 makes outputs more repeatable but does not guarantee identical outputs** across calls. Confirm current parameter support in the API reference at build time.

### Non-determinism — what it means for testing and evals

Non-determinism is the primary consequence of sampling: **identical inputs do not guarantee identical outputs.** That changes how you test:

- A test asserting the **exact text** of a response will be inconsistent (the model can express the same correct answer many ways).
- Instead, **assert on the property that must hold**: a required field is present, a value is in range, the structure parses.
- When you must judge **meaning rather than structure**, use an **eval with a model-graded judge.**

This is why the course treats **evals** as the standard for knowing a feature is correct — the capability **Module 3** builds.

**Cost note:** tokens are the meter, so budget in tokens; the context window is the ceiling that meters cost per call.

---

## 2. Models & Reasoning Modes

*Screen: Teaching · 10 min.* Two independent, composable levers: which model runs, and whether it reasons first.

### The Claude model family

Claude is a family of models that currently spans **four tiers**. Each represents a different tradeoff across **cost, latency, and capability**:

| Tier | Positioning (from the module) |
|---|---|
| **Fable** | Most capable tier; built for the most demanding reasoning, coding, and agentic work where **maximum intelligence is the priority** |
| **Opus** | Handles demanding work **above the Sonnet envelope** |
| **Sonnet** | The **balanced default** for most production workloads |
| **Haiku** | Built for **speed and cost efficiency** on tasks that fit its capability envelope |

**Practical default:** start with **Sonnet**; move **up** a tier only when an eval shows the current tier missing your quality bar; move **down** to Haiku only when an eval shows the quality drop is acceptable for the task. Confirm the current model lineup and identifiers against `platform.claude.com/docs` at build time — the family is evolving.

### Reasoning modes are a separate setting from model choice

Choosing which model to run is one decision; **whether the model reasons before answering is a separate decision you make per call.** On current models the reasoning mode is **adaptive thinking**: the model decides when and how much to think, and you tune depth with an **effort setting** rather than a fixed token budget. (The older `budget_tokens` control is **deprecated** and, on the newest generations, **returns a 400 error**.) Thinking content is **omitted from responses by default** on the newest models — request **summarized display** when you need to show it. Reasoning **earns its cost on hard, multi-step problems** and is **wasted on lookups and classification.** Per-model defaults differ (some newest models think adaptively by default or always), so confirm current thinking defaults for your model at build time.

### How the two levers work together

Because model choice and reasoning mode are independent, each is set separately:

| Combination | Character |
|---|---|
| Capable model + reasoning **off** | Fast and direct |
| Smaller model + reasoning **on** | Spends more tokens to think |
| Capable model + **higher effort** | For the most demanding tasks |

**Module 2** teaches the mechanics of enabling reasoning and handling the thinking blocks it returns. The decision of *which* model to run — weighed against cost, latency, and quality — is taken up in **Module 4**.

---

## 3. Prompting Modes — zero-shot, one-shot, multi-shot

*Screen: Teaching · 8 min.* Separate from how you **word** a prompt is how many worked **examples** you put inside it. The examples are **not training data** — they sit in the prompt and show the model the exact shape of the answer, which a description alone often fails to pin down.

### The three modes

| Mode | What you give the model |
|---|---|
| **Zero-shot** | The instruction and **no examples** — describe the task and ask for the result |
| **One-shot** | Adds **one** example of the input paired with the desired output |
| **Multi-shot** (few-shot) | Includes **several** such input/output examples |

### The cost and quality trade-off

Each example costs tokens **on every call** and consumes context budget, so the choice trades **quality against cost**:

- Reach for **zero-shot** when the task is simple and the output shape is obvious.
- Move to **one-shot / multi-shot** when the output has a specific structure, casing, or edge case that a description keeps missing.
- Often **one or two correct examples fix the issue faster than another paragraph of instructions.**

General discipline (reinforced in Module 2): **add the smallest amount of prompt that produces a reliable result.**

### Mode choice interacts with model choice

Prompting mode and model choice are related levers. A **more capable model** often succeeds zero-shot where a **smaller model** needs a few examples to match the structure — so adding examples can let a **cheaper model** do the job. Make the two decisions together: **try the simplest model and the fewest examples that meet your eval, and add capability or examples only where the eval says you need them.**

---

## 4. The Technical Substrate — SDKs, REST, streaming, async

*Screen: Teaching · 12 min.* How a developer actually reaches Claude, and how to shape the request/response for the workload.

### SDK vs. raw REST

At its core, Claude is reached over an **HTTP REST API**: your code sends a request to an endpoint with your API key and a JSON body, and reads a JSON response back. You can call it directly with any HTTP client. More commonly you use an **official SDK** (Python and TypeScript among others) — a **thin convenience layer over the same REST API** that handles authentication, request construction, retries, and response parsing so you write less boilerplate.

> The SDK and raw REST reach **the same API and the same model.** The SDK just saves you from assembling requests by hand. **Module 2** builds against the SDK and the **Messages API**, which sits on this same foundation.

### Response shapes — synchronous, streaming, and asynchronous / batch

| Pattern | How it works | When to use it |
|---|---|---|
| **Synchronous** | Send the request, **wait for the complete response** in one piece, then act on it | Short responses and backend jobs where **no one is waiting** |
| **Streaming** | Response sent **in pieces as the model generates it**, over the same HTTP connection using **server-sent events (SSE)**; your code reassembles the pieces | Long responses, or a **user is watching** — output appears immediately instead of a blank-screen wait |
| **Async client** (`AsyncAnthropic`, Python) | Non-blocking `async`/`await` API calls that don't tie up your application thread; request still returns in **real time**, but your app handles other work while it waits. *In the TypeScript SDK the standard `Anthropic` client is Promise-based, so you `await` calls directly — there is **no separate async client class.*** | Concurrency **without blocking** |
| **Message Batches API** | Submit a large set of requests in one call, receive an **identifier**, and **poll** for completion; jobs can take **up to 24 hours** and run at **lower per-token cost** in exchange for that latency | **Bulk offline** workloads — pipelines, evaluation runs, bulk jobs where no user waits per result and **cost matters more than turnaround** |

**Cost note:** the async client and the Message Batches API solve **different** problems — async gives you concurrency at real-time latency; batch trades latency (up to 24h) for a **lower per-token price**. **Module 2** teaches how to consume a stream safely and recover when it is interrupted.

---

## Checkpoints

Both graded widgets in this module are **interactive with no printed questions or answer key in the extracted source** ("0 of ? checkpoints passed"). Below: what each covers, plus the reasoning the correct answers must draw on, **reconstructed from this module's own frameworks and marked as such** (no fabricated question text).

### Checkpoint 1 — Module quiz (5 min)

> **Format:** multiple-choice questions testing understanding of the course so far. **No question text or answer key is printed in the source deck**, so no verbatim answers can be reproduced. Study targets are the four sections above: token/context-window mechanics, sampling & non-determinism, model-vs-reasoning levers, prompting modes, and SDK/REST/streaming/async/batch transport.

### Checkpoint 2 — Exercise: "predict the behavior" (6 min)

> **Format:** each scenario presents a configuration drawn from **one of the module's four foundations — sampling, prompting mode, request shape, and the context budget.** For each, select the answer that predicts the **correct behavior** *and* the **reason why.** **Partial credit is available for three of four correct.** The scenarios themselves are not printed in the source.

**Reconstructed answer key (derived strictly from this module's frameworks — not printed in the deck):**

| Foundation | Behavior the correct answer must predict, and why |
|---|---|
| **Sampling** | Setting `temperature` / `top_p` / `top_k` on a **newest** model → **400 error** (those models reject non-default sampling params). Where sampling *is* accepted, the same prompt can return **different wording** each run (non-determinism); even **temperature 0 does not guarantee identical outputs**. |
| **Prompting mode** | A **zero-shot** prompt on a task with a specific structure/casing/edge case → the model **misses the exact shape**; adding **one or two correct examples** (one-/multi-shot) fixes it faster than more instruction text — at the cost of tokens on every call. |
| **Request shape** | A **bulk offline** job with no user waiting → **Message Batches API** (lower per-token cost, up to **24h**). A **user watching a long response** → **streaming** (SSE), so output appears immediately. Concurrency without blocking → **async client** at real-time latency. |
| **Context budget** | Input **already larger than the window** → **validation error before generation begins**. Input fits but generation **hits the ceiling** → truncated output with a **`model_context_window_exceeded` stop reason**, not an error — so **trimming/summarizing history is the application's job.** |

---

## Glossary

*(Compiled from terms the module defines inline; wording follows the module's own definitions.)*

- **Token** — the unit the model actually reads and the unit of pricing and budget; everything (prompt, history, tool definitions, tool results, output) is counted in tokens. Chars-per-token is model-/tokenizer-dependent — verify at build time.
- **Context window** — the total number of tokens the model can take in for a single request; holds the whole request at once. A fixed budget.
- **`model_context_window_exceeded` (stop reason)** — returned when a request that fit on input reaches the window ceiling **during** generation; the model stops and returns the output so far rather than raising an error.
- **Sampling** — at each step the model produces a probability distribution over next tokens and samples from it, rather than picking one fixed token.
- **Temperature** — a sampling control shaping the distribution: lower = more repeatable, higher = more varied. Not accepted on the newest models (returns 400); temperature 0 is more repeatable but not guaranteed identical.
- **Non-determinism** — the consequence of sampling: identical inputs do not guarantee identical outputs; test on properties/evals, not exact text.
- **Eval (model-graded judge)** — the standard for knowing a feature is correct when meaning (not just structure) must be judged; built in Module 3.
- **Claude model family** — four tiers (Fable, Opus, Sonnet, Haiku), each a different tradeoff across cost, latency, and capability. Sonnet is the balanced default.
- **Capability tier / envelope** — the band of task difficulty a given model handles well; move up/down tiers only when an eval justifies it.
- **Adaptive thinking (reasoning mode)** — current reasoning mode where the model decides when/how much to think; depth tuned via an **effort setting** (the older `budget_tokens` is deprecated / 400 on newest models). Thinking is omitted by default; request summarized display to show it.
- **Zero-shot** — instruction with no examples.
- **One-shot** — instruction plus one input→output example.
- **Multi-shot (few-shot)** — instruction plus several input→output examples; examples are prompt content, not training data.
- **REST API** — the HTTP endpoint (API key + JSON body → JSON response) that is the base way to reach Claude.
- **SDK** — official thin convenience layer (Python, TypeScript, others) over the same REST API; handles auth, request construction, retries, parsing.
- **Messages API** — the API (built on this REST foundation) that Module 2 builds against.
- **Synchronous request** — send and wait for the whole response in one piece.
- **Streaming** — response delivered in pieces as generated, over the same connection via server-sent events (SSE); the client reassembles it.
- **Async client (`AsyncAnthropic`)** — Python non-blocking async/await client for concurrency without tying up the app thread; real-time latency. (TypeScript's standard client is Promise-based — no separate async class.)
- **Message Batches API** — bulk offline pattern: submit many requests, get an id, poll; up to 24h, lower per-token cost.

---

## Recap — five takeaways (verbatim)

1. **Tokens are the unit of input, output, and cost.** Think and budget in tokens rather than words, since that is what the API meters and the context window measures.
2. **The context window is a fixed token budget that holds the whole request at once.** An oversized input errors before generation, while hitting the ceiling mid-generation returns truncated output with a `model_context_window_exceeded` stop reason, so managing history is the application's job.
3. **Sampling makes generation non-deterministic.** The same prompt can return different wording on each run, so testing on exact text is unreliable. This is what evals are built for.
4. **Model choice and reasoning mode are separate, composable levers.** Pick the smallest model and the simplest reasoning and prompting that meet your eval and add capability only where the eval says you need it.
5. **A developer reaches Claude over a REST API, usually through an SDK.** Choose between synchronous, streaming, async/await, or batch based on whether a user is waiting and whether the workload is real-time or bulk offline.

*What comes next: **Module 2** puts these foundations to work across prompting craft, tool schemas, streaming, context engineering, and agent construction.*

---

### Sources cited by the module
Claude 101 (Skilljar) · Building with the Claude API (Skilljar) · AI Fluency: Framework & Foundations (Skilljar) · `platform.claude.com/docs`. Verify product specifics at publish time.

_Educational content; illustrative/fictitious examples. © 2026 Anthropic._
