# Module 2 — Production-Grade Prompting, Agents & Tool-use

This lesson is Module 2 of the Developer Foundations track — the largest module in the course (~209 minutes). The notes cover the whole module as exam-prep study material:

- 8 teaching sections — Prompting Craft · Extended Thinking · Tool-use & Schema Design · Streaming Responses · Context Engineering · Agent Construction · Agent Memory · Multimodal & Batch Ingestion — plus a Cumulative Debug Task, each with its frameworks and the "Watch Out" failure story condensed
- All reference/decision tables reproduced verbatim: the prompt-failure diagnostic table, the four-technique stack table, the six-pass revision trace, extended-thinking decision table, message-block table, schema-design decision table, streaming-event table, four context strategies, the dev-vs-production overflow table, workflow-vs-agent table, wiring-path descriptions, Managed Agents stop/take-on table, loop-wiring checklist, HITL insertion table, the five regulated-data-constraint table, memory-scope table, Skills-vs-CLAUDE.md table, image-send methods, and the batch-vs-synchronous table
- Every code / tool-JSON-schema / prompt reference kept exact (classification prompt before/after, schema exclusion-condition fix, broken stream handler, agent-wiring skeleton, document block JSON, the four-bug debug program)
- All 8 numbered checkpoints + the two-stage cumulative debug task, WITH answers — **reconstructed** (see header note)
- Full glossary (11 terms) and the 8-takeaway recap and sources

> **Claude Certified Developer – Foundations Prep Course** · Module 2 (Foundations track)
> Source: SCORM deck `Developer_M2_vF2.html`.
> Study notes — condensed frameworks, reference tables, failure cases, and self-check
> questions extracted from the module. **29 screens · 10 sections · 209 minutes · 9 checkpoints.**
>
> **Exam-scope flags:** this deck carries **no** `[Partner Track]` / "not tested" markers and **no**
> on-blueprint domain-number tags (unlike the Architect track). The module references "the blueprint"
> once in Agent Memory but attaches no numbered tag, so nothing here is flagged out of scope.
>
> **Checkpoint answers are RECONSTRUCTED.** The extracted deck exposes only "Reveal model answer" /
> "Submit" controls — no printed answer key. Every checkpoint answer and every debug/exercise model
> answer below is reconstructed strictly from the module's own frameworks and is **marked
> `[reconstructed]`** inline.

---

## Orientation — what this module makes you able to do

**Core framing:** *Writing code that uses Claude is different from using Claude to write code.* You have used Claude interactively — type a prompt, read the response, adjust. This module covers everything beyond that: tool schemas, context management, agent loops. As an engineer you own programmatic integration, reliable output handling, and shipping a robust production system. Each topic addresses a **specific failure mode** that is cheap to prevent at design time and expensive to fix after the build is underway.

**By the end of this module, you will be able to:**

1. Write production-ready prompts (system prompts, XML tags, few-shot examples, output constraints) and diagnose why a prompt underperforms.
2. Decide when to enable extended thinking, calibrate its effort setting, and handle thinking blocks correctly across tool-use turns.
3. Define a tool schema Claude selects correctly, construct the tool-use loop, handle multi-turn message blocks, and choose single vs. parallel tool calls.
4. Consume a streamed response, assemble events into complete blocks, and recover cleanly when a stream is interrupted.
5. Apply context engineering (managing the window, compacting, clearing, subagent handoffs) to keep multi-turn sessions in budget without losing continuity.
6. Build a production agent: choose workflow vs. agent, wire tools and context into a loop, pick a wiring path that fits deployment constraints, and add HITL checkpoints where actions are irreversible.
7. Manage agent memory across sessions with persistent-storage patterns and the right memory scope, so state survives without inflating context cost.
8. Send images and PDFs with the correct block structure, use the Files API for reusable assets, and submit high-volume workloads via the Message Batches API.

**"The build" throughout the module:** one recurring problem — *a Claude integration that worked in development but must now hold up in production.* In dev the prompt looked solid, the tool call worked, the session stayed short, test inputs were manageable. In production the same system faces longer sessions, larger tool outputs, interrupted streams, tighter cost/latency limits, memory across turns, and irreversible actions. The module teaches **which implementation decision prevents which production failure.**

*Audience: a Developer taking a prototype to a production system. Practical, code-forward, pattern-oriented. Assumes you already write code — it teaches the engineering decisions around the model, not programming fundamentals.*

---

## 1. Prompting Craft — system prompts, XML, few-shot, output constraints

**Core idea:** a prompt that works once in interactive use often breaks in production against untested inputs. The fix is **not more words** — it is identifying which structural piece is missing and adding *that one piece*. Rewording changes how you say something; it does not add the missing structural element. Diagnose how the prompt fails first, then add the technique that addresses that failure.

**The four techniques (when to reach for each):**
- **System prompts** carry the behavioral contract for the whole session. Write once, treat as the persistent instruction layer — role, output format, rules that must not change between conversations.
- **XML tags** are used when the prompt mixes inputs with instructions (e.g. debug code using provided docs). Wrap with descriptive names like `<my_code>` and `<docs>`; official XML names are not required — descriptive names that match your content work best.
- **Few-shot examples** show rather than tell. Provide one correct input-output pair and let Claude infer the pattern; wrap in consistent XML (e.g. `<sample_input>`/`<ideal_output>`). You can lift examples from your highest-scoring eval outputs.
- **Output constraints** are the last line of defense before the parser. Specify field names, types, length limits, whether to include preamble, and what to do when data is absent. Use structured-output features when the format must be machine-readable.

**Diagnostic table — failure symptom → missing technique:**

| What you observed | What the prompt is missing | Why this technique is the fix |
|---|---|---|
| The result comes back in the wrong shape: a sentence where you expected a label, prose where you expected JSON. | An output constraint. The prompt never specified the form, field names, or stopping point of the response. | An output constraint controls the form of the response independent of its content. Without one, Claude returns plausible text that the downstream parser was not built to accept. |
| The content is off: scope drifts, tone shifts, or Claude answers a wider question than you asked, and it gets worse deeper into the conversation. | A system prompt, or a more specific one. The behavioral contract was too vague to hold across turns. | The system prompt sets the rules that apply to every response regardless of the user turn. When it is underspecified, there is nothing holding role, scope, and format steady as the conversation runs on. |
| The task is right, but the structure is invented: Claude understood what to do and produced output in a shape you never asked for. | Few-shot examples. Claude cannot infer an exact structure from a description alone. | Few-shot examples show the pattern rather than describe it. One correct input-output pair gives Claude the exact shape to match, which a written instruction often fails to pin down. |
| Output is clean on the inputs you tested but breaks on a variant: an edge case, an unusual field, an input you did not anticipate. | A constraint covering the variant. The prompt handles the happy path and has no rule for the case the parser breaks on. | The prompt was validated against a narrow set of inputs. Naming the variant in the constraint, or adding an example that covers it, closes the gap the test inputs never exposed. |

**Worked example — classification prompt before and after.** A developer classifies support tickets into billing / technical / escalation. Bare prompt:

```
System: "You are a support classifier. Classify the ticket."
User: <ticket>I was charged twice for the same month.</ticket>
```

Claude returns `"Billing"`, `"billing"`, or a full sentence on different runs; the router breaks on the inconsistency. This is the diagnostic table's first row → missing an **output constraint**. The fix pulls in two more techniques (few-shot to lock the label set and casing; XML to separate examples from the instruction):

```
System: "You are a support classifier. Classify each ticket into exactly one of: BILLING, TECHNICAL, ESCALATION. Return only the label. No other text."

<sample_input>My account shows two charges for April.</sample_input>
<ideal_output>BILLING</ideal_output>

<sample_input>The API keeps returning a 429 error.</sample_input>
<ideal_output>TECHNICAL</ideal_output>

User: <ticket>I was charged twice for the same month.</ticket>
```

Three techniques do distinct work: system prompt sets the output contract, XML marks example boundaries, few-shot shows exact casing/format.

**Stack / simplify / diagnose table:**

| Stack all four techniques | Stacking all four techniques against a clearly defined output contract. Tasks with well-specified formats and edge cases that can be covered by examples. |
|---|---|
| **Simplify the prompt** | Adding all four techniques to a simple task that only needs one. A "summarize this paragraph" prompt does not need few-shot examples and an output schema. |
| **Diagnose before adding more** | Prompts that are growing longer with each iteration rather than more precise. If you have re-prompted five times and the output is still wrong, diagnose the failure type before adding more text. |

**The iteration loop — diagnose before re-prompting.** Failure type → missing technique:
- **Wrong format** → missing output constraint.
- **Wrong content / scope drift** → underspecified system prompt.
- **Correct task but hallucinated structure** → few-shot examples needed.
- **Good on simple inputs but breaks on edge cases** → no constraint covering the variant. *The fix is structural, not phrasing.*

**Structured outputs — moving output control from the prompt into the API.** A prompt is a *request*; the model can still return a stray sentence, wrong field name, or malformed JSON. Structured outputs remove that gap: you hand the API a JSON schema and the model is constrained *at generation time*. The mechanism is **constrained decoding** — as Claude generates each token, the API only allows tokens that keep the output valid against the schema, so a schema-violating response cannot be produced. Two situations, usable alone or together:
- **JSON outputs** constrain the final response. Set `output_config.format` with `type json_schema` + your schema; Claude returns valid JSON every time. Reach for this when the model itself produces the structured payload your code consumes (extracting fields, formatting an API response) — removes parse-and-retry code.
- **Strict tool use** constrains the inputs Claude passes to your tools. Set `strict` to `true` on a tool definition; arguments are validated against the input schema before your code runs. Reach for this in agentic loops where a malformed tool argument would crash the function or trigger a wrong action.

