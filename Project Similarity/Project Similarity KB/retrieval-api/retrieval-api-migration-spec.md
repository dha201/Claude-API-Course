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

That run used a knowledge source whose field list switches vector search off ([F9](evidence.md#f9)). With vector search on and three request settings, the Retrieval API returns the same 50 chunks as the Search API on project 1009338 ([F15](evidence.md#f15)), and the same result count and lesson count on all eight test projects ([F16](evidence.md#f16)). Chunk identity on the other seven is still open ([O3](runbook.md#o3)).

The goal is to move every call to the Retrieval API, with no Search API calls left ([ADR 7](decisions.md#adr-7)). Each pipeline step, its route and its status, with statuses as defined in [search-api-parity.md](search-api-parity.md#status-legend):

```
  PIPELINE STEP                  SEARCH API TODAY                   RETRIEVAL API ROUTE                          STATUS        WORK
  ─────────────────────────────  ─────────────────────────────────  ───────────────────────────────────────────  ────────────  ────
  document fetch                 hybrid + semantic ranker           one-source knowledge base, work 2 settings   Proven        2, 4
  record read                    top 2, filter on record rows       same filter, trim in code                    Proven        3
  source isolation               one index per query                one-source knowledge base                    Proven        4
  field scope, all-words, fuzzy  searchFields, searchMode, full     search.ismatch in filterAddOn                Syntax only   7
  semantic discovery             hybrid, two filters, merged        two retrieve calls, merged in code           Design        5
  membership, sort, count        facets on project_id, facet count  list matching record rows, group in code     Design        5
  project state                  gate_label facet                   gate coverage stamped at ingest              Design        1
  ranking and narrow-down gate   rerankerScore against 1.5          a replacement signal                         Design        8
  access control                 per-source ACL filter columns      the same columns in filterAddOn              Design        9
  trace                          KB_TRACE                           activity array joined to our trace lines     Design        10
  separate rerank string         semanticQuery                      none                                         No route      6
```

The retrieve request has no `facets`, `count`, `orderby` or `skip`, so membership, sort and count all rest on one idea: pull every matching record row (at most 200 per call, [F6](evidence.md#f6)) and do the grouping in our own code. Each call site and the hypothesis behind its route are in [search-api-parity.md](search-api-parity.md#parity-map).

F, U, O and ADR numbers link to the measurements, unproven claims, open items and decisions behind every number here. [README.md](README.md) maps the documents.

---

## The work at a glance

| # | Work | Fixes | Waits for |
|---|---|---|---|
| 1 | Gate coverage stamp | Projects with no record row get no lessons | an index change and a re-ingest |
| 2 | Evidence fetch settings | The reranker and the output budget cut 50 results to 9 | 4 |
| 3 | Retrieval layer | Unsupported calls get dropped silently | nothing |
| 4 | Evidence knowledge source and knowledge base | The field list switches vector search off, and the production knowledge base queries 3 sources | nothing |
| 5 | Discovery on the Retrieval API | No totals, no project lists, no sort by value | 3, 4, `row_type` values |
| 6 | Document fetch on the Retrieval API | 10 chunks out of 4,259 | 1, 2, 3, 4 |
| 7 | Per-request field scoping | Can't tell an official tag from a mention | 3, 4 |
| 8 | Ranking signal and refusal threshold | Asks the user to narrow on 4 of 16 | 2, 6 |
| 9 | Access control parity | Untested on questions across all projects | 3 |
| 10 | Trace | Log can't show whether vector search ran | 3 |
| 11 | Regression suite | 16 questions only run by hand | 5, 6, 7, 8 |
| 12 | Latency and token cost | 50 chunks per project against 4 to 25, time unmeasured | 2, 4, 6 |
| 13 | Search API removal | Two retrieval paths to run and maintain | 1 to 12 |

```
  WAVE 1                       WAVE 2                 WAVE 3             WAVE 4              WAVE 5                WAVE 6
  ───────────────────────────  ─────────────────────  ─────────────────  ──────────────────  ────────────────────  ────────────────────
  3 Retrieval layer            2 Evidence settings    6 Document fetch   8 Threshold         11 Regression suite   13 Search API removal
  4 Evidence knowledge base    5 Discovery                               12 Latency, tokens
  1 Gate coverage stamp        7 Field scoping
                               9 Access control
                               10 Trace
```

An item starts when everything in its "Waits for" column is done. 3 and 4 can start right away. 1 also needs the index change and re-ingest scheduled.

Each work item ends with a **Pass** line: the test that must pass before it counts as done. Work 13 runs only when every Pass line holds.

---

## 1. Gate coverage stamp

**Waits for:** an index change and a re-ingest

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

At Unknown the flow fetches nothing, so the answer reports no lessons for 1012329. Its lessons are retrievable: queried directly, the Retrieval API returns the same result count and lesson count as the Search API ([F16](evidence.md#f16)).

**Deliver**

- Stamp each project's gate coverage onto every chunk during indexing.
- Project state reads from that field instead of a facet.
- It also works on the Search API today, so it can ship before the rest.
- This is one of three options in [O6](runbook.md#o6). It keeps today's behavior. The others drop the gate fallback, or give the Unknown state a source list. No ADR records the choice yet.
- Hypothesis behind it: [U14](staging-findings.md#u14). The stamp goes stale if gate documents arrive between ingests.

**Pass:** for the eight projects, the stamped gate list equals the `gate_label` facet, and project 1012329 resolves to Closed and returns its lessons.

---

## 2. Evidence fetch settings

**Waits for:** 4

**Today**

- The Retrieval API runs hybrid search: keyword search plus vector search on `content_vector`, through the index's vectorizer `ps_text_3_small` ([F8](evidence.md#f8)).
- It then passes the results through the semantic reranker, which drops most of them, and through an output token budget, which caps what's left.
- chat_similarity sends `rerankerThreshold` 1.0 and the default budget.

**Example**

Project 1009338, 601 Closeout chunks, search text "lessons learned". Every Retrieval API row ran on the one-source knowledge base from work 4, with vector search on:

| Request | References | Source |
|---|---:|---|
| default reranking, default budget | 9 | [F11](evidence.md#f11) |
| `rerankerThreshold` 0 | 13 | [F11](evidence.md#f11) |
| reranking off (`resultsProcessing: "none"`), default budget | 9 | [F11](evidence.md#f11) |
| reranking off, `maxOutputSize` 200,000 | 50 | [F12](evidence.md#f12) |
| Search API, hybrid + semantic ranker | 50 | [F14](evidence.md#f14) |

The 50 are the same 50 chunks the Search API returns ([F15](evidence.md#f15)). Across all eight projects, default reranking returns 4 to 25 references and loses a lessons chunk on 2 projects. Reranking off with the larger budget matches the Search API's result count and lesson count on every project ([F16](evidence.md#f16)). On the production field list these settings don't help, because vector search is off and keyword search finds 1 chunk ([F9](evidence.md#f9)). That's why work 2 waits for work 4.

**Deliver**

- On each evidence retrieve: `resultsProcessing: "none"` on the knowledge source entry, `maxOutputDocuments` 50 on the entry and the request, `maxOutputSize` 200,000, and no `rerankerThreshold` (sending it with `none` returns HTTP 400). The decision is [ADR 5](decisions.md#adr-5).
- Anything that sorts or filters on `rerankerScore` changes, because references carry no score with reranking off.
- Expected: the eight-project prompt returns lessons for 7 of 8 projects. 1012329 waits for work 1.

**Pass:** [O3](runbook.md#o3) shows the same chunk IDs as the Search API on all eight projects, not only 1009338.

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

**Pass:** no pipeline step sends a Search API request, and a request for `facets`, `count`, `orderby`, `skip` or `semanticQuery` fails with a trace line instead of being dropped.

---

## 4. Evidence knowledge source and knowledge base

**Waits for:** nothing

**Today**

- The Retrieval API can't set search fields per request. It uses the `searchFields` list stored on the knowledge source, for keyword and vector search both.
- Ours holds an explicit list of 29 fields, and `content_vector` isn't one of them.
- A list that doesn't name the vector field switches vector search off. Microsoft doesn't document this. We measured it ([F9](evidence.md#f9)).
- The production knowledge base queries all three of its knowledge sources on every retrieve ([F4](evidence.md#f4)). Every parity number in work 2 ran on a knowledge base with one source, `ps-kb-allfields`.

**Example**

Project 1009338, Closeout filter, "lessons learned":

| Knowledge source | Vector search | References | Source |
|---|---|---:|---|
| production, 29-field list | off | 1 | [F7](evidence.md#f7), [F9](evidence.md#f9) |
| same, list removed | on | 9 | [F7](evidence.md#f7) |
| same, list removed, work 2 settings | on | 50 | [F12](evidence.md#f12) |

The 1 is the single keyword hit: the Search API with its vector query removed also finds 1 ([F14](evidence.md#f14)).

**Deliver**

- Remove `searchFields` from the knowledge source the evidence fetch uses ([ADR 6](decisions.md#adr-6)). A short list that names `content_vector` also keeps vector search on ([F10](evidence.md#f10)), with two points still unproven ([O5](runbook.md#o5)).
- Run the evidence fetch on a knowledge base that holds only that knowledge source. `neverQuerySource` on the production knowledge base is the other route, and it's untested ([O7](runbook.md#o7)).
- The production knowledge source is shared with DEV, so make the change on a copy first ([ADR 2](decisions.md#adr-2)).
- Expected: the vector half runs, and with work 2 the eight projects match the Search API.

**Pass:** the made-up word `zqxjvwkbhf`, which only vector search can match, returns candidates with reranking off, as in [F8](evidence.md#f8), and the activity array shows one knowledge source.

---

## 5. Discovery on the Retrieval API

**Waits for:** 3, 4, and the `row_type` values for record rows

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

U9 already has one warning sign: on project 1012173, `*` with 200 documents returned 50 of 88 chunks, and nobody knows why ([F18](evidence.md#f18)).

**Deliver**

- Read the `row_type` values that mark record rows. They aren't recorded yet ([U10](staging-findings.md#u10)).
- Add `project_id` and every sort field, such as `pect_total_actuals`, to `sourceDataFields` on the knowledge source. Without them the references carry no value to group or sort on.
- Lane 1 as two retrieve calls, merged in code.
- Lanes 2 to 4 from one listing: retrieve the matching record rows with the reranker bypassed, then take distinct `project_id` in code for the list, count them for the total, and sort them by the stored value.
- If the listing can't return every matching project, the fallback is an MCP server knowledge source that returns counts computed by our own code. It can't run at `minimal` effort, so it needs a model ([ADR 7](decisions.md#adr-7)).

**Pass:** "How many SAP projects" answers 47, and the Hardware Deploy prompt returns the Search API's 10 projects in spend order, with ZEST 1012929 sixth.

---

## 6. Document fetch on the Retrieval API

**Waits for:** 1, 2, 3, 4

**Today**

- chat_similarity fetches documents per gate, per project, with hybrid search.
- It reranks against a fuller version of the question than the one it searched with (`semanticQuery`).
- The Retrieval API uses one string for both searching and reranking. With reranking off (work 2) that difference drops out, and nothing reranks against the full question.

**Example**

Eight-project prompt through the deployed pipeline, vector search off ([F17](evidence.md#f17)):

- The 8 projects hold 4,259 Closeout chunks between them.
- Search API path: 45 chunks for project 1009338 alone.
- Retrieval API path: 10 chunks across all 8 projects.
- Final answer: lessons for 4 projects, "no lessons found" for 4.
- All 8 have lessons on file.

The 45 comes from the pipeline run. The 50 in work 2 comes from a direct Search API query on the same filter ([F14](evidence.md#f14)). Why the pipeline got 5 fewer isn't measured.

**Deliver**

- Uses the stamped gate coverage from work 1, the settings from work 2 and the knowledge base from work 4.
- Apply them in chat_similarity ([O2](runbook.md#o2)), using [implementation.md](implementation.md) as the reference.
- Hypothesis: losing the full-question rerank doesn't change the answers ([U17](staging-findings.md#u17)).

**Pass:** the eight-project prompt returns lessons for all 8 projects, and the 16 questions rerun with no answer worse than the Search API's on lessons.

---

## 7. Per-request field scoping

**Waits for:** 3, 4

**Today**

- chat_similarity uses `searchFields` to look only in the vendor or role field.
- It uses `searchMode=all` so every word of a name has to match.
- That's how it tells an official vendor tag apart from a mention in a slide.
- The retrieve request has neither.

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
| resolves the misspelling to 1007814 | declines |

([F23](evidence.md#f23), row 13.) That run had vector search off, so only keyword search ran, and keyword search has no fuzzy matching without the `full` parser. Whether vector search finds the project once it's on is untested.

**Deliver**

- The retrieve request's filter, `filterAddOn`, accepts `search.ismatch`, which takes a field list, a parser and an all-words flag per request ([F21](evidence.md#f21)).
- That brings back field scope, all-words matching and fuzzy matching. It filters, though. It doesn't change ranking the way `searchFields` does.
- Tested on "Fronteer": 15 documents with the filter, none without it ([F21](evidence.md#f21)). No answer has been compared end to end yet ([U13](staging-findings.md#u13)).
- Test with the prompts in [O9](runbook.md#o9).

**Pass:** the Amazon Web Services prompt returns the same 10 tagged projects as the Search API, kept separate from mentions, and the Fronteer prompt resolves to 1007814.

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
| ranks 18 projects, names 5 | top score 1.28 against a threshold of 1.5, asks the user to narrow |

- The Retrieval API did this on 4 of the 16 questions ([F23](evidence.md#f23), rows 7, 11, 13, 15).
- With reranking off (work 2), references carry no reranker score at all, so this check has nothing to read.

```
  TODAY
  reranker score   0 ──────────── 1.28 ── 1.5 ─────────►
                                  ▲       ▲
                           top score      narrow-down
                           on the SaaS    gate
                           question

  AFTER WORK 2
  reranker score   absent on every reference, so the gate needs another input
```

A service-side minimum score of 2.5 has been suggested but has no source sentence and is untested ([U3](staging-findings.md#u3)).

**Deliver**

1. Decide what orders projects and what the narrow-down gate reads once references have no reranker score ([O6](runbook.md#o6)). The options are in [search-api-parity.md](search-api-parity.md#ranking-signal):
   - stage 1 order, and narrow down only when few projects come back ([U15](staging-findings.md#u15))
   - a second retrieve with default reranking on the top candidates, read only for its score
   - default reranking on discovery calls only, where a score matters more than completeness
2. Measure where the chosen signal lands across all 16 questions.
3. Set the threshold from that data.

**Pass:** the 4 questions that end in "please narrow down" today get answered, and the other 12 keep the Search API's answer-or-narrow decision.

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
- `x-ms-query-source-authorization`: not tested.

**Deliver**

- The same access columns in `filterAddOn` or `baseFilter` on every retrieve ([U16](staging-findings.md#u16)).
- Every source system covered: WPM, PECT and PSR.

**Pass:** for the same user and question, the Retrieval API shows exactly the projects, documents and citations the Search API shows, on named-project and open-scope questions, for users with different access.

---

## 10. Trace

**Waits for:** 3

**Today**

- chat_similarity writes trace lines to the service log (`KB_TRACE`).
- Any answer traces back to the intents, candidate projects and counts behind it.
- The Retrieval API returns its own execution log, the `activity` array. Its search arguments have no vector field, so it never shows whether a vector search ran.
- Its `count` is taken after the reranker, so a count of 0 doesn't mean nothing was found.

**Example**

- With default reranking, the made-up word `zqxjvwkbhf`, which only vector search can match, shows count 0. That looks like no vector search ran.
- With reranking off it shows 51 candidates, all of them the Search API's own vector matches for the same word ([F8](evidence.md#f8)).

**Deliver**

- Our trace lines, joined to the `activity` array for each retrieve call.
- Each line records the pipeline step, the filter, the project IDs, the result count and the references.

**Pass:** any answer in the regression suite can be reproduced from its trace.

---

## 11. Regression suite

**Waits for:** 5, 6, 7, 8

**Today**

- The 16 questions were run once, by hand, and compared answer by answer.
- Nothing reruns them.
- A change that fixes one question and breaks another only shows up once users hit it.

**Deliver**

- The 16 questions and the eight-project prompt run on demand.
- Each reports pass or fail against the Search API answer, checking:
  - how many projects came back
  - which project IDs
  - whether the flow answered or asked the user to narrow
- Two questions already match and stay in as a guard, so a fix to discovery can't quietly break named-project lookups:
  - "Architect and work support for 1000626"
  - "Is Rocca officially the delivery manager on 1009338?"

**Pass:** the suite runs with no manual step and reports pass or fail per question.

---

## 12. Latency and token cost

**Waits for:** 2, 4, 6

**Today**

- Work 2 sends 50 chunks per project to the answer step, against 4 to 25 with default reranking ([F16](evidence.md#f16)).
- Each retrieve with reranking off took 447 to 1,135 ms in the activity log ([A26](commands.md#a26), [A28](commands.md#a28), [A35](commands.md#a35)). Reranked calls report 0 there, so the two can't be compared from that field ([F8](evidence.md#f8)).
- End-to-end time against the 30-second target, and the token cost of the extra chunks, are unmeasured.

**Deliver**

- Run [O4](runbook.md#o4) for size and time per project, with and without reranking.
- Time each prompt in the regression suite end to end in DEV, and record its token use.
- If the cost breaks the target, revisit [ADR 5](decisions.md#adr-5).

**Pass:** every prompt in the regression suite finishes end to end within 30 seconds in DEV, with its token use reported.

---

## 13. Search API removal

**Waits for:** 1 to 12

**Today**

- chat_similarity keeps the Search API path while the Retrieval API path is built and tested.

**Deliver**

- Remove every Search API call from chat_similarity.
- Keep the Search API answers from the last run as the regression baseline.

**Pass:** the regression suite passes, and no trace line shows a Search API request.
