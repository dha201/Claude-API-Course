# Moving chat_similarity to the Knowledge Retrieval API

chat_similarity runs on the Search API today. We ran 16 user questions through it on both APIs (F23):

```
  16 questions

  Retrieval API worse   ████████████   12
  Same answer           ██              2
  Both declined         █               1
  Mixed                 █               1
```

- The 2 that match both name a project by ID and ask for a stored fact.
- Nothing has to be found, counted or grouped, so both APIs get there.

That run used a knowledge source setup that switched vector search off. We've since found the settings that give the Retrieval API the same document results as the Search API (F16), so document fetch can move. Counting and grouping can't: the retrieve request has no parameter for them. So the Search API stays for those calls, and everything else moves:

```
  STAYS ON SEARCH API             MOVES TO RETRIEVAL API
  ───────────────────             ──────────────────────
  filter counts                   semantic discovery
  field-value lookup              document fetch
  sort by stored value
```

F and O numbers point to [retrieval-api-findings.md](retrieval-api-findings.md), which has the measurements and commands behind every number here.

---

## The work at a glance

| # | Work | Fixes | Waits for |
|---|---|---|---|
| 1 | Gate coverage stamp | Projects with no record row get no lessons | nothing |
| 2 | Evidence fetch settings | The reranker and the output budget cut 50 results to 9 | nothing |
| 3 | Retrieval boundary | Unsupported calls get dropped silently | nothing |
| 4 | Knowledge source field list | The field list switches vector search off | nothing |
| 5 | Discovery keeps its aggregates | No totals, no sort by value | 3 |
| 6 | Document fetch on the Retrieval API | 10 chunks out of 4,259 | 1, 2, 3, 4 |
| 7 | Per-request field scoping | Can't tell an official tag from a mention | 3, 4 |
| 8 | Refusal threshold | Asks the user to narrow on 4 of 16 | 2, 6 |
| 9 | Access control parity | Untested across all projects | 3 |
| 10 | Trace parity | Log can't show whether vector search ran | 3 |
| 11 | Regression suite | 16 questions only run by hand | 5, 6, 7, 8 |

```
  1 Gate coverage stamp ─────────────────────┐
                                             │
  2 Evidence fetch settings ─────────────────┼──► 6 Document fetch ──┐
                                             │         │             │
  4 Knowledge source field list ─────────────┤         ▼             │
                              │              │   8 Threshold ────────┤
  3 Retrieval boundary ───────┼──────────────┘                       │
        │                     └──────────────► 7 Field scoping ──────┤
        ├──► 5 Discovery aggregates ─────────────────────────────────┼──► 11 Regression
        ├──► 9 Access control                                        │      suite
        └──► 10 Trace parity                                         │
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

Project 1012329 on each API (F17):

| | Search API | Retrieval API |
|---|---|---|
| Groups by gate | yes | no |
| Record row to fall back on | none | none |
| Project state | Closed | Unknown |
| Evidence fetch runs | yes | never |
| Closeout chunks searched | 598 | 0 |

At Unknown the flow fetches nothing, so the answer reports no lessons for 1012329. Its lessons are retrievable: queried directly, the Retrieval API returns the same lesson chunks as the Search API (F16).

**Deliver**

- Stamp each project's gate coverage onto every chunk during indexing.
- Project state reads from that field instead of a facet.
- Expected: project 1012329 returns its lessons.
- Works on both APIs, so it's worth doing even if nothing else ships.

---

## 2. Evidence fetch settings

**Waits for:** nothing

**Today**

- The Retrieval API runs hybrid search: keyword search plus vector search on `content_vector`, through the index's vectorizer `ps_text_3_small` (F8).
- It then passes the results through the semantic reranker, which drops most of them, and through an output token budget, which caps what's left.
- chat_similarity sends `rerankerThreshold` 1.0 and the default budget.

**Example**

Project 1009338, 601 Closeout chunks, search text "lessons learned", vector search on:

| Retrieval API request | References | Source |
|---|---:|---|
| default reranking, default budget | 9 | F11 |
| `rerankerThreshold` 0 | 13 | F11 |
| reranking off (`resultsProcessing: "none"`), default budget | 9 | F11 |
| reranking off, `maxOutputSize` 200,000 | 50 | F12 |
| Search API, hybrid + semantic ranker | 50 | F14 |

The 50 are the same 50 chunks the Search API returns (F15). Across all eight projects, default reranking returns 4 to 25 references and loses a lessons chunk on 2 projects; reranking off with the larger budget matches the Search API on every project (F16).

**Deliver**

- On each evidence retrieve: `resultsProcessing: "none"` on the knowledge source entry, `maxOutputDocuments` 50, `maxOutputSize` 200,000, and no `rerankerThreshold` (sending it with `none` returns HTTP 400).
- Anything that sorts or filters on `rerankerScore` changes, because references carry no score with reranking off.
- Measure the token and latency cost of 50 chunks per project against 4 to 25 (O4).
- Expected: the eight-project prompt returns lessons for 7 of 8 projects. 1012329 waits for work 1.

---

## 3. Retrieval boundary

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

On the eight-project prompt, the trace logged 32 retrieve calls and 7 capability gaps (F17). None of it shows in the answer.

```
  TODAY
  step ──► Search API request ──► translate ──► Retrieval API
                                      │
                                      └──► unsupported parts dropped

  AFTER
  step ──► boundary ──┬──► Search API      group, count, sort
                      └──► Retrieval API   rank, field scope