*Why it belongs in production code, not just the prompt:* a prompt-level "return only JSON" holds on tested cases and slips on untested ones; a schema constraint does not slip because the API enforces it on every token. **Costs to weigh (don't enable everywhere by default):**
- **First request on a new schema is slower** — the API compiles the schema into a grammar first. Compiled grammars are cached for 24 hours from last use; stable schemas pay once, constantly-changing schemas pay repeatedly.
- **Input token count rises** — the API adds a system prompt describing the expected format, billed like any input token. Small per call, matters at volume.
- **A guaranteed schema is not a guaranteed success** — two cases still return non-matching output: a **refusal** (`stop_reason` = `refusal`) and a **truncation** (hits `max_tokens`, `stop_reason` = `max_tokens`). Still check `stop_reason`.
- **Does not combine with message prefilling** — JSON outputs and prefilling the assistant message are incompatible; pick one.

**⚠ Watch Out — "the prompt that grew longer instead of better."** A developer iterated the ticket classifier over six passes; each pass added words, the output kept drifting.

| Pass | What was added | Output behavior |
|---|---|---|
| 1 | "Classify this ticket as billing, technical, or escalation." | Returns full sentences: "This appears to be a billing issue." Parser breaks. |
| 2 | Added "Be concise." and "Use only the category name." | Returns "Billing" capitalized sometimes, "billing" lowercase other times. Router breaks on case mismatch. |
| 3 | Added three paragraphs describing each category in detail. | Output correct on simple tickets. For ambiguous tickets, returns 'billing/technical' instead of a single label. Parser breaks on the slash. |
| 4 | Added "Never return two categories." and "If ambiguous, choose the most likely one." | Works on 80% of tickets. Fails on tickets that could reasonably fit two categories (e.g., 'I was charged but the feature also stopped working'). Here it returns a full explanation instead of a label. |
| 5 | Added two more paragraphs about edge cases and a reminder to be precise. | The verbose prompt is now producing verbose output, over 2,000 characters per call, as long, unfocused prompts tend to produce long, unfocused outputs. The model calibrates response length and style to match the input. Latency has increased significantly due to output length, but accuracy has not improved. |
| 6 | Replaced all instructions with a JSON schema and two few-shot examples showing exact input/output pairs | Returns {"category": "billing"} on every ticket. Parser works. Latency drops. Accuracy on ambiguous tickets matches Pass 4. |

Two distinct failures: **Pass 4 = diagnostic failure** (wrong problem identified — added description instead of a constraint). **Pass 5 = engineering failure** (prompt so verbose it induced a latency regression; the model calibrates output length to input). Both fixed by the same structural move: an output constraint + two few-shot examples. **Rule:** if three re-prompts in a row have not worked, stop adding text and diagnose which technique is missing.

> **Checkpoint 1 · Fix the broken prompt** `[reconstructed]` — The prompt `System: "You are a support ticket processor. Extract the key information from the ticket below."` must return a JSON object with three fields (category, urgency, one-sentence summary). **The one defect: no output constraint** — the prompt never names the shape, field names, allowed values, or "return only JSON." Diagnostic table row 1. **Corrected system prompt:** *"You are a support ticket processor. Extract information from the ticket and return only a JSON object with exactly these fields: `category` (one of BILLING, TECHNICAL, ESCALATION), `urgency` (one of low, medium, high), and `summary` (a one-sentence string). Return only the JSON object, no other text."* (Optionally add a few-shot `<sample_input>`/`<ideal_output>` pair to lock casing.)

---

## 2. Extended Thinking — turning reasoning on, calibrating effort, reading it back

**Core idea:** prompting shapes *what* Claude produces; extended thinking shapes *how much work* Claude does before answering. Turn it on and the model writes step-by-step reasoning first, then the final answer. Your job: decide when the extra work is worth the cost, and handle the reasoning it sends back.

**Mechanics.** The reasoning comes back as its own **thinking block**, positioned just ahead of the answer block. On the newest models the thinking block's content is **omitted by default** — request a readable summary through the display setting to see it. Reasoning is **adaptive**: enable with the `thinking` parameter (where not already on) and the model decides how much reasoning each request needs. Tune depth with the **effort setting**, not a fixed token budget. The older `budget_tokens` control is **deprecated** and returns a **400 error** on the newest model generations. Reasoning is not free — **thinking tokens cost the same as output tokens**, so a simple task at high effort pays for accuracy you don't need. Match the tool to the task; don't reach for thinking by default.

**When to use extended thinking:**

| Task shape | Extended thinking call | Reason |
|---|---|---|
| Multi-step reasoning where the model has to hold several constraints at once: a math derivation, a multi-hop logic problem, planning a sequence of dependent actions. | Enable it, with the effort level matched to the depth of the problem. | The reasoning pass is where the model works through dependencies it would otherwise skip. |
| Mechanical or lookup tasks: classification, format conversion, extracting a field, short factual answers. | Leave it off. | Extended thinking will not improve the answer, and you will be paying more tokens for something you didn't need. A bare prompt with an output constraint is the right tool. |
| Agentic loops where the model plans across several tool calls. | Enable it and budget for the planning step rather than per call. | Reasoning before a plan reduces wrong-tool selection downstream. Note the carry-back rule below, which applies in every tool-use loop. |

**The carry-back rule — thinking blocks must return to the API unchanged.** When thinking is on *and* the conversation uses tools, every thinking block you get back must go back to the API **exactly as it arrived** on the next turn. Each block carries a **signature** confirming the reasoning wasn't tampered with; edit, summarize, or drop it and the signature stops matching and the API rejects the request. **Redacted thinking blocks** work the same way — contents are encrypted, not meant to be human-read, but must still be returned untouched. This is a structural requirement, not a prompting choice. The most common slip-up is **stripping the thinking block to save context**, which breaks the next request. If accumulated reasoning is the real worry, the fix is the context-engineering work later in this module.

*Forward pointer:* this lesson enables reasoning and calibrates effort; it does **not** cover model selection. Choosing *which model to run* (distinct from whether to enable reasoning) is taught in the **MSO Foundations** module that precedes this one.

**Cost · Complexity · Risk:**
- **Handles well** — hard reasoning and planning tasks where a wrong answer is expensive and the extra tokens buy accuracy.
- **Adds cost or complexity** — the carry-back requirement in tool-use loops, and an effort setting you now must calibrate.
- **Use a different approach** — for classification, extraction, and format tasks, a well-constrained prompt is cheaper and just as accurate.

> **Checkpoint 2 · Decide when extended thinking earns its cost** `[reconstructed]` — Match each task to its call:
> - *Classify 50,000 support tickets into three labels overnight* → **Leave it off** (mechanical/lookup; thinking adds token cost for no accuracy gain).
> - *Plan a multi-step refactor where each step depends on the previous one* → **Enable it, budget for the planning step** (multi-step dependent reasoning is exactly the case thinking helps).
> - *Strip the thinking block out of conversation history to save context before the next tool call* → **Never do this** (violates the carry-back rule — the signature stops matching and the API rejects the request).

---

## 3. Tool-use & Schema Design — the loop, message blocks, schema anatomy

**Core idea:** with tool-use you stop steering language toward a good answer and hand Claude a set of actions, trusting it to pick the right one — and **that pick is driven almost entirely by what you wrote in the schema.**

**How the tool-use loop works.** The most common misconception is that *Claude runs the tools.* It does not: Claude reads your tool definitions, decides which fits, and tells your application what to call plus the inputs. **Your application executes the tool, gets the result, sends it back**, then Claude continues. The loop is **not automatic** — if your app doesn't handle the return correctly, Claude never gets the data and the loop breaks. The boundary between what Claude owns and what your code owns is where most tool-use bugs live. Sequence: **1** Define schema → **2** Send message → **3** `tool_use` block → **4** Execute tool (this is the step your code must complete) → **5** Return result → **6** Claude continues. *If the miss is systematic, the fix is in the schema-definition step.*

**Message block structure.** A tool-use conversation is built of structured blocks, not plain text. Four block types do the work:

| Block type | Role | Contains | Critical rule |
|---|---|---|---|
| text block | Assistant/Claude | Claude's prose output | Claude may return a text block alongside a tool_use block in the same turn. When it does, your code must preserve the full content array, including the text block, when appending that turn to conversation history. Dropping the text block corrupts the context Claude relies on for follow-up turns. |
| tool_use block | Assistant/Claude | The tool name, a unique ID, and the input arguments Claude wants passed to your function | Every tool_use block must be answered by a tool_result block in the immediately following user turn. The tool_result must carry the same ID. Without that pairing, the API rejects the next request. |
| tool_result block | User | Matching tool_use ID, the result content, and an optional is_error flag set to true when the tool call fails | The tool_use_id value must match the original tool_use block exactly. Claude uses this ID to connect each result back to the call that produced it, which matters when a single assistant turn issues multiple tool calls and the results arrive in a different order. |
| thinking block | Assistant (extended thinking only)/Claude | Claude's internal reasoning, visible only when extended thinking is enabled | The block must be passed back to the API unchanged in subsequent turns. The signature verifies the reasoning hasn't been modified, so any edit or summary breaks the signature and the API rejects the message. Redacted thinking blocks follow the same rule: pass them back as received, even though the content is encrypted and not human-readable. |

**The critical invariant:** every `tool_use` block from an assistant turn must have a corresponding `tool_result` block in the **immediately following** user turn. Missing results, or results in a later turn, cause an API validation error. *Convention:* `tool_result` blocks are always sent in the **user role** even though your application generated them — `role` marks who is sending the message, not who authored the content.

**Schema anatomy — what Claude reads to select a tool.** Three parts: `name`, `description`, `input_schema`. **The description determines whether Claude selects correctly.**
- **Name** — short, specific: `get_account_balance` beats `get_data`.
- **Description** — the critical part. Write in **two parts: when to and when not to use** the tool. "use this to find information" causes wrong selections (indistinguishable from any other retriever); "use this to retrieve the current balance for a specific account ID and do not use this for transaction history" gives Claude an **exclusion condition**.
- **input_schema** — parameters via JSON Schema. Mark **required** only what Claude needs to call correctly; **optional** where the tool can operate without it. *Overlapping parameter types between tools is the most common source of wrong-tool calls.*

**Schema-design decision table:**

| Decision | How to handle it | Why it matters |
|---|---|---|
| Subtask dependency | When one tool's output feeds the next, the calls have to run in sequence because the second call cannot be built until the first result comes back. When the subtasks are independent of each other, you can structure the tool set so Claude issues multiple tool_use blocks in a single turn and your code runs them concurrently. | This is the one decision that changes how you design the schema. Current Claude models default to parallel calls when calls are independent. Where a real dependency exists, model it as separate turns so the first result is available before the next call is built. Use disable_parallel_tool_use to force one tool call per turn if needed. |
| Required fields | Mark a field as required only when the call doesn't make sense without it. Place these in the required array of the input schema. | Marking everything required forces Claude to fabricate values for fields it has no basis to fill in. The required array is how you tell Claude which inputs are non-negotiable. |
| Optional fields | Use optional fields for parameters with sensible defaults or where absence carries meaning. Leave them out of the required array and give them defaults in the function signature. | Optional fields let Claude omit information it doesn't have, instead of guessing. If a field is optional but marked required, every call must invent a value, which can cause bad inputs. |
| Description length | Write three to four sentences per tool covering what it does, when Claude should reach for it, and what it returns. Include examples of valid inputs where format matters. | If the description is too short, Claude guesses because there isn't enough signal to distinguish your tool from others. If the description is too long, the trigger conditions get buried under detail Claude doesn't reference at decision time. |
| Overlapping parameter types | When two tools accept the same parameter shape, add disambiguating language to each description that names the domain or trigger the tool is meant for. | Claude routes on name plus description, with parameter types as a secondary signal. When signatures are identical, routing collapses to description alone, and similar-sounding descriptions become indistinguishable. |

**Worked example — schema that causes wrong-tool selection, and the fix.** *(Illustrative, constructed to demonstrate the disambiguation principle.)* Two tools `search_knowledge_base` and `get_cached_result`; both descriptions start "use this to find information." Names are distinct but Claude weighs descriptions heavily, so on ambiguous inputs Claude frequently selects the wrong tool. Fix — add an exclusion sentence per description:

```
search_knowledge_base: "Use this to search the knowledge base when the user asks a question that requires looking up current information. Do not use this if the result of a prior search in this session already covers the question."

get_cached_result: "Use this to retrieve a result that was already fetched during this session. Only use this if search_knowledge_base was called earlier in this conversation for the same query."
```

The exclusion conditions give Claude a decision rule. *These rely on complete conversation history being passed each request — if prior turns are truncated, the exclusion logic silently fails.* Every additional registered tool increases reasoning surface, so this discipline only pays off when the underlying tools are distinct.
- **Handles well** — routing to the right tool reliably when descriptions are specific and exclusion conditions are stated.
- **Poor fit** — two tools that do similar things and need ever-longer descriptions; **merge them into one tool with a `type` parameter** instead.

**MCP — when someone else has already written your tools.** The **Model Context Protocol** is a standardized communication layer that moves tool definitions and execution out of your app code into dedicated servers. When an MCP server exists for the service you want (e.g. GitHub — repos, PRs, issues, projects), connect to it instead of writing and maintaining a schema + execution function for every operation. **The loop does not change:** Claude issues a `tool_use` block, your app executes and returns a `tool_result`, pairing rules still apply. What changes is setup — your MCP client sends a `ListToolsRequest`, receives the tool list, and passes definitions to Claude; from Claude's side they're indistinguishable from hand-authored tools.
- **Context cost:** MCP servers add tool definitions to the context window **even when unused**. Connect several servers at once and definitions consume budget before the first message. Register only servers you're actively using; check context cost against the window limit.
- **API MCP Connector:** control loading via an `mcp_toolset` object in the `tools` array. Its `default_config` block applies to every tool on the server; override per tool via `configs` keyed by tool name. Two settings matter: **`defer_loading`** (boolean) delays loading a tool definition until needed (reduces upfront cost for large tool lists); **`enabled`** (boolean) turns individual tools on/off (register a server but expose only some tools). Requires the **`mcp-client-2025-11-20`** beta header — without it, the `mcp_toolset` config won't apply.
- **Transports:** **stdio** for local servers (your app spawns the server as a subprocess over stdin/stdout); **Streamable HTTP** for remote servers (POST client→server, optional GET-based SSE for server-initiated messages). An older SSE-only transport is deprecated. **The API MCP Connector only supports remote HTTP-exposed servers**; stdio servers require managing the MCP client yourself via the SDK (local stdio servers require Claude Desktop or Claude Code as the client).

*Decision guidance:* **Use MCP** when a well-maintained server already covers the operations you need. **Write schemas manually** when no server covers your use case, or you need precise control over scope/description quality a general-purpose server doesn't provide (note the Connector supports allowlist/denylist per server via MCPToolset, so scope alone may not require manual authoring). **Use both** — connect for breadth, then apply description-tuning to the specific tools you route to; narrowing the tool set and sharpening descriptions are two separate levers.

**⚠ Watch Out — "the description that sent Claude to the wrong tool."** *(Composite dialogue.)* A developer has debugged wrong tool selections since morning: `search_docs` (description "Use this to find information about the product.") kept firing when the answer was already in context (`get_context_summary`: "Use this to retrieve relevant information from the current session."). A senior developer names it: *"Those descriptions are the same thing from Claude's perspective. Both say 'find information.' One of them needs to say when not to call it."* The fix is two sentences per tool — one saying when to use it, one saying when not — on **both** tools, not just one. If descriptions can't be cleanly separated even with exclusion conditions, merge into one tool with a `type` parameter.

> **Checkpoint 3 · Spot and fix the schema bug** `[reconstructed]` — Trace: Turn 2 assistant issues `tool_use` `id="toolu_01"`; Turn 3 user sends `tool_result` `tool_use_id="toolu_02"`; Turn 4 API error: *"tool_result block references unknown tool_use_id."* **Rule broken:** every `tool_use` block must be answered by a `tool_result` carrying the **same ID** in the immediately following user turn — here the IDs don't match. **Correct fix = option B:** correct the `tool_use_id` on the `tool_result` block to match the id issued in the assistant turn (`toolu_01`). *(A — exclusion condition — and C — required array — address different failure modes and don't fix an ID mismatch.)*

