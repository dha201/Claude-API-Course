# Retrieval API for Project Similarity

Can the Azure AI Search Retrieval API (a knowledge base over a knowledge source, at `minimal` reasoning effort) replace the Search API for document retrieval in `chat_similarity`?

For document fetch, yes: with three settings the Retrieval API returns the same chunks as the Search API on all eight test projects ([F16](evidence.md#f16)). For grouping, counting and sorting, not as it stands: the retrieve request has no `facets`, `count` or `orderby` ([O6](runbook.md#o6)). The next step is [O2](runbook.md#o2), applying the settings in the application repository.

Service `workdeliverygpt-dev-srch`, index `project_similarity_index`, Retrieval API version `2026-08-01-preview`.

## Documents

Stakeholder and explainer documents:

| File | Holds | Read it when |
|---|---|---|
| [retrieval-api-migration-spec.md](retrieval-api-migration-spec.md) | The stakeholder approval document: 11 work items | you need the plan and its dependencies |
| [kb-retrieval-capability-walkthrough.md](kb-retrieval-capability-walkthrough.md) | The explainer: a toy index and the four operations discovery needs | you need the concepts before the numbers |
| [open-questions-answered.md](open-questions-answered.md) | Short answers to the raw questions, citing IDs | you asked one of the raw questions |
| [open_questions.md](open_questions.md) | The raw questions | you need the original wording |

Investigation documents:

| File | Holds | Read it when |
|---|---|---|
| [ground-truth.md](ground-truth.md) | Current state: status, current facts, how a retrieve runs, what each setting controls, the configuration that works, capability gaps. Every claim cites its finding inline | you need what's true now |
| [evidence.md](evidence.md) | [F1](evidence.md#f1) to [F23](evidence.md#f23): setup, result table, date and the commands behind each finding | you need the number behind a claim |
| [commands.md](commands.md) | [A1](commands.md#a1) to [A37](commands.md#a37): every command run, verbatim, with its raw result | you need to rerun or audit a measurement |
| [runbook.md](runbook.md) | Pitfalls, open items [O1](runbook.md#o1) to [O9](runbook.md#o9) with their commands, operating notes, cleanup | you're about to run something |
| [implementation.md](implementation.md) | Python reference code and porting checklist for `chat_similarity` | you're changing the application |
| [decisions.md](decisions.md) | [ADR 1](decisions.md#adr-1) to [ADR 7](decisions.md#adr-7) | you need why a choice was made |
| [search-ismatch-reference.md](search-ismatch-reference.md) | `search.ismatch` grammar and traps, Search API against Retrieval API parameters, query hints | you're writing a `filterAddOn` or mapping a Search API call |
| [sources.md](sources.md) | Microsoft quotes, what no Microsoft page says, sentences not to cite, outside evidence | you're citing Microsoft or prior art |
| [history.md](history.md) | How the investigation got here, claims that turned out wrong, old labels | you meet an old claim or label |
| [staging-findings.md](staging-findings.md) | Unproven claims [U2](staging-findings.md#u2) to [U8](staging-findings.md#u8) with their tests, and the promotion rule | you have a claim without a measurement |

## How the documents cite each other

```
 spec / walkthrough / open-questions-answered
                │  cite F#, O#, ADR#
                ▼
        ground-truth.md ──[F#]──► evidence.md ──[A#]──► commands.md
                │
                └──[URL]──► Microsoft page (quote kept in sources.md)

 runbook.md (O#) ── result ──► staging ── promote ──► evidence.md + ground-truth.md
```

- The stakeholder and explainer documents state conclusions and cite IDs. They don't repeat result tables.
- ground-truth.md states each claim with its headline number and links the finding (F#) that measured it. Microsoft behavior links the Microsoft page directly.
- evidence.md holds each finding's full result table and links the commands (A#) that produced it.
- commands.md holds each command verbatim with its raw result. It's the bottom of the chain.
- sources.md keeps the exact wording of each Microsoft quote and the date it was checked.
- A new result starts in runbook.md as an open item (O#). Unproven, it goes to staging as a U entry. Once it has a command, a number and a date, it moves: the command to commands.md, the table to evidence.md as a new F, and the claim to ground-truth.md.

## IDs

IDs are stable. Files can change; an ID never changes meaning and is never reused.

| ID | Meaning | Lives in |
|---|---|---|
| [F1](evidence.md#f1) to [F23](evidence.md#f23) | A measured finding | [evidence.md](evidence.md) |
| [A1](commands.md#a1) to [A37](commands.md#a37) | A command that ran, with its raw result | [commands.md](commands.md) |
| [O1](runbook.md#o1) to [O9](runbook.md#o9) | An open item, usually with a command to run | [runbook.md](runbook.md) |
| [U2](staging-findings.md#u2) to [U8](staging-findings.md#u8) | An unproven claim with its test | [staging-findings.md](staging-findings.md) |
| [ADR 1](decisions.md#adr-1) to [ADR 7](decisions.md#adr-7) | A decision with a rejected alternative | [decisions.md](decisions.md) |
| P0 to P8 | Test prompts for query parsing | [runbook.md](runbook.md#o9) |

Each ID has an explicit anchor, so `evidence.md#f12`, `commands.md#a32`, `runbook.md#o4`, `decisions.md#adr-5` and `staging-findings.md#u3` link straight to it.

## Reading order

- **Stakeholder:** the spec, then "Question and status" in ground-truth.md.
- **Engineer changing `chat_similarity`:** implementation.md, then "Configuration that works" in ground-truth.md, then [O2](runbook.md#o2) in runbook.md.
- **Agent continuing the investigation:** "Pitfalls for future agents" in runbook.md, then ground-truth.md, then staging.
