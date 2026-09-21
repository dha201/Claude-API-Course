# Moving chat_similarity to the Knowledge Retrieval API

chat_similarity runs on the Search API today. We ran 16 user questions through it on both APIs ([F23](evidence.md#f23)):

```
  16 questions

  Retrieval API worse   ████████████   12
  Same answer           ██              2
  Both declined         █               1
  Mixed                 █               1
```

- The 2 that match both name a project by ID and ask for a stored fact.
- Nothing has to be found, counted or grouped, so both APIs get there.

That run used a knowledge source setup that switched vector search off. We've since found the settings that give the Retrieval API the same document results as the Search API ([F16](evidence.md#f16)).

The goal is to move every call to the Retrieval API, with no Search API calls left ([ADR 7](decisions.md#adr-7)). Document fetch has a proven route. The rest have routes we still need to test:

```
  PIPELINE STEP            SEARCH API TODAY              RETRIEVAL API ROUTE                  STATUS
  ───────────────────────  ────────────────────────────  ───────────────────────────────────  ──────────
  document fetch           hybrid + semantic ranker      settings in work 2 and 4             proven
  semantic discovery       hybrid, two filters           two retrieve calls, merged           hypothesis
  field-value membership   facets on project_id          list matching rows, dedupe in code   hypothesis
  sort by stored value     facets, then sort in code     list matching rows, sort in code     hypothesis
  filter counts            facet count                   list matching rows, count in code    hypothesis
  project state            gate_label facet              gate coverage stamped at ingest      design
```

The retrieve request has no `facets`, `count`, `orderby` or `skip`, so membership, sort and count all rest on one idea: pull every matching record row (at most 200 per call) and do the grouping in our own code. Each call site, its route and the hypothesis behind it are in [search-api-parity.md](search-api-parity.md#parity-map).

F, O and ADR numbers link to the measurements, open items and decisions behind every number here. [README.md](README.md) maps the documents.

---

## The work at a glance

| # | Work | Fixes | Waits for |
|---|---|---|---|
| 1 | Gate coverage stamp | Projects with no record row get no lessons | nothing |
| 2 | Evidence fetch settings | The reranker and the output budget cut 50 results to 9 | nothing |
| 3 | Retrieval layer | Unsupported calls get dropped silently | nothing |
| 4 | Knowledge source field list | The field list switches vector search off | nothing |
| 5 | Discovery on the Retrieval API | No totals, no project lists, no sort by value | 3, 4 |
| 6 | Document fetch on the Retrieval API | 10 chunks out of 4,259 | 1, 2, 3, 4 |
| 7 | Per-request field scoping | Can't tell an official tag from a mention | 3, 4 |
| 8 | Ranking signal and refusal threshold | Asks the user to narrow on 4 of 16 | 2, 6 |
| 9 | Access control parity | Untested across all projects | 3 |
| 10 | Trace | Log can't show whether vector search ran | 3 |
| 11 | Regression suite | 16 questions only run by hand | 5, 6, 7, 8 |

```
  1 Gate coverage stamp ─────────────────────┐
                                             │
  2 Evidence fetch settings ─────────────────┼──► 6 Document fetch ──┐
                                             │         │             │
  4 Knowledge source field list ─────────────┤         ▼             │
                              │              │   8 Threshold ────────┤
  3 Retrieval layer ──────────┼──────────────┘                       │
        │                     ├──────────────► 7 Field scoping ──────┤
        │                     └──────────────► 5 Discovery ──────────┼──► 11 Regression
        ├──► 9 Access control                                        │      suite
        └──► 10 Trace                                                │
```

1, 2, 3 and 4 can start right away.

---

## 1. Gate coverage stamp

**Waits for:** nothing

**Today**

- chat_similarity groups by `gate_label` (a facet) to see which gate documents each project has.
- From that, it works out whether the project is closed.
- Closed projects go to their Closeout documents for lessons.
- The Retrieval API can't group, so it can't do this.

**Example**

> "Extract all lessons learned for these eight project IDs: 1009338, 1009392, 1010069, 1011517, 1011718, 1011742, 1012268, 1012329. Structure the result by project number and name, brief description, and interpret whether each lesson learned is positive or negative impact and categorize the theme of the learning (if you cannot interpret the impact category, just show the exact lesson learned)."

Project 1012329 on each API ([F17](evidence.md#f17)):

| | Search API | Retrieval API |
|---|---|---|
| Groups by gate | yes | no |
| Record row to fall back on | none | none |
| Project state | Closed | Unknown |
| Evidence fetch runs | yes | never |
| Closeout chunks searched | 598 | 0 |

At Unknown the flow fetches nothing, so the answer reports no lessons for 1012329. Its lessons are retrievable: queried directly, the Retrieval API returns the same lesson chunks as the Search API ([F16](evidence.md#f16)).

**Deliver**

- Stamp each project's gate coverage onto every chunk during indexing.
- Project state reads from that field instead of a facet.
- Expected: project 1012329 returns its lessons.
- It also works on the Search API today, so it's worth doing first.
- Hypothesis behind it: [U14](staging-findings.md#u14).

---

## 2. Evidence fetch settings

**Waits for:** nothing

**Today**

- The Retrieval API runs hybrid search: keyword search plus vector search on `content_vector`, through the index's vectorizer `ps_text_3_small` ([F8](evidence.md#f8)).
- It then passes the results through the semantic reranker, which drops most of them, and through an output token budget, which caps what's left.
- chat_similarity sends `rerankerThreshold` 1.0 and the default budget.

**Example**

Project 1009338, 601 Closeout chunks, search text "lessons learned", vector search on:

| Retrieval API request | References | Source |
|---|---:|---|
| default reranking, default budget | 9 | [F11](evidence.md#f11) |
| `rerankerThreshold` 0 | 13 | [F11](evidence.md#f11) |
| reranking off (`resultsProcessing: "none"`), default budget | 9 | [F11](evidence.md#f11) |
| reranking off, `maxOutputSize` 200,000 | 50 | [F12](evidence.md#f12) |
| Search API, hybrid + semantic ranker | 50 | [F14](evidence.md#f14) |

The 50 are the same 50 chunks the Search API returns ([F15](evidence.md#f15)). Across all eight projects, default reranking returns 4 to 25 references and loses a lessons chunk on 2 projects; reranking off with the larger budget matches the Search API on every project ([F16](evidence.md#f16)).

**Deliver**

- On each evidence retrieve: `resultsProcessing: "none"` on the knowledge source entry, `maxOutputDocuments` 50, `maxOutputSize` 200,000, and no `rerankerThreshold` (sending it with `none` returns HTTP 400).
- Anything that sorts or filters on `rerankerScore` changes, because references carry no score with reranking off.
- Measure the token and latency cost of 50 chunks per project against 4 to 25 ([O4](runbook.md#o4)).
- Expected: the eight-project prompt returns lessons for 7 of 8 projects. 1012329 waits for work 1.

---

## 3. Retrieval layer

**Waits for:** nothing

**Today**

- Every step in chat_similarity builds its own Search API request and sends it directly.
- To try the Retrieval API, we added a translation layer.
- It quietly drops what the Retrieval API won't accept:
  - `facets`
  - `searchFields`
  - `vectorQueries`
  - `semanticQuery`
  - `queryType`
  - `select`

**Example**

On the eight-project prompt, the trace logged 32 retrieve calls and 7 capability gaps ([F17](evidence.md#f17)). None of it shows in the answer.

```
  TODAY
  step ──► Search API request ──► translate ──► Retrieval API
                                      │
                                      └──► unsupported parts dropped

  AFTER
  step ──► retrieval layer ──► retrieve request(s) ──► Retrieval API
                  │
                  ├──► membership, count, sort: list matching rows, then group in code (work 5)
                  └──► a need with no route: fails and shows in the trace
```

**Deliver**

- Every retrieval call goes through one interface, and every call becomes a retrieve request.
- Each call says what it needs: rank, membership, count, sort or field scope.
- The interface builds the retrieve request for it, including the row listing and in-code grouping from work 5.
- Nothing gets dropped silently. A need with no route fails and shows in the trace.

---

## 4. Knowledge source field list

**Waits for:** nothing

**Today**

- The Retrieval API can't set search fields per request. It uses the `searchFields` list stored on the knowledge source, for keyword and vector search both.
- Ours holds an explicit list of 29 fields, and `content_vector` isn't one of them.
- A list that doesn't name the vector field switches vector search off. Microsoft doesn't document this; we measured it ([F9](evidence.md#f9)).

**Example**

Project 1009338, Closeout filter, "lessons learned":

| Knowledge source | Vector search | References | Source |
|---|---|---:|---|
| production, 29-field list | off | 1 | [F7](evidence.md#f7), [F9](evidence.md#f9) |
| same, list removed | on | 9 | [F7](evidence.md#f7) |
| same, list removed, work 2 settings | on | 50 | [F12](evidence.md#f12) |

The 1 is the single keyword hit: the Search API with its vector query removed also finds 1 ([F14](evidence.md#f14)).

**Deliver**

- Remove `searchFields` from the knowledge source the evidence fetch uses. A short list that names `content_vector` also keeps vector search on ([F10](evidence.md#f10)), with two points still unproven ([O5](runbook.md#o5)).
- The knowledge source is shared, so try the change on a copy first.
- Expected: the vector half runs, and with work 2 the eight projects match the Search API.

---

## 5. Discovery on the Retrieval API

**Waits for:** 3, 4

**Today**

- chat_similarity finds candidate projects in four lanes:
  - Lane 1: hybrid search, run twice (filter with the tag, and without it) and merged
  - Lane 2: facets on `project_id` to list every project whose field holds a value
  - Lane 3: facets for the project set, then reads each project's value and sorts in code
  - Lane 4: a facet count, the "exactly how many" in the answer
- The retrieve request has no `facets`, `count`, `orderby` or `skip`, and returns at most 200 rows per call ([F6](evidence.md#f6)).

**Example 1**

> "How many SAP projects are there in total?"

| Search API | Retrieval API |
|---|---|
| 47 | no total |

The Retrieval API can only count what it happened to retrieve ([F23](evidence.md#f23), row 6).

**Example 2**

> "List projects with Project Solution = 'Hardware Deploy (Infrastructure Hardware)'. Rank by Total Actuals descending, top 10, name/PPL/actuals/duration/status."

| Search API | Retrieval API |
|---|---|
| 10 projects in spend order | 2 projects |
| ZEST 1012929, $13.5M, is sixth | ZEST 1012929 missing |

([F23](evidence.md#f23), row 12)

**Hypotheses to test before building**

| # | Hypothesis | Test |
|---|---|---|
| [U12](staging-findings.md#u12) | Two retrieve calls, with and without the tag filter, return Lane 1's candidate projects | rerun the discovery prompts on both |
| [U9](staging-findings.md#u9) | With the reranker bypassed, retrieve returns every row that matches the filter, up to 200 | [O10](runbook.md#o10) |
| [U10](staging-findings.md#u10) | Filtering to record rows gives one row per project per source | [O10](runbook.md#o10) with a `row_type` clause |
| [U11](staging-findings.md#u11) | A filter over 200 rows can be split into slices and merged | after U9 and U10 |

**Deliver**

- Lane 1 as two retrieve calls, merged in code.
- Lanes 2 to 4 from one listing: retrieve the matching record rows with the reranker bypassed, then take distinct `project_id` in code for the list, count them for the total, and sort them by the stored value.
- Expected: 47, and the 10 projects in spend order with ZEST 1012929 sixth.
- If the listing can't return every matching project, the fallback is an MCP server knowledge source that returns counts computed by our own code. It can't run at `minimal` effort, so it needs a model ([ADR 7](decisions.md#adr-7)).

---

## 6. Document fetch on the Retrieval API

**Waits for:** 1, 2, 3, 4

**Today**

- chat_similarity fetches documents per gate, per project, with hybrid search.
- It reranks against a fuller version of the question than the one it searched with.
- The Retrieval API uses one string for both searching and reranking. With reranking off (work 2) that difference drops out.

**Example**

Eight-project prompt on the Retrieval API as deployed ([F17](evidence.md#f17)):

- The 8 projects hold 4,259 Closeout chunks between them.
- Search API: 45 chunks for project 1009338 alone.
- Retrieval API: 10 chunks across all 8 projects.
- Final answer: lessons for 4 projects, "no lessons found" for 4.
- All 8 have lessons on file.

**Deliver**

- Uses the stamped gate coverage from work 1, the settings from work 2 and the field list from work 4.
- With the reranker off, nothing reranks against the full question. The hypothesis is that answers don't change ([U17](staging-findings.md#u17)).
- Rerun the eight-project prompt and the 16 questions ([O2](runbook.md#o2)).
- Expected: all 8 projects return their lessons.

---

## 7. Per-request field scoping

**Waits for:** 3, 4

**Today**

- chat_similarity uses `searchFields` to look only in the vendor or role field.
- It uses `searchMode=all` so every word of a name has to match.
- That's how it tells an official vendor tag apart from a mention in a slide.
- The Retrieval API has neither.

**Example 1**

> "Which projects officially list Amazon Web Services as a vendor?"

| Search API | Retrieval API |
|---|---|
| 10 tagged projects | none confirmed |

([F23](evidence.md#f23), row 1.) Without `searchMode=all`, every word is optional, so a vendor tagged only "AMAZON", or any vendor containing "SERVICES", counts as a match.

**Example 2**

> "Show me data for the Fronteer Upgrade project."

| Search API | Retrieval API |
|---|---|
| answers | declines |

([F23](evidence.md#f23), row 13.) That run used the knowledge source with vector search off, so only keyword search ran, and keyword search has no fuzzy matching without the `full` parser. Whether vector search finds the project once it's on is untested.

**Deliver**

- The Retrieval API's filter accepts a field list, a parser and an all-words flag per request, through `search.ismatch` ([F21](evidence.md#f21)).
- That brings back field scope, all-words matching and fuzzy matching.
- Tested on "Fronteer": documents found with the filter, none without it ([F21](evidence.md#f21)).
- Expected: the 10 Amazon Web Services projects, kept separate from mentions, and the Fronteer project found. Not yet tested end to end ([U13](staging-findings.md#u13), [O9](runbook.md#o9)).

---

## 8. Ranking signal and refusal threshold

**Waits for:** 2, 6

**Today**

- chat_similarity orders projects by reranker score.
- It asks the user to narrow down when nothing scores high enough to be a confident match.
- It checks the top reranker score against a threshold of 1.5.

**Example**

> "Which SaaS projects closed in the last two years have a recorded duration under 12 months?"

| Search API | Retrieval API |
|---|---|
| answers | top score 1.28 against a threshold of 1.5, asks the user to narrow |

- The Retrieval API did this on 4 of the 16 questions ([F23](evidence.md#f23)).
- With reranking off (work 2), references carry no reranker score at all, so this check needs another signal or a separately reranked call.

```
  reranker score   0 ────── 1.0 ────── 1.28 ── 1.5 ─────────►
                            ▲          ▲       ▲
                     threshold we   top score  flow's
                     send on each   on the     narrow-
                     document fetch SaaS q.    down gate
```

A service-side minimum score of 2.5 has been suggested but has no source sentence and is untested (staging [U3](staging-findings.md#u3)).

**Deliver**

1. Decide what orders projects and what the narrow-down gate reads once references have no reranker score. First hypothesis: stage 1 order, and narrow down only when few projects come back ([U15](staging-findings.md#u15)).
2. Measure where that signal lands across all 16 questions.
3. Set the threshold from that data.

- Expected: the 4 questions that end in "please narrow down" today get answered.

---

## 9. Access control parity

**Waits for:** 3

**Today**

- chat_similarity filters every query by access columns on the index rows, per source system.
- A user only sees the projects and documents they're allowed to.
- Record rows and document chunks use separate access columns.

**Tested so far**

- Named projects: 9 of 9 access checks behaved correctly on the eight-project prompt ([F17](evidence.md#f17)).
- Questions across every project, like the vendor or SAP questions: not tested.

**Deliver**

- Same user, same question: exactly the same projects and documents as the Search API shows today ([U16](staging-findings.md#u16)).
- Every source system covered.
- Nothing leaks through citations.

---

## 10. Trace

**Waits for:** 3

**Today**

- chat_similarity writes trace lines to the service log.
- Any answer traces back to the intents, candidate projects and counts behind it.
- The Retrieval API returns its own execution log, but its search arguments have no vector field, so it never shows whether a vector search ran.
- Its `count` is taken after the reranker, so a count of 0 doesn't mean nothing was found.

**Example**

- With default reranking, the made-up word `zqxjvwkbhf`, which only vector search can match, shows count 0. That looks like no vector search ran.
- With reranking off it shows 51 candidates, all of them the Search API's own vector matches for the same word ([F8](evidence.md#f8)).

**Deliver**

- Our trace lines, joined to the Retrieval API's execution log for each retrieve call.
- Any answer can be reproduced from its trace.

---

## 11. Regression suite

**Waits for:** 5, 6, 7, 8

**Today**

- The 16 questions were run once, by hand, and compared answer by answer.
- Nothing reruns them.
- A change that fixes one question and breaks another only shows up once users hit it.

**Deliver**

- The 16 questions run on demand.
- Each reports pass or fail against today's chat_similarity answer, checking:
  - how many projects came back
  - which project IDs
  - whether the flow answered or asked the user to narrow
- Two questions already match and stay in as a guard, so a fix to discovery can't quietly break named-project lookups:
  - "Architect and work support for 1000626"
  - "Is Rocca officially the delivery manager on 1009338?"