---

## 4. Streaming Responses — handling partial output without corrupting state

**Core idea:** streaming sends the response in pieces as the model generates them, so it feels faster — but it gives your code a new job: **assemble the final content yourself from a series of events, and be ready if the series stops early.** The message you end up with is identical to a non-streamed call; the difference is you assemble the pieces and decide what to do if events stop before the message finishes. Nothing is holding a live object open — each event is its own small message describing a single change; your handler applies each event to the partial state it's building.

**The event sequence:**

| Event | What it signals | What your handler does |
|---|---|---|
| message_start | A new message is beginning. Carries the message shell with empty content and initial usage. | Set up an empty content array to collect blocks in. |
| content_block_start | A new content block is opening, with its type (text, tool_use, or thinking) and index. | Make a slot at that index for the named block type. A tool_use block opens with its name and id, but no input yet. |
| content_block_delta | An incremental piece of one block: a text fragment, a fragment of JSON input for a tool call, or a thinking fragment. | Append the fragment to the block at that index. Tool-call inputs arrive as a partial JSON string spread across several deltas, you can't parse them until the block closes. |
| content_block_stop | The block at this index is complete. | Finalize the block. For a tool_use block, this is the first moment the accumulated JSON input is complete enough to parse. |
| message_delta | Top-level changes to the message: the stop_reason and final usage counts. | Record the stop_reason. It tells you whether the model finished or stopped for some other reason. |
| message_stop | The stream is complete. | The assembled content array is now the finished message. From here, treat it exactly like a non-streamed response. |

**The rule that keeps state from corrupting: don't act on a partial block.** The `tool_use` block is the one to watch — its input arrives as partial JSON across many `content_block_delta` events and isn't valid JSON until `content_block_stop`. Parse or run the tool before the block closes and you choke on malformed JSON or run with half the arguments. **Collect the deltas, act only after `content_block_stop` for that block.** Same discipline for history: **add a streamed assistant turn only after `message_stop`, every block fully assembled.** A turn built from a cut-off stream is incomplete, and the tool_use pairing rules will reject your next request if a half-built `tool_use` block ends up in history.

**When the stream stops early** (dropped connection, timeout, client disconnect before `message_stop`): the failure that bites is treating whatever you collected as complete. A partial text block shown to a user is cosmetic; a partial `tool_use` block written into history is structural and corrupts the next turn.
- **Track completion on purpose** — a turn is usable only once `message_stop` arrives; until then treat accumulated content as provisional.
- **On interruption, throw away the partial assistant turn** instead of saving it, then retry the request.
- **Check `stop_reason` from `message_delta` before continuing a loop** — `tool_use` means your assembled tool calls are ready to run; any other value means a different path.

**Cost · Complexity · Risk:**
- **Handles well** — long responses and user-facing interfaces where showing output as it generates removes the blank-screen wait.
- **Adds cost or complexity** — you assemble blocks yourself, must not act on partial blocks, and must handle mid-stream interruption explicitly.
- **Use a different approach** — for short responses or backend jobs where no one is waiting, a non-streamed call is simpler and removes partial-state risk entirely.

**⚠ Watch Out — "the stream that left a half-written tool call in the history."** *(Postmortem.)* An agent streamed so operators could watch responses generate. The handler appended the assistant turn to history **when its read loop ended.** On a fast local connection streams always ran to `message_stop`, so stored turns were always complete. In production a network blip ended one stream after the `tool_use` block opened and received part of its JSON, but before `content_block_stop`. The read loop ended the same way, so the handler appended an assistant turn with a **truncated-JSON `tool_use` block.** The operator retried; the retry included the corrupted turn and the API rejected it. The team spent an afternoon on the schema and retry logic because the error surfaced on the *retry* — but the cause was upstream: *the handler treated "the read loop ended" as equivalent to "the message is complete," and those are not the same.* **Rule:** gate the history append on `message_stop`, discard the partial turn on interruption, retry from the last complete turn; when a tool-use error appears on a retry, check whether the prior turn was assembled from a stream before you touch the schema.