```

**Deliver**

- Every retrieval call goes through one interface.
- Each call says what it needs: rank, group, count, sort or field scope.
- The interface picks the API that can do it.
- Nothing gets dropped silently.
- Moving a step between APIs later is a config change.

---

## 4. Knowledge source field list

**Waits for:** nothing

**Today**

- The Retrieval API can't set search fields per request. It uses the `searchFields` list stored on the knowledge source, for keyword and vector search both.
- Ours holds an explicit list of 29 fields, and `content_vector` isn't one of them.
- A list that doesn't name the vector field switches vector search off. Microsoft doesn't document this; we measured it (F9).

**Example**

Project 1009338, Closeout filter, "lessons learned":

| Knowledge source | Vector search | References | Source |
|---|---|---:|---|
| production, 29-field list | off | 1 | F7, F9 |
| same, list removed | on | 9 | F7 |
| same, list removed, work 2 settings | on | 50 | F12 |

The 1 is the single keyword hit: the Search API with its vector query removed also finds 1 (F14).

**Deliver**

- Remove `searchFields` from the knowledge source the evidence fetch uses. A short list that names `content_vector` also keeps vector search on (F10), with two points still unproven (O5).
- The knowledge source is shared, so try the change on a copy first.
- Expected: the vector half runs, and with work 2 the eight projects match the Search API.

---

## 5. Discovery keeps its aggregates

**Waits for:** 3

**Today**

- chat_similarity uses:
  - facets to find which projects match a filter
  - count to say exactly how many
  - stored values to sort by spend or date
- The retrieve request has no parameter for any of these (O6).

**Example 1**

> "How many SAP projects are there in total?"

| Search API | Retrieval API |
|---|---|
| 47 | no total |

The Retrieval API can only count what it happened to retrieve (F23, row 6).

**Example 2**

> "List projects with Project Solution = 'Hardware Deploy (Infrastructure Hardware)'. Rank by Total Actuals descending, top 10, name/PPL/actuals/duration/status."

| Search API | Retrieval API |
|---|---|
| 10 projects in spend order | 2 projects |
| ZEST 1012929, $13.5M, is sixth | ZEST 1012929 missing |

(F23, row 12)

**Deliver**

- Filter counts, field-value lookups and sort by stored value stay on the Search API, behind the boundary from work 3.
- Expected: 47, and the 10 projects in spend order.

---

## 6. Document fetch on the Retrieval API

**Waits for:** 1, 2, 3, 4

**Today**

- chat_similarity fetches documents per gate, per project, with hybrid search.
- It reranks against a fuller version of the question than the one it searched with.
- The Retrieval API uses one string for both searching and reranking. With reranking off (work 2) that difference drops out.

**Example**

Eight-project prompt on the Retrieval API as deployed (F17):

- The 8 projects hold 4,259 Closeout chunks between them.
- Search API: 45 chunks for project 1009338 alone.
- Retrieval API: 10 chunks across all 8 projects.
- Final answer: lessons for 4 projects, "no lessons found" for 4.
- All 8 have lessons on file.

**Deliver**

- Uses the stamped gate coverage from work 1, the settings from work 2 and the field list from work 4.
- Rerun the eight-project prompt and the 16 questions (O2).
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

(F23, row 1.) Without `searchMode=all`, every word is optional, so a vendor tagged only "AMAZON", or any vendor containing "SERVICES", counts as a match.

**Example 2**

> "Show me data for the Fronteer Upgrade project."

| Search API | Retrieval API |
|---|---|
| answers | declines |

(F23, row 13.) That run used the knowledge source with vector search off, so only keyword search ran, and keyword search has no fuzzy matching without the `full` parser. Whether vector search finds the project once it's on is untested.

**Deliver**

- The Retrieval API's filter accepts a field list, a parser and an all-words flag per request, through `search.ismatch` (F21).
- That brings back field scope, all-words matching and fuzzy matching.
- Tested on "Fronteer": documents found with the filter, none without it (F21).
- Expected: the 10 Amazon Web Services projects, kept separate from mentions, and the Fronteer project found. Not yet tested end to end (O9).

---

## 8. Refusal threshold

**Waits for:** 2, 6

**Today**

- chat_similarity asks the user to narrow down when nothing scores high enough to be a confident match.
- It checks the top reranker score against a threshold of 1.5.

**Example**

> "Which SaaS projects closed in the last two years have a recorded duration under 12 months?"

| Search API | Retrieval API |
|---|---|
| answers | top score 1.28 against a threshold of 1.5, asks the user to narrow |

- The Retrieval API did this on 4 of the 16 questions (F23).
- With reranking off (work 2), references carry no reranker score at all, so this check needs another signal or a separately reranked call.

```
  reranker score   0 ────── 1.0 ────── 1.28 ── 1.5 ─────────►
                            ▲          ▲       ▲
                     threshold we   top score  flow's
                     send on each   on the     narrow-
                     document fetch SaaS q.    down gate
```

A service-side minimum score of 2.5 has been suggested but has no source sentence and is untested (staging U3).

**Deliver**

1. Decide what the narrow-down gate reads once references have no reranker score.
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

- Named projects: 9 of 9 access checks behaved correctly on the eight-project prompt (F17).
- Questions across every project, like the vendor or SAP questions: not tested.

**Deliver**

- Same user, same question: exactly the same projects and documents on both APIs.
- Every source system covered.
- Nothing leaks through citations.

---

## 10. Trace parity

**Waits for:** 3

**Today**

- chat_similarity writes trace lines to the service log.
- Any answer traces back to the intents, candidate projects and counts behind it.
- The Retrieval API returns its own execution log, but its search arguments have no vector field, so it never shows whether a vector search ran.
- Its `count` is taken after the reranker, so a count of 0 doesn't mean nothing was found.

**Example**

- With default reranking, the made-up word `zqxjvwkbhf`, which only vector search can match, shows count 0. That looks like no vector search ran.
- With reranking off it shows 51 candidates, all of them the Search API's own vector matches for the same word (F8).

**Deliver**

- One trace format on both APIs, joined to the Retrieval API's execution log.
- Any answer can be reproduced from its trace, whichever API served it.

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