> **Checkpoint 4 · Repair the broken stream handler** `[reconstructed]` — Broken handler:
> ```
> blocks = {}
> stop_seen = False
> with client.messages.stream(model=model, max_tokens=4096, messages=messages, tools=tools) as stream:
>     for event in stream:
>         if event.type == "content_block_start":
>             blocks[event.index] = init_block(event)
>         elif event.type == "content_block_delta":
>             apply_delta(blocks[event.index], event.delta)
>         elif event.type == "message_stop":
>             stop_seen = True
> messages.append({"role": "assistant", "content": assemble(blocks)})
> ```
> **Defect:** `stop_seen` is set but never used — the handler appends the assembled turn **unconditionally**, so an interrupted stream (which never reaches `message_stop`) commits a half-built turn to history and the *next* request fails validation. **Corrected version:** gate the append on `stop_seen`; on interruption discard the partial turn and retry:
> ```
> if stop_seen:
>     messages.append({"role": "assistant", "content": assemble(blocks)})
> else:
>     # stream interrupted before message_stop: discard the partial turn, then retry the request
>     raise StreamInterrupted   # or: continue / retry from the last complete turn
> ```

---

## 5. Context Engineering — model selection and keeping multi-turn sessions in budget

**Core idea:** you make one early choice — which model runs the workload — which sets the price/speed floor every later decision moves within. Once the model is set, the constraint is the **context window**: the full span of text the model can take in at once (prompt + conversation so far + every tool result). **Every tool result Claude returns is appended to the window and stays for the rest of the session.** Invisible in a single-turn prompt; in a 10–20-tool agent session the window fills fast, and once full the agent either **compacts** (losing detail) or **stalls** before the task is done. Deciding in advance what enters the window, what comes back as a summary, and what never enters is **context engineering.**

**Model selection — start with Sonnet, move deliberately.** The Claude family currently spans four tiers: **Fable, Opus, Sonnet, Haiku**, each optimized for different cost/latency/capability tradeoffs. **Sonnet** is the balanced default for most production workloads. **Haiku** is built for speed and cost efficiency on tasks in its envelope. **Opus** handles demanding work above the Sonnet envelope. **Fable** is Anthropic's most capable model, for the most demanding tasks (complex reasoning, advanced coding, research synthesis, sophisticated agentic workflows where maximum intelligence is the priority). Move **up to Opus** only when an eval set says Sonnet misses your quality bar; move **down to Haiku** only when an eval set says the quality regression is acceptable *for your task* — not just to save cost. Every model move is a **measured** decision. *Confirm the current lineup and identifiers against `platform.claude.com/docs` at build time.*

**The context window is not a free resource.** Every message, tool result, injected document, and generated response occupies the window. If a request is already larger than the window, the Messages API **rejects it with a validation error before generation**; if a request fits but generation reaches the ceiling partway, current models **return the output generated so far with a `model_context_window_exceeded` stop reason.** Neither path silently truncates your oldest content — if you want a session to run past the limit, your application must trim or summarize history itself. In dev the window rarely fills (small inputs, short sessions); in production **tool outputs are often 3–5× longer than test fixtures**, sessions run more turns, and the window fills at turn eight rather than turn fifty. The cost of not planning: a production outage.

**Four strategies for staying in budget:**

| Strategy | What it does | When to apply | What continuity you lose |
|---|---|---|---|
| **Pruning** | Lets you jump back to an earlier message and continue from there, removing the conversation that came after. | After Claude has gone down an unproductive path or accumulated debugging back-and-forth that won't help the next task. | The work done after the rewind point is gone. If Claude learned something useful in that stretch, it has to relearn it. |
| **Compaction** (`/compact` in Claude Code; server-side compaction in the API, a beta strategy the platform performs for you, with manual summarization as the client-side alternative) | Summarizes the conversation history into a condensed version that preserves the key information Claude has learned. The summary costs fewer tokens than the original turns. | When the session is approaching the context ceiling but you want to keep working on the same feature with the knowledge Claude has built up. | Details can be lost in the summarization. Anything not captured in the summary will not be available to Claude going forward. |
| **Clearing** (`/clear` in Claude Code; new session in API) | Starts a new conversation with empty context. Nothing from the previous session carries forward. | When the next task is completely different from the current one, and previous context would only introduce bias or confusion. | All session context is gone. Anything Claude needs to remember across sessions has to be put somewhere persistent, like a CLAUDE.md file. |
| **Subagent Handoffs** | Spawns a subagent in its own isolated context window with only the task description and system prompt it needs. The subagent does the work and returns a summary. | When a subtask is self-contained enough to delegate, especially exploration work where the journey clutters the main context but the answer is short. | Visibility into how the subagent reached its conclusion. The intermediate steps are discarded with the subagent's context. |

**Two more levers — prompt caching and token counting** (reduce what you pay for what's already in the window):
- **Prompt caching** stores the processing work done on a **stable prefix** so follow-up requests reuse it instead of reprocessing the same tokens. The first request writes the prefix to cache; identical subsequent requests pay a fraction. Strongest candidates: long system prompt, large tool-definition set, a reference document queried repeatedly. Enable by marking a **cache breakpoint** with a `cache_control` field of type **`ephemeral`** on the last block you want cached; up to **four breakpoints.** For multi-turn sessions with a stable system prompt and tool schemas, caching those prefixes once and reusing them is the **highest-leverage cost reduction available.**
- **Token counting** measures context pressure *before* a request goes out. The **`count_tokens`** endpoint takes the same request body as a messages call and returns the token count **without running inference.** Use in dev to verify budget assumptions against real tool outputs (not just fixtures), and in production to gate requests that would exceed the window before they error.

**The three places a RAG path can break:** **chunking**, the **embedding match**, and **assembly** into the prompt.
- **Chunking** decides the unit of retrievable context. Too small → a chunk lacks surrounding context; too large → dilutes the match with unrelated text. Sentence- or section-based chunking with a little overlap is a reasonable default; the overlap keeps facts that cross a boundary retrievable.
- **The embedding match** decides which chunks return, via similarity search — semantically close, not always the exact term you need. A query for a specific identifier can miss the relevant chunk if a more semantically similar result outranks it; this is why a **lexical match is sometimes run alongside** the semantic one.
- **Assembly** must reach the model in the structure the prompt expects, or the model answers from memory instead of the retrieved text.

*Fetch-once (retrieval index) vs. search-across-rounds (agentic search):* the index gives an inspectable, testable system but costs infrastructure (build, store, keep in sync, secure). Iterative search removes that infrastructure and staleness (reads current files at query time) at the cost of more tokens/time per query and less inspectability. For a stable reference corpus with simple lookups, own the index; for a changing corpus or multi-step questions, iterative search is usually the simpler system despite costing more per query. *The reported single-agent agentic-search performance gain over a retrieval index is a version-pinned figure — confirm against the reference layer at build time.*

**Applying compaction — what gets preserved depends on how you write the summarizer.** `/compact` in Claude Code decides for you; the API's documented primary strategy is **server-side compaction (beta)**. When you implement **manual compaction**, you write the summarizer prompt, and that prompt determines what the agent knows next turn:
- *"summarize the conversation so far"* → a general summary that may drop task-critical state (which files were modified, what decision was made at a branch point, what error was encountered and resolved).
- *"summarize the conversation, preserving all file paths modified, all decisions made, and any errors encountered and their resolutions"* → a summary the agent can use.

*Task-critical state loss from an under-specified summarizer is one of the most common sources of multi-session agent failures.*

**Subagent handoffs — managing long-horizon tasks.** When a task is too large for one window, **increasing the window is not the solution** — decompose and pass only relevant context to each subagent. A subagent receives a scoped task and the minimum context it needs (relevant prior results, the tools to complete its task, clear exit conditions); the parent collects results. Keeps per-turn cost low and long-horizon tasks tractable. Like compaction and pruning, apply only where context cost is a real constraint.
- **Handles well** — multi-step agent sessions that exceed the token budget and need decomposition; best designed at the architecture stage, not patched in as a production fix.
- **Use a different approach** — pipelines that never approach the window limit; measure actual token usage against the model's context limit before adding management overhead.

**⚠ Watch Out — "the session that ran fine in development, then hit a ceiling in production."** *(Postmortem.)* An agent processed sales receipts under a **40k-token budget cap** (a cost control the team imposed on the agent's context, not the model's ceiling — current Claude API models carry at least 200k, newest flagships incl. Fable serve 1M by default). Dev used 20 receipts × ~800-token tool results ≈ 18,000 tokens, well within budget. In production receipts carried supporting docs; average tool output grew to ~3,200 tokens; eight turns ≈ 25,600 tokens, and with system prompt + messages the running total hit the 40k cap at **turn eight**, before analysis completed. The symptom **looked like degraded tool selection** — but the real cause was that the system prompt and early instructions had been **crowded out by accumulated, never-pruned tool outputs.**

| | Development | Production |
|---|---|---|
| Context window available | 200k standard, 1M on current Opus and Sonnet | 200k standard, 1M on current Opus and Sonnet |
| Team budget cap | 40k tokens | 40k tokens |
| Avg. tool output | ~800 tokens per call | ~3,200 tokens per call |
| Turns before window fills | Sessions completed without reaching the cap | Cap reached at turn 8 |
| Observed symptom | None. Sessions complete cleanly | Wrong tool selections and incomplete outputs starting turn 8 |
| Root cause identified by | Not applicable | Token usage audit, two days after deployment |
| Fix | Not applicable | Prune tool outputs after use, and apply compaction proactively before the cap is reached |

**Rules:** measure the actual token cost of a tool result against the **largest input you can find** before shipping; if tool selection degrades after a fixed number of turns, **check whether the window is filling before debugging the schema.**

> **Checkpoint 5 · Diagnose the context failure** `[reconstructed]` — Trace: turns 1–4 correct `fetch_policy_document` calls (2,400 tokens each); turn 5 wrongly picks `search_knowledge_base` instead of `apply_coverage_rule`; turn 6 repeats the wrong pick; turn 7 ends without result. **Failure triggered at turn 5**, caused by the **four large tool results (9,600 tokens) accumulated over turns 1–4 crowding out the instructions** that tell Claude which tool to use next (context-overflow masquerading as tool-selection failure). **Correct fix = option B:** prune `fetch_policy_document` results after each turn so accumulated outputs don't crowd out current instructions, and apply compaction before turn 5. *(A — clearer description — and C — larger `max_tokens` — treat the symptom, not the window-fill mechanism.)*

---

## 6. Agent Construction — the loop, wiring paths, orchestration, HITL

**Core idea:** an agent is a **multi-step tool-use loop with managed context and a defined goal.** You've built the pieces (schemas, context management); this section connects them and adds what neither covers alone. When components run together across turns, new failure modes appear: routing decisions compound, context fills faster, a step gets the wrong input because an earlier call was structured wrong. **The question that should precede every agent build: does this problem require an agent?** Agents carry coordination overhead, expanded context cost, and more failure surface than simpler patterns.

**Workflow or agent — decide before the first line:**

| Choose a workflow when… | Choose an agent when… |
|---|---|
| You can enumerate the exact steps in code. | You can specify the goal and the tools but not the exact path. |
| Error cost is real and step-level guardrails matter. | The path through work cannot be enumerated in advance. |
| Observability with standard tooling is required. | Non-determinism is acceptable and the agent's possible actions are constrained by its registered toolset. |
| The inputs are well-constrained to a known set. | User inputs vary unpredictably in content and structure. |
| Every execution of the task follows the same sequence. | The task requires creative sequencing of available tools. |

*Using an agent where a workflow suffices adds behavioral complexity without capability; using a workflow where an agent is needed breaks whenever input deviates from the predetermined path.*

**The agent is the pattern; the wiring path is an implementation choice.** Once the task needs an agent, you've decided on a **loop that calls tools, manages context, and runs until a goal is met** — constant across all three wiring paths for single-agent systems. (Multi-agent architectures — planner/executor/evaluator handing off through structured artifacts — add design decisions beyond the loop and are covered later in the track.) What changes is **how much of the loop you write yourself vs. hand to a library or hosted service.**

**Three wiring paths** *(ordered by how much infrastructure you hand off; choose on deployment/compliance constraints, not prototype speed):*
- **Raw Messages API loop** — *Who runs the loop:* your code runs every iteration (send request, read tool-use blocks, execute tools, append results). *What you own:* the full loop, tool execution, context management, retries, exit conditions — nothing provided. *Choose when:* you need full control, have constraints a library can't accommodate, or are learning the loop before adding abstraction. *Check first:* maintenance cost is yours — every behavior the SDK gives free (context management, parallel tool handling) becomes code you write and test.
- **Agent SDK** — *Who runs the loop:* the SDK runs the loop inside your own process (iterates, manages context); your code still executes the tools. *What you own:* tool execution and the surrounding application; the SDK provides loop structure, context management, tool registration. *Choose when:* you want the loop/context/tool scaffolding that powers Claude Code without rebuilding it, running in your own Python/TypeScript environment. *Check first:* whether filesystem features like CLAUDE.md and skills load is controlled by the **`settingSources`** configuration — **do not rely on a default**; set it explicitly (e.g. `["user", "project", "local"]` to match Claude Code CLI, or `[]` to run fully isolated). Confirm current default behavior against the Agent SDK reference at build time.
- **Claude Managed Agents** (public beta) — *Who runs the loop:* Anthropic runs the loop and the sandbox; your app sends user events and streams results back over server-sent events. *What you own:* the application layer and the agent definition (model, system prompt, tools, MCP servers, skills defined once, referenced by ID across sessions). *Choose when:* you need long-running execution (minutes–hours), a managed sandbox, or want to avoid building the loop/sandbox/tool-execution layer at all. Also available on Claude Platform on AWS with some feature differences — verify parity. *Check first:* sessions are **stateful and stored server-side**, so **not currently eligible for Zero Data Retention or a HIPAA BAA.** All endpoints require the **`managed-agents-2026-04-01`** beta header; behaviors may be refined between releases — build with a migration plan.

**Managed Agents — what you stop owning, what you take on:**

| Category | What you stop owning | What you take on instead |
|---|---|---|
| Execution & infrastructure | The iteration loop, the execution sandbox, the retries inside the loop, and the tool-execution runtime. Anthropic runs all of it server-side. | An agent definition managed as a versioned API resource, plus an application layer that sends events and consumes the streamed results. |
| Session duration & state | Long-running execution management. Sessions can run for minutes or hours without your process holding the loop open. | Server-side session state. Sessions are stateful and stored by Anthropic, and are subject to its data handling policies and constraints (see the constraint note below). |
| Sandbox lifecycle | Sandbox provisioning and teardown for tool execution. | A dependency on the managed sandbox's available tools and its execution model, rather than your own environment. |

**Choose Managed Agents when:** the task runs long (minutes–hours awkward to hold open in your process); you want a managed sandbox; you'd rather not build the loop/sandbox/tool-execution layer and are willing to define the agent as an API resource. **The constraint that decides it for regulated work:** stateful server-side storage means these sessions **aren't eligible for ZDR or a HIPAA BAA** — if your workload carries PHI or falls under a ZDR requirement, route to the Agent SDK or a raw loop on a covered configuration instead, no matter how well it fits operationally. *Common progression:* prototype on the Agent SDK locally, then move to Managed Agents for production — the definition carries over **conceptually** but the format differs (code/filesystem config vs. versioned API resource); expect a **re-expression step, not a direct export.**
- **Handles well** — long-running agents, and workloads where you'd rather not build/secure a sandbox and loop yourself.
- **Adds cost or complexity** — server-side stateful sessions, an agent-as-resource format, a beta surface that can change.
- **Use a different approach** — for PHI/ZDR workloads, or when you need full in-process control, stay on the Agent SDK or a raw loop on a covered configuration.

**Wiring the loop — four steps that hold across every path:**
1. **Register tools** — each tool follows the same schema structure so Claude knows what's available.
2. **Set the system prompt** — scope it to the agent's task; a broad prompt produces broader, less reliable tool routing.
3. **Handle the tool-use loop** — whether you iterate or the SDK iterates, your code handles execution; every tool call must be executed and returned in a `tool_result` block.
4. **Define exit conditions** — the loop runs until it receives a stop condition; without explicit exit conditions the agent keeps requesting tool calls beyond what the task requires. Define when *done* means done.

**Loop-wiring checklist (verify regardless of path):**

| # | Item | What to verify |
|---|---|---|
| 1 | Tools registered | Every tool the agent may need is in the registration list. No unregistered tools are referenced in the system prompt. |
| 2 | System prompt scoped | The system prompt names the task and the available tools. It does not describe tools the agent does not have. It does not omit tools the agent does have that require scoping guidance. |
| 3 | Tool-use loop implemented | Your code handles every tool-use block Claude issues and returns a tool-result block for each one before the next assistant turn. All tool-use blocks from a single assistant turn must be resolved together. |
| 4 | HITL insertion point defined | At least one point in the loop has a human-in-the-loop check. See the section below for where to insert it. |
| 5 | Exit conditions defined | The loop has a clear stopping criterion that does not depend on Claude volunteering to stop. |

**Human-in-the-loop (HITL) — insertion points.** A HITL checkpoint pauses execution and routes to human review before proceeding. Deciding question: *what is the worst possible outcome if this step runs without a human check?*

| Insertion point | What triggers the check | Risk level it addresses |
|---|---|---|
| Before a destructive tool call | The agent is about to execute a write, delete, or send operation. | High: irreversible actions where a wrong call cannot be undone |
| After a planning step | The agent has generated a plan and is about to begin executing it. | Medium: incorrect plans that would produce the wrong outcome even if all steps execute correctly |
| On unexpected output | The tool result contains an error flag, an empty result, or a value outside expected bounds. | Variable: catches failure modes that retry logic alone will not resolve |

**Tool orchestration — over-tooling and under-tooling.** Routing behavior is shaped by how tools are described *and* how many are registered. Too many overlapping-description tools → erratic routing; too few → the agent hallucinates a path or returns incomplete results. **Over-tooling is the more common production problem** (teams register everything "just in case" and selection quality degrades as the surface grows). **Start with the minimum set required and add tools only when a specific capability gap is confirmed.**

| When agents are the right call | What you take on when you use an Agent | When to choose a workflow instead |
|---|---|---|
| Goal-directed tasks where the exact path cannot be enumerated in advance. Handling variable inputs that would require dozens of conditional branches in a workflow. | Agents add behavioral complexity: the path through the task emerges from the model's reasoning over accumulated context rather than from explicit branching logic in your code. Observability requires transcript-level tooling rather than standard operational logging. | When you can enumerate the steps in code, use a workflow. Agents are the last step in progression. Start with the simplest pattern that solves the problem, a single API call, then a workflow, then an agent. And move up only when the simpler pattern cannot handle the variability the task requires. |

**Regulated-data constraints set your delivery route and credentials before you write the wiring.** If data needs specific handling (attorney-client privilege, HIPAA, GDPR, FedRAMP, internal data-residency), that constraint decides which endpoint your code calls, which credentials it carries, and where its logs land — *before* any prompt/tool/memory choice. As a developer you usually don't pick the surface, but you write the code that targets an endpoint, attaches credentials, configures the region, and emits logs. Get the governing constraint named at the start — the wrong client configuration is far more expensive to undo after wiring than to set correctly the first time.

| Constraint | What it tends to rule out in code | What usually survives a code review |
|---|---|---|
| Attorney-client privilege | Calls from a consumer-grade Claude.ai surface that the firm cannot audit end-to-end. Code paths that send privileged document content to any endpoint the firm has not approved for privileged material, regardless of how the prompt or system message is structured. | Direct API or SDK calls from inside the firm's own application, authenticated via SSO, routed through a firm-approved LLM gateway with full request and response logging. Note that Anthropic's native Compliance Conversation content (prompts, responses, and tool call payloads) is not captured by Anthropic by default on direct API traffic, so the organization must implement conversation logging in the application layer and route it to an approved log destination. Tool calls and tool results stay inside the audited path. Confirm the final logging design with your Anthropic account team. |
| HIPAA (PHI handling) | Code that sends Protected Health Information to any endpoint or delivery route not covered by a Business Associate Agreement for the specific configuration in use. This includes any logging or retention path your code writes to that has not been scoped under the same BAA. | Direct API or SDK calls on a BAA-covered configuration. BAA coverage for Anthropic first-party API access is arranged with Anthropic, which provisions a dedicated HIPAA-enabled organization that enforces feature restrictions on its own end. Confirm the covered configuration with your Anthropic account team. An alternative is a cloud-mediated route via AWS Bedrock or GCP Vertex on the partner's existing HIPAA-eligible cloud account. Note: the BAA does not cover Console, Workbench, beta features, or consumer plans. Not all API features are covered under the BAA, verify the current feature eligibility list in Anthropic's Implementation Guide before configuring. |
| GDPR and data residency | Delivery routes where the region of model execution cannot be pinned in code, or where the request can be served from a region outside the approved geographic boundary. Defaulting to a global endpoint without specifying region is the common pattern that breaks here. | A cloud-mediated route such as Bedrock or Vertex, with the region pinned in the client configuration to a covered jurisdiction. The direct Anthropic API is a separate case; it does not currently provide EU data residency, so partners with EU data residency requirements should route through Bedrock or Vertex rather than calling the API directly. |
| FedRAMP and government | Any code path that calls an endpoint not on an authorized cloud environment at the required impact level. This includes development and test paths that hit the commercial endpoint while production hits the authorized one, because credentials and code patterns leak between them. | Three authorized routes exist as of publish time. Claude for Government (C4G) carries a direct FedRAMP High authorization held through Palantir Federal Cloud Service – Supporting Services (PFCS-SS). Claude via Amazon Bedrock GovCloud is approved for FedRAMP High and DoD IL4/5 workloads. Claude via Vertex AI Assured Workloads is also FedRAMP authorized. Claude Enterprise on AWS Marketplace is not FedRAMP authorized, so teams requiring FedRAMP compliance must use one of the three routes above. Verify current authorization status at trust.anthropic.com before configuring. |
| Internal data-residency policy | Calls from any SDK client configured against a cloud vendor outside the partner's approved list, regardless of whether the underlying technical capability would support the workload. Procurement-level constraints rule the code path out before engineering preferences enter the conversation. | The delivery route on the partner's approved cloud vendor. In code terms, that is whichever SDK client and endpoint configuration their CIO has already cleared. Build against that one rather than switching mid-project because another route looks easier. |

*SOC 2 is out of scope here* — it governs how your systems are built/operated, not which endpoint your code calls; covered in Module 4. *Forward pointer:* Module 4 (Production Engineering, Evals & Security) goes deep on secure-by-design IAM/privacy, prompt-injection defenses, runtime guardrails, and agent hardening; this section's narrower role is to surface the constraint at the point in the build where it rules options out — endpoint, SDK client configuration, and credentials.

**⚠ Watch Out — "the agent that edited a production file."** *(Postmortem.)* An agent could read/modify/write config files via `read_file`, `write_file`, `validate_config`; its loop re-ran `validate_config` after each write and adjusted up to a **ten-iteration cap.** Tested in a scratch directory, it converged in 2–3 iterations on every case. In the customer environment it correctly flagged an out-of-range parameter, wrote the fix, validated pass, and **terminated cleanly after a single iteration — exactly as designed.** But the parameter was a **rate limit the customer's application relied on**; `validate_config` checked only the schema's allowed range, not whether **downstream systems depended on the old value.** Within minutes the customer's app failed on throttled requests. The loop did exactly what was asked; **the exit condition (`validate_config` returns pass) was scoped to the file being edited, with no checkpoint between "validation passed" and "write committed to the customer environment."** The design question never asked: *"What is the worst outcome if `write_file` runs without a human check?"* **Rule:** if a tool can take an irreversible action in production, it needs a checkpoint **before** it runs — register that constraint during design, when scoping the tool surface, not after the first incident.

> **Checkpoint 6 · Complete the agent wiring** `[reconstructed]` — Fill the two gaps in a two-tool agent (`read_record`, `update_record` with required `customer_id`, `field`, `new_value`):
> - **Gap 1 — description for `update_record`:** *"Use this to update a single field on an existing customer record identified by `customer_id`, setting `field` to `new_value`. Do not use this to read a record — use `read_record` for that. Only call this once the new value has been confirmed; this is a write to the live customer record."* *(3–4 sentences, states what it does + when-not exclusion vs. `read_record`, per the schema-design table.)*
> - **Gap 2 — HITL checkpoint before executing `update_record`:** insert a human-approval gate before the write (per the HITL table, "before a destructive tool call"):
> ```
> if block.type == "tool_use":
>     if block.name == "update_record":
>         if not request_human_approval(block.input):
>             tool_results.append({
>                 "type": "tool_result",
>                 "tool_use_id": block.id,
>                 "content": "Update rejected by human reviewer.",
>                 "is_error": True
>             })
>             continue        # skip execution of the rejected write
>     result = execute_tool(block.name, block.input)
>     ...
> ```

---

## 7. Agent Memory — choosing the right scope for state that survives sessions

**Core idea:** the agent from the previous section runs correctly within one session but remembers nothing when the session ends. **Memory scope** decides what the agent knows at the start of the next session, and how much it costs to carry that knowledge forward. *(The blueprint groups several agent design patterns under this objective, all built earlier in this module: the tool-use loop; multi-step task decomposition; planning-and-execution — the same split the HITL "after a planning step" check guards. Memory scope is the pattern that decides what state survives once the loop ends.)*

**Two opposite failure modes:**
- **Too much state in-context** inflates every API call — the model re-reads the full conversation each turn and the bill scales with session length.
- **Too little state in persistent storage** strips memory across sessions — anything not written down disappears when the conversation ends.

**Memory-scope table:**

| Scope | What persists | Cost | When to use | What you lose |
|---|---|---|---|---|
| **In-context memory** | State lives in the active conversation and survives turns within a single session. | Zero retrieval overhead; inflates token cost as conversation grows | Short sessions where all the state the agent needs fits inside the context window and nothing has to carry across restarts. | Everything once the session ends. A clear command or a new session wipes the state. |
| **External storage** | State is written to a database and read back at session start or on demand. | Each database call adds retrieval latency, and you take on the engineering work of read and write logic. | State that has to survive across sessions, move between users, or be shared across multiple agent instances. | Nothing on the persistence side. The cost shows up as latency on every call and ongoing implementation complexity. |
| **Summarized memory** | A condensed version of prior conversation is generated and injected at the start of the next session. | Lower token cost per session than replaying full history, but the summarization step drops detail that was in the original. | Long-running conversational agents where the full history would outgrow the context budget before the conversation is done. | Any detail the summarizer did not preserve. The agent only sees what the summarization prompt chose to keep. |
| **No persistent memory (stateless)** | Nothing. Each session is independent. | No overhead at all, since there is nothing to retrieve or store. | Task-execution agents that finish and close out, or pipelines where every session is fully independent by design. | All prior context. If a follow-up depends on something from an earlier session, the agent has no way to reach it. |

**Choose memory scope at design time, not the production refactor.** An agent helping the same user across multiple days needs to carry state (store summaries/full history outside the window); an agent that does a single job and closes out runs **stateless.** The default path — store full history in the `messages` array, send on every call — works for a while, then token cost scales with every turn, latency climbs, and a long session hits the hard limit and stops responding. The refactor (pull state out of live context → external storage → add only what each turn needs) is **mechanical** (a few hundred lines + a database the team has), but it happens **under production pressure with a deadline in motion.** Making the call at design time is **cheap** (~20 minutes); doing it at refactor time is expensive (~1 hour+ under pressure).
- **Handles well** — memory scope matches the task at design time (external for cross-session threads; stateless for self-contained jobs; in-context for short sessions that needn't survive a restart).
- **Adds cost or complexity** — external storage adds retrieval latency + read/write logic; summarized memory depends on a well-specified summarizer prompt or task-critical state is dropped on every compression.
- **Use a different approach (the wrong-choice trap)** — holding all state in-context assuming the window is big enough; token cost grows every turn (full context sent each call); without caching/compaction, long sessions accumulate cost faster than teams expect. Measure actual session token usage against the window limit before committing.

**Skills — reusable instruction sets that load on demand.** A related-but-distinct problem: carrying repeatable *instructions* across tasks without paying to inject them into every session. A **Skill** is a reusable markdown file that teaches Claude a specific kind of task once; Claude loads it **automatically when a request matches its description.** A Skill lives in a **`SKILL.md`** file in an identified directory, with a **frontmatter block (name + description)** and instructions below. **The description is the matching criterion** — Claude reads the name+description of every available Skill, compares against your message, and loads the full instructions only on a match; irrelevant instructions never enter the window. *Contrast:* in-context memory is always present and grows every turn; **CLAUDE.md** loads into every session in the Claude Code CLI (in the Agent SDK, whether it loads is controlled by `settingSources` — set explicitly). A Skill loads only when the task calls for it, in both environments.

| Pattern | When it loads | Context cost | Best for |
|---|---|---|---|
| **Skill (SKILL.md)** | On demand when request matches skill's description | Low. Only the name and description load at startup; full content loads only on match | Task-specific expertise that should not inflate sessions where it is not needed. Examples include domain-specific output formats, specialized review checklists, and workflows that apply to a subset of tasks rather than every interaction. |
| **CLAUDE.md** | Every session, unconditionally | Fixed overhead per session regardless of task | Always-on project standards that apply to everything. Examples include coding conventions the team has standardized on, output format rules the project requires, and constraints that hold across all tasks in the codebase. |
| **In-context instructions** | Present for every turn within that session | Grows with session length; does not survive session end | Short sessions where the full history fits within the window and nothing needs to persist. Examples include one-off exploratory work and tasks scoped to a single conversation. |

**Current availability — Skills on the Messages API:** available today but the integration is **in beta** and configured differently from the Claude Code / Agent SDK paths. Two beta headers are required: **`code-execution-2025-08-25`** and **`skills-2025-10-02`.** Skills invoked this way run **inside the code-execution container** rather than the calling app's environment (implications for tool/filesystem access). Beta headers are versioned and change toward GA — check current docs for header values, GA status, and whether the code-execution container is still the runtime path. **One important constraint: subagents do not automatically inherit Skills from the parent session** — a delegated subagent starts with clean context. Skills and conversation history do **not** carry over, but subagents **do inherit the permission context** from the parent (permission scope is not reset at delegation). If a subagent needs a Skill, list it explicitly in the subagent's configuration.

**⚠ Watch Out — "the agent that filled the window on session four."** *(Postmortem.)* An agent assisted a support engineer with ongoing escalation cases. Dev ran continuous 10–15-turn sessions where in-context state held full history correctly; the developer shipped without measuring per-session token usage. In production each session was shorter but **state accumulated across sessions** — by session four the injected in-context history exceeded 40,000 tokens *before* the agent processed a single tool call, and with system prompt + tool schemas over 45,000 tokens were consumed before the first productive turn. As tool calls accumulated, the budget ran out before analysis completed; the agent returned incomplete results — **a symptom that first looked like a tool-selection failure rather than a memory-architecture problem.** The fix was a **one-hour refactor to external storage** (persist accumulated history to a DB, inject only the relevant subset at session start), which took far longer under production pressure than it would have at design time. **Rule:** dev used a single long session; production used many short sessions with accumulated state — different shapes that in-context memory handles differently. **Measure expected per-session state (history + system prompt + tool schemas) against the context limit before choosing in-context as the default.**

> **Checkpoint 7 · Choose the right memory pattern** `[reconstructed]` — Match each use case to its scope:
> - *A customer support agent assists the same user across daily check-ins over two weeks; each session starts where the previous left off* → **External storage** (state must survive across sessions — write to a database at session end, read back at session start).
> - *A document formatter receives a file, applies a transformation, returns output, and terminates; each job is fully independent* → **No persistent memory (stateless)** (self-contained job with no prior session to recall).
> - *A coding assistant works with a developer across a multi-hour session that will not continue after it ends* → **In-context memory** (all state fits in one session; nothing needs to survive a restart).

---

## Cumulative Debug Task — four planted bugs, one per layer (Identify + Fix)

**Brief:** the agent program below has **four planted bugs**, one in each of four layers — the **schema layer**, the **streaming layer** (response assembled and committed), the **context layer** (message structure built), and the **memory layer**. Stage 1: identify each (name the layer + one sentence on what it causes at runtime). Stage 2: write the corrected version.

```
# --- TOOL DEFINITIONS ---
tools = [
    {
        "name": "get_customer_data",
        "description": "Gets data.",
        "input_schema": { "type": "object", "properties": { "id": {"type":"string"} }, "required": ["id"] }
    }
]

# --- AGENT LOOP ---
def run_agent(user_request, session_history):
    messages = session_history + [{"role":"user","content":user_request}]
    while True:
        blocks = {}
        stop_seen = False
        with client.messages.stream(
            model=model, max_tokens=4096, tools=tools, messages=messages,
            thinking={"type": "adaptive"}
        ) as stream:
            for event in stream:
                if event.type == "content_block_start":
                    blocks[event.index] = init_block(event)
                elif event.type == "content_block_delta":
                    apply_delta(blocks[event.index], event.delta)
                elif event.type == "message_stop":
                    stop_seen = True
        assistant_content = [b for b in assemble(blocks) if b["type"] != "thinking"]
        messages.append({"role": "assistant", "content": assistant_content})
        response = finalize(blocks)
        if response.stop_reason == "end_turn":
            return response
        for block in response.content:
            if block.type == "tool_use":
                result = execute_tool(block.name, block.input)
                messages.append({"role":"user","content":[{"type":"tool_result",
                    "tool_use_id":block.id,"content":result}]})

# --- MEMORY ---
def build_session_history(prior_sessions):
    # Concatenating all prior session transcripts in-context
    full_history = []
    for session in prior_sessions:
        full_history.extend(session["messages"])
    return full_history
```

**Stage 1 — Identify each bug** `[reconstructed]`:
1. **Schema layer** — `get_customer_data` description is `"Gets data."` (too vague, no when/when-not). At runtime Claude can't reliably distinguish this tool from others, producing wrong or unreliable tool selection.
2. **Streaming layer (assemble & commit)** — the assistant turn is appended **unconditionally after the read loop exits**; `stop_seen` is set but never checked, so an interrupted stream (no `message_stop`) commits a half-built turn to history and the *next* request fails validation.
3. **Context layer (message structure built)** — `assistant_content = [b for b in assemble(blocks) if b["type"] != "thinking"]` **strips thinking blocks**, but `thinking` is enabled (`{"type": "adaptive"}`), so the carry-back rule is violated: the signature no longer matches and the API rejects the following tool-use turn.
4. **Memory layer** — `build_session_history` **concatenates every prior session's full transcript in-context**, so context grows unbounded across sessions and the window fills (the session-four failure), inflating cost/latency until the agent stops responding.

**Stage 2 — Corrected versions** `[reconstructed]`:
1. **Schema** — write a specific 3–4 sentence description: *"Use this to retrieve a customer's account record by customer ID. Returns the stored profile fields for that customer. Do not use this to modify a record. Provide the `id` as the customer's unique identifier string."* (Rename `id` → `customer_id` for clarity if desired.)
2. **Streaming** — gate the commit on `stop_seen`; discard and retry on interruption:
   ```
   if not stop_seen:
       continue   # stream interrupted before message_stop: discard partial turn, retry the request
   assistant_content = assemble(blocks)
   messages.append({"role": "assistant", "content": assistant_content})
   ```
3. **Context / thinking** — **keep thinking blocks unchanged** (do not filter): `assistant_content = assemble(blocks)` — every thinking block (including redacted ones) must return to the API exactly as received.
4. **Memory** — stop concatenating full transcripts in-context; persist to external storage and inject only the relevant subset (or a well-specified summary) at session start:
   ```
   def build_session_history(prior_sessions):
       # Load a bounded, relevant summary from external storage instead of the full transcripts
       return load_summary_from_store(prior_sessions)   # e.g. summarized memory or last-N relevant turns
   ```

---

## 8. Multimodal & Batch Ingestion — images, PDFs, and high-volume processing

**Core idea:** memory managed what Claude remembers between turns; multimodal ingestion shifts the question to **what you're sending in** — every image and PDF consumes context budget *before* Claude reads a single character of your prompt, which changes how you structure requests. The second half is the opposite end: when you have thousands of inputs, one-at-a-time synchronous calls stop making sense — the **Batch API** handles volume without blocking your application.

**Image token cost — calculate before you commit.** Claude views images in patches: **each 28×28-pixel block is one visual token**, so an image costs **⌈width / 28⌉ × ⌈height / 28⌉** visual tokens. A 1,000×1,000 image = ⌈1000/28⌉ × ⌈1000/28⌉ = 36 × 36 patches ≈ **1,296 visual tokens**; ten high-res screenshots consume as much context as a detailed system prompt. Each model has a **maximum native image resolution** (a long-edge limit and a visual-token limit) that **differs by tier** — newest models accept substantially larger images; images larger than either limit are **downscaled before processing**, so the formula runs on the scaled dimensions. *Confirm current per-tier limits against the Vision page at build time.* Measure the token cost of a typical production image against your model's context limit before writing ingestion code — the fix for an over-budget pipeline is often a **ten-minute image-resize step** (much longer if found after deployment).

**Different ways to send an image:**
- **Inline base64** — *How:* encode image bytes as a base64 string directly in the message block. *Overhead:* the full encoded payload travels with **every** request (inflates request size + latency on large images; the same image sent repeatedly multiplies cost). *Use:* one-off images where an upload step adds complexity without payoff.
- **URL reference** — *How:* pass a publicly reachable URL in the source block; Claude fetches it at request time. *Overhead:* no payload travels, but the URL must be stable, public, and reachable at fetch time. *Use:* images already hosted at a stable public URL you control; skip for anything behind auth, short-expiry signed URLs, or unreliable reachability.
- **Files API** — *How:* upload once via a separate API call, receive a **`file_id`**, reference that ID in future messages. *Overhead:* one-time upload; every later request carries the ID not the bytes, so payload overhead drops to near-zero. Currently **in beta and not available on Bedrock or Vertex AI** — verify availability. *Use:* the same image/PDF across multiple requests, large assets, when asset management should live separately from inference calls, and for images across multiple conversation turns (the `file_id` carries no payload weight as history grows).

**Sending PDFs — the document block.** For PDFs the block type is **`document`** rather than `image`. The source follows the same pattern (base64, URL, or Files API `file_id`). There is **no required `name` field**; the block accepts an optional `title` (readable name) and optional `context` (metadata), neither required. All other mechanics (token cost, Files API reuse) apply the same way.

```
{
    "type": "document",
    "source": {
        "type": "base64",
        "media_type": "application/pdf",
        "data": "<base64-encoded-pdf-bytes>"
    },
    "title": "contract_review.pdf"
}
```

**Applying prompting techniques to multimodal inputs.** The same techniques apply — a bare "describe this image" produces shallow output for the same reason a bare text prompt does (no target structure). The difference: images carry ambiguity text cannot (overlapping objects, depth/spatial relationships, partial occlusion). A visual-analysis prompt should name how Claude handles each type — e.g. *"If objects overlap, describe each separately and note the overlap"* is a concrete constraint a text-only prompt would never need.

**The Message Batches API — high-volume asynchronous processing.** For the same prompt pattern against hundreds/thousands of inputs, the synchronous API is the wrong model (each call blocks; at scale you burn threads or run thousands of concurrent connections against rate limits). The Batches API accepts **up to 100,000 requests or 256 MB per batch (whichever comes first)** in a single batch call; you submit, receive a **`batch_id`**, and **poll for completion**, then download results. **Per-token cost is lower than synchronous.** The tradeoff is **latency: non-deterministic, up to 24 hours (often much faster)** — suits offline pipelines, evaluation runs, and data-processing jobs, not real-time interactions. **Results return in arbitrary order** — use the **`custom_id`** field on each request to match results back to inputs.

| Use case | Right API pattern | Why |
|---|---|---|
| A user uploads a photo and expects an immediate classification | Synchronous API | Real-time response is required. Batch latency is unacceptable for interactive use. |
| A nightly pipeline classifies 5,000 customer records | Message Batches API | Latency is not a constraint. Batch cost reduction and asynchronous processing are both valuable. |
| An evaluation run tests a new prompt against 2,000 examples | Message Batches API | Offline task with no real-time requirement. Batch is the correct pattern. |
| A chatbot generates a reply to a user's message | Synchronous API | User is waiting; batch would introduce unacceptable delay. |

**When multimodal and batch fit together — and when they don't.** The combination works for offline workloads that reuse the same assets and need structured output across thousands of inputs (textbook case: a nightly pipeline classifying images against a fixed taxonomy — Files API removes redundant uploads, Batches absorbs latency, structured outputs keep results machine-readable). Two failure modes break the fit: **(1) misreading latency** — reaching for batch in any user-facing flow with an image passes tests and fails in production (the user is waiting, the batch isn't); **(2) underestimating context cost** — images/PDFs consume budget before any text, so pipelines loading multiple large images per request blow past token limits at scale. Measure token cost on production-scale inputs before you build.

**⚠ Watch Out — "the batch job that was not actually a batch."** *(Internal-channel dialogue.)* A developer's nightly classification job kept hitting rate limits; they'd "already split it into smaller chunks." The senior developer's diagnosis: *"That is not batching. That is serial calls against the synchronous endpoint. Splitting the list into chunks does not change what the API sees: it still sees one request per item, back to back."* The fix is the **Message Batch API** — up to 100,000 requests or 256 MB per batch in a single call, returns a `batch_id`, processes asynchronously (you poll for completion), lower per-token cost, and the rate limit doesn't fire because you're not making thousands of individual requests. **Tradeoff:** non-deterministic latency (can take hours) — wrong for real-time, perfect for a nightly run. **Rule:** chunking a list and looping over the synchronous API is **not** batching — it produces the same number of calls and the same rate limits; the Batches API is a **different submission model, not a smaller batch size.** Results return in arbitrary order — use `custom_id` to match back to inputs.

> **Checkpoint 8 · Select the right input encoding for each scenario** `[reconstructed]`:
> - *A reference product diagram used in every request your pipeline makes* → **Files API** (upload once, reference `file_id` in each request — inline base64 would re-send the payload every call).
> - *A one-off screenshot of a UI bug, submitted by a support engineer in a single request* → **Inline base64** (single use; an upload step would add complexity without payoff).
> - *A job classifying 5,000 customer feedback responses* → **Message Batches API** (high-volume, offline; lower per-token cost and asynchronous processing — the synchronous API would hit rate limits).

---

## Recap — eight takeaways, one per enabling objective

1. **When a prompt fails, the failure type tells you which technique is missing.** Wrong shape → missing output constraint; drift across turns → underspecified system prompt; hallucinated structure → absent few-shot examples. Rewording rarely works — none of these are phrasing problems. Diagnose first, then add the technique. When prompt-level instructions aren't enough (untested inputs still break the parser), move output control into the API with **structured outputs**: JSON outputs constrain the final response against a schema; strict tool use validates the arguments Claude passes to your tools — at the cost of first-call compilation latency and added input tokens.
2. **Match the reasoning depth to the task before you tune the prompt.** Enable reasoning only where a reasoning pass changes the answer; calibrate the effort setting rather than raising it on every call. Thinking blocks return to the API unchanged or the next request fails. Model selection (distinct from whether to enable reasoning) is taught in the MSO Foundations module.
3. **A stream ending is not a message completing.** Streaming buys perceived latency at the cost of assembling the response yourself from partial events. Act on a block only after it closes, commit a turn only after `message_stop`, and on interruption discard the partial turn and retry. Recognize a tool-use error on a retry that traces back to a half-built block from a dropped stream, not to the schema.
4. **Every wrong-tool selection traces back to the schema, and most of the time to the description.** Claude picks a tool by reading the description and matching it against the request, so two tools that both say "use this to find information" are indistinguishable even when input schemas differ. The one sentence that resolves most wrong-tool bugs is the **exclusion condition** — when *not* to call the tool — written into the schema at design time. When someone else wrote the tools, MCP lets you connect a maintained server instead of authoring every schema, but each connected server adds its definitions to the window whether used or not — connect deliberately and control loading cost.
5. **Context is a fixed budget, and tool outputs spend it faster than anything else in the loop.** Production tool outputs run 3–5× longer than dev fixtures, so a session clean across fifty turns in testing can hit the ceiling at turn eight in production. Pruning, compaction, and subagent handoffs each buy back headroom differently; the one to apply depends on whether you still need the earlier state. When tool selection degrades after a fixed number of turns, the window is the first place to look, not the schema.
6. **The workflow-or-agent decision sets the cost of everything that follows, and human checkpoints belong in the design.** A workflow when you can write the exact steps in code; an agent when you can specify the goal and tools but not the path. Choosing wrong only surfaces in production. If a tool can take an irreversible action, the HITL checkpoint goes in before the loop is wired, not after the first write reaches a customer environment.
7. **Memory scope is decided by the shape of the session, not by what is easiest to implement.** In-context memory is simplest to write and fails earliest when production sessions turn out shorter and more numerous than the long dev sessions. External storage adds latency but survives across sessions; summarized memory cuts cost but loses anything the summarizer didn't preserve; stateless is correct for jobs that complete and close. The refactor from in-context to external under production pressure takes about an hour; the same choice at design time takes about twenty minutes. Carrying repeatable *instructions* is a separate problem — the pattern is a **Skill** (a markdown file Claude loads on demand by matching its description).
8. **Calculate the cost of a multimodal input before you write the ingestion code and match the API to the workload.** An image costs ⌈width / 28⌉ × ⌈height / 28⌉ visual tokens, and the per-image ceiling differs by model tier; run the formula against the largest input you expect. Inline base64 fits one-off images, the Files API fits reused assets, the Message Batches API handles offline work at lower per-token cost for non-deterministic latency. The mistake to avoid: calling the synchronous API in a loop and treating that as batching.

*What comes next: this module established the Developer primitive library — prompting craft, tool schemas, context engineering, agent construction, memory scoping, multimodal ingestion — the foundation every following module draws from.*

---

## Glossary — key terms

- **Claude Agent SDK** — a managed agent runtime distributed as `@anthropic-ai/claude-agent-sdk` (TypeScript) / `claude-agent-sdk` (Python). Gives a partner programmatic access to the same agent loop that powers Claude Code (iteration, tool execution, observation, termination), so the partner can embed an agent inside their own product instead of running Claude Code in a terminal. Distinct from the Anthropic SDK, which is a thin convenience wrapper over the API and does not run an agent loop.
- **Context Window** — the total number of tokens a model can process in a single request, including the system prompt, conversation history, tool definitions, tool results, and the model's own output. When the running total reaches the limit, earlier content must be removed or summarized before new content can be added.
- **Function signature** — a programming term meaning the declaration of a function: its name plus the list of parameters it accepts, including their names, types, and any default values.
- **HITL** — human-in-the-loop; inserting a human review or approval step into an automated process before consequential action is taken.
- **Refactor** — changing the internal structure of code without changing what it does from the outside. You reorganize, rename, or rewrite the implementation to make it cleaner, faster, easier to test, or easier to extend, but the externally visible behavior stays the same.
- **SOC 2** — Service Organization Control 2, an audit framework developed by the AICPA for evaluating how a service organization handles customer data. The standard most commonly cited when a SaaS vendor or cloud provider is asked to demonstrate their security practices meet a recognized bar.
- **State** — the information an agent carries between turns: the conversation so far, what the user asked for, results from earlier tool calls.
- **Stop_reason** — a field in the API response telling your code why the model stopped generating. The two most relevant to agentic loops: `end_turn` (Claude has finished and is not requesting further action) and `tool_use` (Claude has issued one or more `tool_use` blocks and is waiting for results before continuing).
- **Subagent** — a separate agent instance spun up by an orchestrating agent to handle a discrete subtask. Subagents do not inherit conversation history, skills, or context from the parent session — each starts clean and must be configured explicitly with the instructions and tools it needs. Results return to the orchestrator, which incorporates them into the broader task.
- **Token** — the unit Claude uses to measure and process text. Characters-per-token depends on the model's tokenizer and differs between generations — treat any chars-per-token rule of thumb as model-dependent and confirm current behavior at build time. Tokens are consumed by everything in the context window (prompts, responses, tool schemas, tool results) and are the basis for both pricing and context-budget calculations.
- **Tool_use_block** — a content block returned by the assistant when Claude wants to call a function. Contains the tool name, a unique ID, and the input arguments Claude wants passed to your code. Every `tool_use` block must be answered by a matching `tool_result` block in the immediately following user turn, with the same ID preserved exactly.

---

## Sources cited by the module

- **Claude 101** (Skilljar): Prompting foundations, tool-use basics, agents-and-workflows overview, context-window concepts.
- **Claude Code 101 In Action** (Skilljar): Context management (`/compact`, `/clear`), Claude Code agent loop, production agent patterns.
- **AI Fluency Framework Foundations** (Skilljar): Prompting techniques, few-shot examples, constraint specification.
- **Building with the Claude API** (Skilljar): Tool schemas, message block structure, streaming, structured outputs, Files API, batch API, agent construction.
- **`platform.claude.com`**: Canonical reference for tool-use, agents, context, MCP, API mechanics. Pull at publish and re-verify.
- **Anthropic Blog: "Building Effective Agents"**: Workflow sub-patterns (chaining, routing, parallelization, evaluator-optimizer), agent design guidance.

*Next module: **Module 3 — Claude Code, MCP & Integration** (permission modes, durable project context, plugin packaging, MCP integration without leaking credentials).*

_Educational content; illustrative/fictitious examples. © 2026 Anthropic._
