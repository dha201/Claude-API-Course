# Retrieval API findings for Project Similarity

Service `workdeliverygpt-dev-srch`, index `project_similarity_index`, Retrieval API version `2026-08-01-preview`. Every measured number carries a finding ID (F1 to F23), and every command that produced one is in the Appendix (A1 to A37). Every Microsoft quote was checked on its current page on 2026-09-18.

## Question and status

Can the Azure AI Search Retrieval API (a knowledge base over a knowledge source, at `minimal` reasoning effort) replace the Search API for document retrieval in `chat_similarity`?

Across 16 user prompts graded answer by answer, the Retrieval API path was worse on 12, gave the same answer on 2, both paths declined 1, and 1 was mixed (F23). The failures fall into three groups:

| Failure | What happens | Status |
|---|---|---|
| Evidence fetch | The production setup returns 1 reference for `lessons learned` on a project whose 601 Closeout chunks give the Search API 50 results | Solved by configuration: parity with the Search API on all eight test projects (F16). Not yet applied in `chat_similarity` (O2) |
| Gate list | The retrieve request has no `facets`, so `gates_present` comes back empty. A project with no record row then resolves to state Unknown and gets no evidence call. This hit project 1012329 in the eight-project run (F17) | Needs a redesign (O6) |
| Count and sort | The retrieve request has no `count` and no `orderby`. "How many SAP projects are there in total?" gets 47 on the Search API and no total on the Retrieval API. "Top 10 Hardware Deploy by spend" can't be ordered by spend (F23) | Needs a redesign (O6) |

The last two are gaps in the retrieve contract. No workaround is proven and none is ruled out. An MCP server knowledge source could, for example, return counts and groups computed by our own code, and that's untested.

Project 1009338, filter `project_id eq '1009338' and gate_label eq 'Closeout'` (601 chunks), query `lessons learned`:

```
  Search API, hybrid + semantic ranker, top 50                    50 results      F14
  Retrieval API, production knowledge source                       1 reference    F7
  Retrieval API, searchFields removed                              9 references   F7
  Retrieval API, searchFields removed, reranking bypassed,        50 references   F12, F15
    maxOutputSize 200,000                                          (the same 50 chunks as the Search API)
```

The next step runs in the application repository: apply "Configuration that works" to `chat_similarity`, then rerun the eight-project prompt and the 16-prompt evaluation (O2).

## How a retrieve runs

Per knowledge source, one retrieve request goes through three stages. Each stage has a setting that decides how much survives:

```
1. Retrieval    BM25 over searchFields  +  vector query through the index vectorizer
                merged, filter applied; candidates follow maxOutputDocuments
                under resultsProcessing "none" (200 at 200, F13)
                     │
2. Reranker     semantic ranker (L2) scores each candidate and drops those
                below rerankerThreshold            ← resultsProcessing "none" skips this stage
                activity count = candidates that survive
                     │
3. Output       deduplication, per-source and document limits, token budget
                (maxOutputSize) → references       ← 200,000 lifts the budget
```

Activity `count` is taken after stage 2. The retrieve contract defines it as "The count of documents retrieved that were sufficiently relevant to pass the reranker threshold." ([TypeSpec, models-knowledgebase.tsp](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/search/data-plane/Search/models-knowledgebase.tsp)). So a count of 0 doesn't mean stage 1 found nothing.

With reranking on, stage 1 hands the ranker at most 50 candidates: "Each subquery reranks up to 50 chunks." ([Agentic retrieval overview, Estimated billing costs](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview)).

`resultsProcessing: "none"` behaves like this, all from [Query a knowledge base, Disable reranking for a knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve):

- It exists from `2026-08-01-preview`: "Starting with the 2026-08-01-preview API version, set `"resultsProcessing": "none"` on a knowledgeSourceParams entry to bypass reranking for a specific knowledge source and preserve its underlying result order."
- Candidates keep their stage 1 order and references carry no `rerankerScore`: "References from the knowledge source omit `rerankerScore`, and results keep their underlying order within the source's retrieval activity. When any source bypasses reranking, Azure AI Search distributes final results across activities in round-robin order, following knowledge source declaration order. Reranked activities stay ordered by score."
- Sending `rerankerThreshold` in the same request fails: "If the resolved value is none and the request includes rerankerThreshold, Search returns 400 Bad Request."
- Stage 3 still applies: "Deduplication and per-source, document, and token limits still apply, so not every retrieved result appears in the response."
- The service resolves the value from `resultsProcessing` in `knowledgeSourceParams`, then the value stored on the knowledge source, then `rerank`.

## What each setting controls

The pipeline has one control per job. `resultsProcessing` switches the reranker on or off, and `rerankerThreshold` tunes it. `searchFields` picks fields, and it turns the vector query off only as a side effect.

| Setting | Set on | Stage | What it does | Measured |
|---|---|---|---|---|
| `intents[].search` | request | 1, both lanes | Query text. BM25 matches it; the index vectorizer embeds it | |
| `searchFields` | knowledge source | 1 | Fields the query runs against, for both lanes. An explicit list without `content_vector` turns the vector query off | 1 against 50 (F9); a list with `content_vector` keeps it on (F10) |
| vectorizer, vector field | index | 1, vector | Embeds the query text. The field must be `searchable` with a profile naming a vectorizer | works through the proxy (F8) |
| `filterAddOn`, `baseFilter` | request, knowledge source | before 1 | Yes or no eligibility, applied to both lanes | vector neighbours respect the filter (F8) |
| `resultsProcessing` | request or knowledge source | 2 | `rerank` (default) or `none` (skip the reranker) | 9 to 50 references (F12) |
| `rerankerThreshold` | request | 2 | Minimum reranker score. HTTP 400 with `none` | 9 to 13 references (F11) |
| `semanticConfigurationName` | knowledge source | 2 | Fields the reranker reads | a blank index default still resolves (F3) |
| `maxOutputDocuments` | request and source | 1 and 3 | Candidate count under `none`, and the reference cap. 50 to 200 only | 200 candidates at 200 (F13) |
| `maxOutputSize` | request | 3 | Token budget for references | 9 to 50 references (F12) |

**What controls the BM25 lane.** The query text, `searchFields`, the index's analyzers and synonym maps, and `queryHints` (boosts that switch the executed query to `full`). The request can't set `queryType` or `searchMode`: "For knowledge sources that target a search index, the implied query type is `semantic`, and there's no search mode." ([Query a knowledge base, Search index behavior](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)). "Semantic" here means BM25 with the default parser plus the reranker, so with `resultsProcessing: "none"` what runs is plain hybrid: BM25 and vector, merged. Microsoft calls the merged order "underlying result order". That it's RRF is assumed, not documented.

**`search.ismatch` doesn't conflict with the locked query type.** They act in different places:

```
                   BM25 lane                    search.ismatch(...) in filterAddOn    plain OData filter
 job               score and rank chunks        include or exclude by text match      include or exclude by value
 syntax            fixed (semantic, default     its own queryType simple|full and     eq, ne, and, or
                   parser, no searchMode)       searchMode any|all
 fields            searchFields                 its own field argument                named in the expression
 changes ranking   yes                          no                                    no
 narrows vector    no                           yes                                   yes
```

`search.ismatch` is the bouncer and the hybrid search is the judge. It decides which chunks may compete, and the lanes rank what's left. Use it for a hard text rule, for example a required phrase. It excludes lessons prose that doesn't match the expression even when the vector lane would have found it.

**The Search API and the knowledge base take fields differently.**

- Search API: two independent lists. `searchFields` for the keyword lane, `vectorQueries[].fields` for the vector lane. A vector can be passed as text (`"kind": "text"`, the service embeds it) or precomputed (`"kind": "vector"`, `"vector": [1536 floats]` from `text-embedding-3-small`).
- Knowledge base: one list, `searchFields` on the knowledge source, shared by both lanes. The retrieve request has no `vectorQueries`, no vector, no `k` and no vector field. `intents[]` takes only `type: "semantic"` and a `search` string, and the service always embeds that text with the index vectorizer.

```
 searchFields on the knowledge source            keyword lane            vector lane   lessons learned refs
 production list, 29 fields, no content_vector   the listed fields       off            1    (F9)
 [body, content_vector]                          body                    on            50    (F10)
 omitted or []                                   every searchable field  on            50    (F9)
```

Two points about lists that name `content_vector` are unproven: that the keyword lane stays limited to the listed text fields (vector results fill all 50 either way), and that the service stores the list exactly as sent (O5).

## Findings

Setup for F7 to F16 unless a finding says otherwise:

- `ps-kb-allfields`: a single-source knowledge base over `ps-ks-allfields`, a copy of the production knowledge source with `searchFields` set to `[]`. `minimal` effort, no models, `outputMode: extractiveData`.
- `ps-kb-isolated`: a single-source knowledge base over the production knowledge source `knowledgesource-1788979786196`.
- `intents` with `type: semantic`, project 1009338, filter `project_id eq '1009338' and gate_label eq 'Closeout'` (601 chunks), query `lessons learned`.
- refs = references returned, count = activity `count`.
- "lesson" = returned chunks whose `body` matches the regex `lesson`. It's a rough measure: lessons prose without the word isn't counted.

### F1. The index vectorizer works from the Search API

2026-09-17 and 2026-09-18. A1, A2, A20.

- `vectorQueries` with `kind: "text"` makes the service call the vectorizer. With no filter it returned 3 results: 0.7561, 0.7460, 0.7443.
- Vectorizer `ps_text_3_small`: kind `azureOpenAI`, `resourceUri` an internal proxy host with a `/wdgpt` path, `deploymentId` and `modelName` `text-embedding-3-small`, key auth, `authIdentity` unset, `customWebApiParameters` empty.

The service reaches the embedding model through the proxy with key auth.

### F2. The embedding model matches the index

2026-09-17. A5, A11.

Same vectorizer, same filter, vector-only queries:

```
  "lessons learned from this project closeout, what went well and what went wrong"   0.6313 to 0.6465
  "retrospective observations on what the delivery team would repeat"                0.0620 to 0.0824
```

A mismatched embedding model can't produce that separation.

### F3. Service and index settings

2026-09-18. A22, A23.

```
  Service     sku standard, computeType Default, semanticSearch standard, knowledgeRetrieval standard
  Index       one vector field, content_vector: Collection(Edm.Single), 1536 dimensions,
              searchable, retrievable and stored all true
              profile content-vector-hnsw-profile: algorithm content-vector-hnsw-config (hnsw),
              no compression, vectorizer ps_text_3_small
              one semantic configuration, default; semantic.defaultConfiguration blank
```

Retrieval still resolves a semantic configuration and returns reranker scores with the index default blank. These settings rule out confidential computing, free-tier knowledge retrieval billing, a second vector field and a profile without a vectorizer.

### F4. The production knowledge base queries three knowledge sources

2026-09-17. A7, A12.

```
  knowledgesource-1788979786196    project_similarity_index
  knowledgesource-1789660272864    ldp_index
  knowledgesource-1789660431937    dbr_index
```

One retrieve with `filterAddOn` on the first source returned 28 references from three `searchIndex` activities: count 1 (filtered), 50 and 33 (unfiltered). `knowledgeSourceParams` configures a source; it doesn't select one. Any reference count from the production knowledge base mixes three indexes, so every later measurement uses a single-source knowledge base.

### F5. The retrieve request at `minimal` effort

- `messages` returns HTTP 400 `Messages input not supported when 'minimal' reasoning effort is requested. Use intents input instead.` (A6, 2026-09-17).
- `intents[].type` accepts only `semantic`. `keyword`, `vector`, `hybrid`, `simple` and `full` each return HTTP 400 `Valid types are: semantic` (production knowledge base, command and date not recorded).
- `retrievalReasoningEffort` `low` or `medium` returns HTTP 400 `A Knowledge Base model must be specified`, and `outputMode: answerSynthesis` returns HTTP 400 `A model must be specified` (same run).

### F6. `maxOutputDocuments` accepts only 50 to 200

2026-09-18. A27.

49 returned `Value for MaxOutputDocuments must be between 50 and 200.` Any record of 1 or 10 returning "count 1" comes from a failed call that printed a false count (Pitfalls).

### F7. Single-source baselines with default settings

2026-09-17. A10, A14 to A19. Per-source `maxOutputDocuments` 50, default reranking, default token budget.

```
  knowledge base                     knowledge source                    query             refs  count
  ps-kb-isolated                     production                          lessons learned     1     1
  ps-kb-allfields                    ps-ks-allfields (searchFields [])   lessons learned     9     9
  ps-kb-allfields                    ps-ks-allfields                     zqxjvwkbhf          0     0
  production knowledge base (F4)     all three                           zqxjvwkbhf          0     0, 0, 0
```

The gain from 1 to 9 comes from the vector query, which the production list turns off (F9). The 0 for the gibberish token is the reranker dropping every vector neighbour (F8).

### F8. The Retrieval API runs the vector query

2026-09-18. A9, A28, A29.

`zqxjvwkbhf` is in no document, and BM25 returns 0 for it (A9). On `ps-kb-allfields`, per-source `maxOutputDocuments` 51, 15 seconds after each knowledge source PUT:

```
  searchFields     query             mode     refs  count  ms
  []               zqxjvwkbhf        rerank     0      0     0
  []               zqxjvwkbhf        none       7     51   477
  []               lessons learned   rerank    10     10     0
  []               lessons learned   none       9     51   643
  content_vector   zqxjvwkbhf        rerank     0      0     0
  content_vector   zqxjvwkbhf        none       7     51   513
  content_vector   lessons learned   rerank    10     10     0
  content_vector   lessons learned   none       9     51   451
```

With reranking bypassed, the knowledge base finds 51 candidates for a token no keyword query can match. A Search API vector-only query for the same token (`k` 51, same filter) returned 51 neighbours, and all 7 knowledge base references are among them, matched on the index key `psr_row_id` (A29). So the Retrieval API runs the vector query through the proxy vectorizer, and the filter applies to it. With default reranking, the semantic ranker drops every one of those neighbours, so the count reads 0.

Reference keys look like `1009338_1009338-1009338-g3-itcash-sdwan-2023-closeout-86f644863c06ccb2_chunk_435`. `elapsedMs` reads 0 on every reranked row, including requests never sent before, so it's a reporting quirk, not a cache.

### F9. An explicit `searchFields` list without `content_vector` turns the vector query off

2026-09-18. A33, A35, A36.

`resultsProcessing: "none"`, `maxOutputSize` 200,000, `maxOutputDocuments` equal on the request and the source:

```
  knowledge base    max   query             refs  count    ms
  ps-kb-isolated     50   zqxjvwkbhf          0      0     59
  ps-kb-isolated     50   lessons learned     1      1     16
  ps-kb-allfields    50   zqxjvwkbhf         50     50   1135
  ps-kb-allfields    50   lessons learned    50     50    545
  ps-kb-allfields   200   zqxjvwkbhf        159    200    612
  ps-kb-allfields   200   lessons learned   143    200    447
```

With reranking bypassed, the production knowledge source still finds no candidate for the gibberish token, so no vector query runs on it. Its single `lessons learned` result matches the Search API's BM25-only result count of 1 (A33). The two knowledge sources differ only in `searchFields`: the production one stores an explicit list, which reads back as 29 fields with no `content_vector` (A36), and `ps-ks-allfields` stores `[]`. This is the cause of 1 against 9 in F7. No Microsoft page says an explicit list turns the vector query off (see "Microsoft documentation").

The field names in the production list are open (O1). The executed list in the activity array (A8) was transcribed by hand as 28 text fields without `body` or `content_vector`, and some transcribed names are low confidence.

### F10. `searchFields` values that keep the vector query on

2026-09-18. A24, A26, A28, A36. On `ps-ks-allfields`:

```
  searchFields                                  query             mode     refs  count   command
  absent; [{"name":"*"}]; absent with           lessons learned   rerank      9      9   A24
    semanticConfigurationName "default"
  []                                            zqxjvwkbhf        none        7     51   A28
  [{"name":"content_vector"}]                   zqxjvwkbhf        none        7     51   A28
  production list (29) + content_vector         zqxjvwkbhf        none       50     50   A36
                                                lessons learned   none       50     50
  [body, content_vector]                        zqxjvwkbhf        none       50     50   A36
                                                lessons learned   none       50     50
```

The 9 references with reranking on need the vector query, because BM25 over every field returns 1 result for `lessons learned` (A33). The gibberish rows can only come from the vector query. So a narrow keyword list is safe if it names `content_vector`. Two points about such lists are unproven (O5).

Right after the PUT that set `[{"name":"content_vector"}]`, one `lessons learned` retrieve returned 0 (A24). It didn't repeat after a 15-second wait (A26, A28), so it was propagation delay.

### F11. The reranker threshold cuts candidates

2026-09-18. A26, A30. Per-source `maxOutputDocuments` 50, default token budget.

```
  mode                                             refs  count  lesson   command
  default reranking                                  9      9      2      A26, A30
  rerankerThreshold 0                               13     13             A26
  rerankerThreshold 0, request maxOutputDocuments 50 13     50      2      A30
  resultsProcessing "none"                           9     50      2      A26, A30
  failOnError true                                   9      9             A26
```

Default reranking keeps 9 of 50 candidates (10 of 51, F8). Threshold 0 keeps 13. With reranking bypassed, all 50 candidates pass stage 2 but references stay at 9, because the default token budget caps them (F12). `failOnError: true` raised no error.

A threshold sweep on the production knowledge source can't show a cut: its only survivor scores 3.846, above every tested threshold (F20).

### F12. The output token budget capped references near 9

2026-09-18. A30, A32.

`ps-kb-allfields` stores `retrieveDefaults: null`, `models: []`, `outputMode: extractiveData`, `retrievalReasoningEffort: minimal`, and null `retrievalInstructions` and `answerInstructions`. `resultsProcessing: "none"`, `maxOutputDocuments` 50 on the request and the source:

```
  maxOutputSize   refs  count  lesson   command
  default            9     50      2    A30
   50,000           38     50      2    A32
  200,000           50     50      2    A32
```

The request-level `maxOutputDocuments` alone doesn't lift references past 9 (A30). The retrieve page says a request-level `maxOutputDocuments` with no token limit "Returns up to the specified number of grounding documents and doesn't apply a maxOutputSizeInTokens limit." and also "A document that exceeds the maxOutputSizeInTokens output budget can be omitted from the response." ([Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)). On this project the default budget still cut references to 9, and an explicit `maxOutputSize` lifted them. `maxOutputSize` is the `2026-05-01-preview` and later name for `maxOutputSizeInTokens` (same page).

On project 1012173 (88 chunks), `*` reached 50 references at the default budget (F18). Why the default budget binds at 9 on 1009338 and not there is unmeasured.

### F13. With reranking bypassed, candidates follow `maxOutputDocuments`

2026-09-18. A28, A35.

Candidates are 51 at 51 (F8), 50 at 50 and 200 at 200 (F9 table). At 200, the 200,000-token budget cuts references to 159 for the gibberish token and 143 for `lessons learned`. With reranking on, candidates stop at the ranker's 50-chunk window (see "How a retrieve runs").

### F14. Search API baseline on project 1009338

2026-09-18. A33. `top` 50, `select` `body`, same filter.

```
  mode              results  lesson
  BM25 only             1       1
  vector only          50       2
  hybrid               50       2
  hybrid+semantic      50       2
```

BM25 over every field finds 1 result for `lessons learned`, and the vector query supplies the rest. Both APIs return the same 2 chunks that mention "lesson", and the default-rerank knowledge base run already held those 2 (F11).

### F15. The knowledge base returns the same 50 chunks as the Search API

2026-09-18. A37. Project 1009338 only.

The knowledge base's 50 references (`resultsProcessing: "none"`, `maxOutputDocuments` 50, `maxOutputSize` 200,000) are the same 50 chunks as the Search API's top 50 for hybrid and for hybrid with the semantic ranker: overlap 50 of 50, matched on `psr_row_id`. Both lesson-mentioning chunks are among them. On the other seven projects only the counts were compared (F16, O3).

### F16. Parity on all eight projects

2026-09-18. A34. Closeout filter per project, `lessons learned`. Search API: hybrid with the semantic ranker, `top` 50. Knowledge base: `ps-kb-allfields`, `maxOutputDocuments` 50 on the request and the source, `maxOutputSize` 200,000. Each cell is results, then lesson.

```
  project   Search API hyb+sem   KB default rerank   KB resultsProcessing none
  1009338   50, 2                 9, 2                50, 2
  1009392   50, 2                 4, 1                50, 2
  1010069   11, 1                11, 1                11, 1
  1011517   50, 2                25, 2                50, 2
  1011718   50, 1                 8, 1                50, 1
  1011742   50, 2                13, 2                50, 2
  1012268   50, 2                 8, 1                50, 2
  1012329   50, 2                 5, 2                50, 2
```

- With reranking bypassed and the larger budget, the knowledge base matches the Search API's result count and lesson count on every project.
- Default reranking keeps 4 to 25 references and drops a lesson chunk on 1009392 and 1012268.
- 1012329 returns lesson chunks when queried directly, so its production failure is the lost gate list (F17), not retrieval.

### Measured with no command in the Appendix

F17 to F23 come from the application trace, the evaluation sheet and runs from before 2026-09-17. Their commands weren't recorded, so each gives its source and the date where one exists.

### F17. The eight-project prompt through the deployed pipeline

2026-09-16 20:13 UTC, deployed DEV pod, `KB_TRACE`. Production knowledge base, so the vector query was off (F9). The evidence fetch sent `rerankerThreshold` 1.0, `maxOutputDocuments` 50 and the default token budget.

> Extract all lessons learned for these eight project IDs: 1009338, 1009392, 1010069, 1011517, 1011718, 1011742, 1012268, 1012329. Structure the result by project number and name, brief description, and interpret whether each lesson learned is positive or negative impact and categorize the theme of the learning (if you cannot interpret the impact category, just show the exact lesson learned).

The trace logged `32 retrieve call(s), 7 capability gap(s)`: 16 profiling calls, 7 evidence calls and 9 access-control probes.

- Profiling sent `facets: ['gate_label,count:15']`, and the translation layer dropped it, so `gates_present` came back empty for all 8 projects.
- 7 projects had a record row with `work_status` Completed, so they resolved to Closed. 1012329 had no record row, so `_state_from_gates([])` returned Unknown. `POLICY_TABLE['lessons']['Unknown']` is empty, so no evidence call went out and its 598 Closeout chunks were never queried.
- The 9 access-control probes all behaved correctly.

Evidence fetch per project:

```
  project   Closeout chunks   references   kept
  1009338        601               1        0.17%
  1009392        592               1        0.17%
  1010069         14               4       28.6%
  1011517        621               1        0.16%
  1011718        608               1        0.16%
  1011742        610               1        0.16%
  1012268        615               1        0.16%
  1012329        598         no call           0%
  total        4,259              10        0.23%
```

The trace's summary line recorded 9 references; the per-project rows sum to 10. The Search API path on the same prompt returned 45 chunks for 1009338. The Retrieval API answer gave lessons for 4 projects (1009338, 1009392, 1010069, 1011517) and "no lessons found" for 4, while all 8 hold lessons in their Closeout documents (F23, row 16).

Gate distribution, read from the index with Search API facets:

```
  1009338  CP 3/Pre-Startup=1932, Gate 3=641, Closeout=601            (3,176 total)
  1009392  Gate 3=1219, Gate 2=635, Gate 1=623, Closeout=592, CP3=34  (3,105 total)
  1010069  Gate 3=1198, Gate 1=677, CP3=654, Closeout=14, Pre-G1=2    (2,547 total)
  1011517  Gate 2=1804, Gate 1=1787, Gate 3=627, Closeout=621         (4,841 total)
  1011718  Gate 3=1235, Closeout=608, Pre-Gate 1=3                    (1,848 total)
  1011742  Gate 3=3035, Gate 2=657, Closeout=610, Pre-Gate 1=6        (4,310 total)
  1012268  Gate 2=1243, Gate 3=661, Closeout=615, Pre-Gate 1=11       (2,532 total)
  1012329  Gate 3=607, Closeout=598, Gate 1=595, Pre-Gate 1=2         (1,804 total)
```

### F18. Single-project sweep on project 1012173

2026-09-15. Production knowledge base and knowledge source, so the vector query was off (F9). `filterAddOn: "project_id eq '1012173'"` (88 chunks). All nine calls returned HTTP 200.

```
  configuration                                      references   source retrieved
  search 'lessons learned', defaults                          4                  4
  same, rerankerThreshold 1.0                                 4                  4
  same, rerankerThreshold 0.0                                 4                  4
  same, maxOutputDocuments 200                                4                  4
  search '*', rerankerThreshold 0.0, 200 documents           50                 50
  search '*', resultsProcessing "none", 200 documents        50                 50
  search '*', token budget 10,000                            13                 50
  search '*', token budget 50,000                            50                 50
  search '*', token budget 200,000                           50                 50
```

- Every returned chunk belonged to project 1012173. The filter decides which chunks may appear; it doesn't make every chunk appear.
- Source retrieved stayed at 50 with `resultsProcessing: "none"` and 200 documents, where F13 predicts up to 88. The run didn't record whether 200 was set on the request, the source or both.

### F19. Search API components on project 1009338

Date not recorded, before 2026-09-17. The `chat_similarity` payload from `_fetch_document_rank()`: `search` `lessons learned`, `searchFields` on 13 content fields, a precomputed vector with `k` 50, `queryType` semantic with a separate `semanticQuery` holding the full question, `top` 50, Closeout filter.

```
  variant                              results
  production payload                        50
  vector query removed                       1
  semantic ranker removed                   50
  BM25 only                                  1
  vector only                               50
```

- `top` 1, 10, 50 and 200 returned 1, 10, 50 and 200.
- The search strings `lessons`, `lessons learned`, `what went well and what went wrong` and `project closeout lessons takeaways` each returned 50.
- The one BM25 hit scores 8.95.

A33 repeated BM25 only and vector only on 2026-09-18 with the same counts (F14).

### F20. Production knowledge source: query text and threshold

Date not recorded, before 2026-09-17. Project 1009338 Closeout, production knowledge base, per-source `maxOutputDocuments` 50, default token budget. The vector query is off on this knowledge source (F9), so these counts are BM25 matches over the listed fields that survive the reranker.

```
  setting varied           values                                   activity count
  rerankerThreshold        1.0, 0.0, 2.0, 3.0, omitted              1 each; survivor scores 3.846 (3.849 omitted)
  maxOutputDocuments       50, 200                                  1 each
  intents[0].search        'lessons'                                1
                           'lessons learned'                        1
                           'what went well and what went wrong'     48
                           'project closeout lessons learned
                            takeaways…'                             50
                           '*'                                      50
```

```
  query                                                            references   carrying lessons prose
  lessons learned                                                        1        1
  the full semanticQuery sentence                                       45        2
  project closeout lessons learned takeaways drivers of success         23        2
```

Longer strings add 21 to 43 references that carry no lessons prose. The threshold sweep says nothing about the threshold, because every tested value keeps the 3.846 survivor (F11 measures the cut).

### F21. `search.ismatch` in `filterAddOn` parses and filters

Date not recorded. Production knowledge base, 7 requests, all HTTP 200, each filter echoed back in the activity array.

```
  filterAddOn                                                         documents matched
  search.ismatch('Yusoff','roles_project_sponsor,roles_work_lead')                   9
  search.ismatch('Fronteer~1','title','full','any')                                15
  search.ismatch('Amazon Web Services','vendors','simple','all')                   50
  the Amazon filter and gate_label eq 'Closeout'                                    6
```

- `Fronteer` with no `filterAddOn` returned 0 documents. The production knowledge source runs BM25 only (F9), so that 0 is keyword search without fuzzy matching.
- `vendors/any(v: search.ismatch('Kinaxis'))` is rejected: no lambdas.
- `search.ismatch('q','field','full')` is a syntax error: arguments 3 and 4 come as a pair.

Not measured: the no-filter baselines, whether the returned documents carry the content asked for, `simple` against `full` and `any` against `all` on one string, `search.ismatchscoring`, and whether any failing prompt passes with the filter in the pipeline (O9).

### F22. Four intents in one retrieve request

Date not recorded. Production knowledge base (three sources, F4).

4 intents returned 57 references, with per-intent counts 4, 21, 50 and 13 (sum 88). The knowledge source configuration wasn't recorded, and neither was whether the drop from 88 to 57 is deduplication or an output cap. The test in `staging-findings.md` (U8) re-measures it on a single-source knowledge base.

### F23. Sixteen-prompt evaluation

Source: `Project Similarity/kb_vs_search_eval.csv`, one row per prompt, column "Verdict". Production knowledge base, so the vector query was off on the evidence fetch (F9). Date not recorded.

Grading rule: "worse" means the Retrieval API answer drops projects, facts or lessons that the Search API answer has, or declines where the Search API answers.

```
  Retrieval API worse   12   rows 1 to 7, 11, 12, 13, 15, 16
  same answer            2   rows 9, 10
  both declined          1   row 8
  mixed                  1   row 14: both return results, 3 projects overlap, each adds others
```

- Row 16 is the eight-project prompt. Both return lessons, the Retrieval API for 4 of 8 projects and the Search API for 7 plus 1 listed as "retrospective observations".
- On rows 7, 11, 13 and 15 the Retrieval API asked the user to narrow the question where the Search API answered. On row 15 the top reranker score was 1.28 and on row 7 it was 1.49, both against the flow's threshold of 1.5.

Rows other documents cite:

| Row | Prompt | Search API | Retrieval API |
|---|---|---|---|
| 1 | "Which projects officially list Amazon Web Services as a vendor?" | 10 tagged projects | none confirmed |
| 3 | "Which projects officially list Kinaxis as a vendor?" | 3 tagged, plus 2 listed as mentioned only | 1 project |
| 6 | "How many SAP projects are there in total?" | 47 | no total |
| 12 | Project Solution 'Hardware Deploy (Infrastructure Hardware)', top 10 by Total Actuals | the 10 asked for, in spend order | 2 projects; ZEST 1012929 ($13.5M, sixth by spend) missing |
| 13 | "Show me data for the Fronteer Upgrade project." | resolves the misspelling to 1007814 | declines |
| 15 | "Which SaaS projects closed in the last two years have a recorded duration under 12 months?" | ranks 18 projects, names 5 | declines |

### Finding ID map

Older documents and scratch files label the same facts differently.

| Handoff label | Finding | | Staging label | Finding |
|---|---|---|---|---|
| V1 | F1 | | V1 | F1 |
| V2 | F2 | | V2 | F2 |
| V3 | F7, F8 | | V3 | F8 |
| V4 | F4 | | V4 | F4 |
| V5 | F5 | | V5 | F5 |
| V6 | F9 | | V6 | F9 |
| V7 | F7 | | V7 | F7 |
| V8 | F3 | | V8 | F11, F12 |
| V9 | F10 | | V9 | F11 |
| V10 | F11 | | V10 | F6 |
| V11 | F8 | | V11 | F10 |
| V12 | F8, F11 | | V12 | F3 |
| V13 | F12, F14 | | | |
| V14 | F16 | | | |
| V15 | F9, F13 | | | |
| V16 | F10, F15 | | | |

## Configuration that works

These settings gave parity with the Search API on all eight projects (F16) and the same 50 chunks on 1009338 (F15):

- **Knowledge source.** Remove `searchFields` (the Retrieval API then searches every searchable field, `content_vector` included). A narrow list that names `content_vector` also keeps the vector query on (F10), with two unproven points (O5).
- **Retrieve request, the `knowledgeSourceParams` entry for the search index.** `resultsProcessing: "none"` and `maxOutputDocuments` 50.
- **Retrieve request, top level.** `maxOutputDocuments` 50 and `maxOutputSize` 200,000.
- **Not sent.** `rerankerThreshold`, which returns HTTP 400 together with `none`.

Trade-offs:

- **Precision.** Default reranking returns 4 to 25 references and drops a lesson chunk on 2 of 8 projects. `none` returns 50 per project and loses none (F16). On 1009338 the 9 reranked references and the 50 unreranked ones hold the same 2 lesson chunks (F11, F12), so `none` sends 41 more chunks for no extra lesson chunk there. How many of the 50 carry lessons prose without the word "lesson" is unmeasured (O4).
- **Tokens.** Fifty references per project cost more tokens in the answer step than 4 to 25. The size is unmeasured (O4).
- **Latency.** Activity `elapsedMs` under `none` ranged from 447 to 1,135 ms per retrieve (A26, A28, A35). Reranked rows report 0, a reporting quirk (F8), so the two modes can't be compared from `elapsedMs`. Wall-clock time against the 30-second target is unmeasured (O4).
- **Scores.** References under `none` carry no `rerankerScore`, so any code that sorts or filters on it must change.
- **`maxOutputDocuments` 200.** Returns 143 to 159 references at the 200,000 budget (F13). Nothing measured needs it.
- **Gate list.** 1012329 still gets no evidence call until the gate-list failure is fixed (F17, O6).

## Implementation

For the implementation agent working in the `chat_similarity` repository. It encodes F9 to F16. It was not run from this repository; the request bodies match the ones that ran in A32 to A37. It uses plain REST because `resultsProcessing` exists only from `2026-08-01-preview` (and `maxOutputSize` from `2026-05-01-preview`), and whether the `azure-search-documents` Python SDK exposes them is unchecked.

```python
import os
import requests

ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"]
HEADERS = {"api-key": os.environ["AZURE_SEARCH_API_KEY"], "Content-Type": "application/json"}
API = "2026-08-01-preview"

KS = "knowledgesource-1788979786196"   # production knowledge source
KB = "knowledgebase-1788979805148"     # production knowledge base


# 1. Knowledge source: keep vector search on.
#    Either omit searchFields entirely, or list content_vector with the text fields.
#    A PUT replaces the whole definition, so read it first and keep everything else.
ks_url = f"{ENDPOINT}/knowledgesources/{KS}?api-version={API}"
ks = requests.get(ks_url, headers=HEADERS).json()
ks.pop("@odata.context", None)
ks.pop("@odata.etag", None)

params = ks["searchIndexParameters"]
params.pop("searchFields", None)                                   # option A: no list
# params["searchFields"] = [{"name": "body"}, {"name": "content_vector"}]  # option B: narrow list

requests.put(ks_url, headers=HEADERS, json=ks).raise_for_status()


# 2. Retrieve: reranker off, 50 candidates, token budget large enough for 50 references.
def fetch_evidence(project_id: str, query: str) -> list[dict]:
    body = {
        "intents": [{"type": "semantic", "search": query}],
        "knowledgeSourceParams": [
            {
                "knowledgeSourceName": KS,
                "kind": "searchIndex",
                "filterAddOn": f"project_id eq '{project_id}' and gate_label eq 'Closeout'",
                "includeReferences": True,
                "includeReferenceSourceData": True,   # index values in sourceData
                "resultsProcessing": "none",          # skip the L2 reranker
                "maxOutputDocuments": 50,             # 50 to 200; sets the candidate count
            }
        ],
        "maxOutputDocuments": 50,
        "maxOutputSize": 200000,                      # default budget caps references near 9
        "includeActivity": True,
        # Do NOT send rerankerThreshold with resultsProcessing "none": HTTP 400.
    }
    url = f"{ENDPOINT}/knowledgebases/{KB}/retrieve?api-version={API}"
    r = requests.post(url, headers=HEADERS, json=body)
    r.raise_for_status()
    return [ref["sourceData"] for ref in r.json().get("references", []) if ref]


chunks = fetch_evidence("1009338", "lessons learned")
print(len(chunks))  # expect 50
```

Before porting:

- The production knowledge base holds three knowledge sources (F4). `knowledgeSourceParams` configures a source, it doesn't select one, so `ldp_index` and `dbr_index` are queried too. Use a single-source knowledge base for the evidence fetch, or `neverQuerySource: true` on the other two, which is untested at `minimal` effort (O7).
- Changing the production knowledge source affects every caller. Try the change on `ps-ks-allfields` and `ps-kb-allfields`, or a new single-source pair, first.
- References under `none` carry no `rerankerScore`. Code that sorts or filters on it must change.
- In PowerShell, load `. .\src\api\env.ps1` (or the application's equivalent) first: a missing key makes every call fail with `Object reference not set to an instance of an object` (A31).

## Capability gaps not fixed by configuration

`chat_similarity` discovery runs four operations. The Retrieval API supports the first, and the fourth through a filter function:

```
                                 what the question needs           Search API       Retrieval API
  1.  Rank chunks                documents that read alike         ✓                ✓
  2.  Group by field             one bucket per project            ✓ facets         ✗ no parameter
  3a. Count                      the exact total                   ✓ count          ✗ no parameter
  3b. Sort                       order by a stored number          ✓ orderby        ✗ no parameter
  4a. Scope the field            look only in the roles field      ✓ searchFields   ✓ via search.ismatch
  4b. Fuzzy match                survive a misspelling             ✓ queryType full ✓ via search.ismatch
  4c. All words                  every word of the vendor name     ✓ searchMode all ✓ via search.ismatch
```

"No parameter" is a finding about the retrieve contract. Whether a workaround exists is open (O6).

### Grouping, project state and Source Priority

```
  facets  ──►  gate coverage     ──►  project state   ──►  Source Priority
               (gates_present)        (Closed,             (which source system
                                       Active-past-G3,      is authoritative for
                                       Unknown)             the topic)
```

Source Priority is the rule for when WPM, PECT and PSR record the same fact differently. The fetch of the authoritative source is keyed by project state, and for lessons the policy is:

```
  lessons + Closed   →  [Closeout document, lessons_learned_log]
  lessons + Unknown  →  []   nothing is fetched
```

With no facets, state comes only from the record row's `work_status`. A project without a record row reads Unknown and gets nothing (F17). Three ways out:

1. Derive project state from the record row only, and drop the gate fallback.
2. Precompute gate coverage at ingest and stamp it onto every chunk.
3. Give the Unknown state a non-empty source list.

### Count and sort

The retrieve request has no `count` and no `orderby`, so the Retrieval API can only count what it happened to retrieve and can only order by relevance (F23 rows 6 and 12).

### Field scope, fuzzy and all-word matching through `search.ismatch`

`filterAddOn` is an OData filter, and the service ANDs it onto the knowledge source's `baseFilter`: "Because the filters are combined with `AND`, `filterAddOn` can only narrow the persisted base filter. It can't replace or broaden it." ([Create a search index knowledge source, Persist a base filter](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index)). A filter generated from a query hint is ANDed on top of both.

Grammar ([OData full-text search functions](https://learn.microsoft.com/en-us/azure/search/search-query-odata-full-text-search-functions)):

```
search_is_match_call ::=
    'search.ismatch'('scoring')?'(' search_is_match_parameters ')'

search_is_match_parameters ::=
    string_literal(',' string_literal(',' query_type ',' search_mode)?)?

query_type  ::= "'full'" | "'simple'"
search_mode ::= "'any'" | "'all'"
```

```
  search.ismatch( 'Amazon Web Services' , 'vendors' , 'simple' , 'all' )
                   ╰────────┬─────────╯   ╰───┬───╯   ╰───┬──╯   ╰─┬─╯
       ARG 1: search ───────┘                 │           │        │
       required, the query text               │           │        │
       ARG 2: searchFields ───────────────────┘           │        │
       comma-separated string, no spaces,                 │        │
       default all searchable fields                      │        │
       ARG 3: queryType, 'simple' (default) or 'full' ────┘        │
       picks the parser for ARG 1                                  │
       ARG 4: searchMode, 'any' (default) or 'all' ────────────────┘
       'any' ORs the terms, 'all' ANDs them
```

- Arguments 3 and 4 come as a pair or not at all. The function returns `Edm.Boolean`, so it composes with `and`, `or` and `not`.
- Argument 2: "Comma-separated list of searchable fields to search in; defaults to all searchable fields in the index. When you use fielded search in the `search` parameter, the field specifiers in the Lucene query override any fields specified in this parameter." Every field named must be `searchable`.
- Argument 4: "Indicates whether any or all of the search terms in the `search` parameter must be matched in order to count the document as a match. When you use the Lucene Boolean operators in the `search` parameter, they take precedence over this parameter."
- `search.ismatchscoring` takes the same arguments: "the relevance score of documents matching the `search.ismatchscoring` query contributes to the overall document score, whereas for `search.ismatch`, the document score doesn't change." The Retrieval API has no `scoringProfile`, `orderby` or separate `semanticQuery`, so `search.ismatchscoring` is the one rank lever left.
- The third argument is the filter's own parser. `intents[].search` goes to the locked semantic path, so the two strings never interact.

| `'simple'` operators | `'full'` adds |
|---|---|
| `+` AND, `\|` OR, `-` NOT, `"…"` phrase, `(…)` grouping, `*` prefix | `AND` `OR` `NOT` as words, `field:term`, `term~n` fuzzy, `"a b"~n` proximity, `term^n` boost, `/regex/`, infix and suffix wildcards |

Traps that return wrong results without an error ([Lucene query syntax](https://learn.microsoft.com/en-us/azure/search/query-lucene-syntax), [Simple query syntax](https://learn.microsoft.com/en-us/azure/search/query-simple-syntax)):

| Trap | What happens | Correct form |
|---|---|---|
| Fuzzy on a phrase | `"lessons learned"~1` is proximity, not fuzzy | `lessons~ learned~` |
| Edit distance above 2 | capped at 2; expansion caps at 50 terms | n of 0, 1 or 2 |
| Case on wildcard, prefix, regex and fuzzy terms | these skip lexical analysis, so `Fronteer*` misses the lowercased token `fronteer` | lowercase them in the pipeline |
| Lone negation in `full` | `-luxury` alone is an error | use `simple`, which expands it to `-luxury *` |
| `simple` with `any` and a `-term` | `wifi -luxury` expands to `wifi OR -luxury OR *`, the whole index | pair `-term` with `all`, or use `full` |
| `\|` in `full` | not supported | `OR` |
| Three escaping layers | OData doubles a single quote (`O''Brien`); each parser escapes its operators with `\`; JSON escapes interior double quotes | `"filterAddOn": "search.ismatch('\"schedule delay\"~10', 'body', 'full', 'any')"` |

Limits: no lambdas (`vendors/any(v: search.ismatch(...))` is rejected, F21), so a collection field can be filtered or full-text searched but not both on the same element ([Troubleshooting collection filters](https://learn.microsoft.com/en-us/azure/search/search-query-troubleshoot-collection-filters)). The search clause is at most 100,000 characters and 1,024 clauses.

```odata
-- field scoping
search.ismatch('Yusoff', 'roles_project_sponsor,roles_work_lead')

-- all words required
search.ismatch('Amazon Web Services', 'vendors', 'simple', 'all')

-- fuzzy, needs full
search.ismatch('Fronteer~1', 'title', 'full', 'any')

-- proximity, needs full
search.ismatch('"schedule delay"~10', 'body', 'full', 'any')

-- composed with ordinary OData
search.ismatch('Yusoff', 'roles_work_lead', 'simple', 'all')
  and gate_label eq 'Closeout'
  and project_id eq '1009338'

-- qualify on one clause, rank on the other
search.ismatch('Closeout', 'gate_label')
  and search.ismatchscoring('lessons learned takeaways', 'body,title', 'full', 'any')
```

### Search API parameters against the Retrieval API

No parameter in the retrieve request:

| Search API | What `chat_similarity` uses it for | Retrieval API |
|---|---|---|
| `facets` | `_facet_member_ids`, gate coverage, project membership | absent |
| `count` | exact totals | absent |
| `orderby` | top N by spend or date | absent |
| `skip` | pages past the first | absent |
| `top` | hard result cap | `maxOutputDocuments`, 50 to 200 only (F6) |
| `searchMode` | `all` against `any` | absent ("there's no search mode") |
| `queryType` | `simple` or `full` | implied `semantic` |
| `scoringProfile`, `scoringParameters` | field-weighted boosting | "Agentic retrieval doesn't accept `scoringProfile` or `scoringParameters` inputs." Stored profiles don't apply either: "It doesn't apply the underlying index's scoring profiles, including `defaultScoringProfile`." ([Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)) |
| `@search.rerankerBoostedScore` | boosted score readback | "Retrieve responses also don't surface @search.rerankerBoostedScore." (same page) |
| `highlight`, `answers`, `captions` | snippets and extractive answers | absent; `outputMode: answerSynthesis` needs a model |
| `minimumCoverage`, `sessionId`, `scoringStatistics` | partial-index tolerance, scoring consistency | absent |

Kept, renamed or moved:

| Search API | Retrieval API | Scope |
|---|---|---|
| `search` | `intents[].search` | per request; several allowed (F22) |
| `filter` | `baseFilter` AND `filterAddOn` | stored, then per request; can only narrow |
| `select` | `sourceDataFields` | fixed on the knowledge source |
| `searchFields` | `searchFields` | fixed on the knowledge source, shared by both lanes |
| `semanticConfiguration` | `semanticConfigurationName` | fixed on the knowledge source |
| `vectorQueries` | none; the service embeds `intents[].search` with the index vectorizer | no precomputed vector, no `k` |
| `semanticQuery` | none; `intents[].search` does both searching and reranking | the Search API payload searches on `lessons learned` and reranks against the full question (F19); the Retrieval API can't split them |
| L2 threshold | `rerankerThreshold` in `knowledgeSourceParams` | cuts (F11) |
| `searchFields`, `queryType`, `searchMode` per request | `search.ismatch` arguments 2, 3 and 4 in `filterAddOn` | per request |

Retrieval API only: `retrievalReasoningEffort` (above `minimal` needs a model, F5), multi-source fan-out and source selection, `retrievalInstructions`, `answerInstructions`, `outputMode`, `maxOutputSize`, `includeActivity`, `alwaysQuerySource`, `neverQuerySource`, `failOnError`, `queryHints`, `queryHintOverrides`, `resultsProcessing`, citation URLs, `x-ms-query-source-authorization`, `retrieveDefaults`.

### Query hints, and why `queryType` shows `full`

A generated boost such as `language:(ja\-JP)^2` uses fielded search and a term boost, which only the `full` parser supports. Microsoft states the rewrite: "A generated boost rewrites the query in full Lucene syntax while preserving the original terms." ([Create a search index knowledge source, Configure query hints](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index)). So `full` in the activity array comes from a boost, not a planner choice, and at `minimal` effort no planner runs: "At `minimal` effort, this step is skipped and queries are issued directly to knowledge sources." ([Agentic retrieval overview, Architecture and workflow](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview)).

What blocks `queryHints` for `chat_similarity`, same query-hints section:

| Blocker | Evidence |
|---|---|
| Best effort | "Hints are best effort, so the model might not generate a filter or boost for every request." |
| Off at `minimal` | "Hints need model-driven query planning, so they aren't applied when the retrieval reasoning effort is `minimal`." |
| `gpt-4o` with stored filter hints | "At other effort levels, a GPT-4o or GPT-4.1 family model returns HTTP 400 when the stored queryHints object contains a filter." "The service checks stored filters before applying `queryHintOverrides`, so an empty or boosts-only override doesn't bypass this validation. Stored `fieldValue` and `multiWordExpression` boosts alone don't trigger the validation." |
| Wrong layer | "Generated filters combine with `baseFilter` and `filterAddOn` by using `AND`." A filter only narrows and a boost only moves rank. The failures are missing counts and project lists |
| Limits | Filter hints: "Up to five hints with unique fields. Each value can contain up to 128 characters, and all values in one hint can contain up to 2,048 characters combined." `roles_work_lead` holds thousands of person names, so it can't be enumerated |

The `chat_similarity` decomposer already does the planner's filter job, grounded in `ENUM_FIELD_VALUES` and with a deterministic demotion of invalid values to search text.

## Decisions

### ADR 1: No model on the knowledge base

- **Decision.** Keep `models` empty and `retrievalReasoningEffort: minimal`.
- **Rejected alternative.** Attach a model to reach `low` or `medium` effort and the query planner.
- **Why.** The vector query already runs at `minimal` (F8), and Microsoft defines `minimal` as issuing "direct text and vector searches" (see "Microsoft documentation"). A model adds Azure OpenAI tokens and a planning stage against the 30-second target, and the decomposer already plans the query.
- **Revisit when.** `outputMode: answerSynthesis` or model query planning is wanted. A knowledge base LLM must be a native Azure OpenAI or Foundry endpoint, not an APIM proxy (Operating notes).

### ADR 2: Test on sibling objects, never on the production knowledge source

- **Decision.** Test with `ps-ks-allfields`, `ps-kb-allfields` and `ps-kb-isolated`.
- **Rejected alternative.** Edit `knowledgesource-1788979786196` in place.
- **Why.** `searchFields` is fixed on the knowledge source, and the DEV pipeline queries the production one. A sibling keeps DEV working and gives an A/B pair over identical index content.
- **Revisit when.** O2 moves the working configuration onto the objects `chat_similarity` uses.

### ADR 3: Don't store `queryHints`

- **Decision.** Keep filter generation in the decomposer.
- **Rejected alternative.** Filter hints and boosts on the knowledge source.
- **Why.** The blockers table under "Query hints".
- **Revisit when.** The pipeline moves above `minimal` and off `gpt-4o`, and a `multiWordExpression` boost for phrases such as "lessons learned" is wanted. That hint kind duplicates nothing the decomposer does.

### ADR 4: Call the Retrieval API over REST, not MCP

- **Decision.** Keep `POST /knowledgebases/{kb}/retrieve`.
- **Rejected alternative.** The knowledge base MCP endpoint, `/knowledgebases/{kb}/mcp`, with the `knowledge_base_retrieve` tool.
- **Why.** `search.ismatch` lives in `knowledgeSourceParams.filterAddOn`, and Microsoft doesn't publish the MCP tool's input schema. `KB_TRACE` reads `activity` in the REST shape, and the retrieve page says the MCP tool result differs from the REST response shape.
- **Revisit when.** O8 shows `filterAddOn` in the MCP input schema and a Foundry-hosted agent needs to call the knowledge base directly.

## Open items

Load `. .\src\api\env.ps1` from the root of the application repository in each new PowerShell shell before running these (A31). Every command below was run under Constrained Language Mode against a local stub that fakes Azure responses, on both the success path and a failure path. The stub checks syntax, request shape and readout, not service behavior. Unproven claims about synonym maps, a reranker score floor, `alwaysQuery`, scoring profiles, `prioritizedContentFields` and several intents have their tests in `staging-findings.md`.

### O1. The 29 stored field names, and whether `body` is among them

Read-only.

```powershell
$u = "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/knowledgesource-1788979786196?api-version=2026-08-01-preview"; try { $sf = @((Invoke-RestMethod -Uri $u -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).searchIndexParameters.searchFields | Where-Object { $_ } | ForEach-Object { $_.name }); 'searchFields count: ' + $sf.Count; 'body in list: ' + ($sf -contains 'body'); 'content_vector in list: ' + ($sf -contains 'content_vector'); $sf -join ', ' } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `searchFields count: 29` and `content_vector in list: False` confirm A36 and F9.
- `body in list` settles the field list recorded in F9. It doesn't change the cause of 1 against 9, which is the vector query being off.
- The names settle the disputed spellings in the hand transcription, for example `accountable_portfolio` or `accountable_portfolio_id`, and `vendor` or `vendors`.
- `ERROR`: nothing was read. Load the environment file and rerun.

### O2. Apply the configuration in `chat_similarity` and rerun the prompts

Runs in the application repository, not here. Apply "Configuration that works" to the knowledge source and the evidence-fetch retrieve request, using "Implementation" as the reference.

- Expect lessons for 7 of 8 projects on the eight-project prompt. 1012329 still gets no evidence call until O6 is fixed.
- Rerun the 16-prompt evaluation (F23). It ran with the vector query off, so every Retrieval API row may change.
- Check anything downstream that sorts or filters on `rerankerScore`.

### O3. Same chunks on the other seven projects

F16 compared counts; F15 compared chunk identity on 1009338 only. `ps-ks-allfields` must still store `searchFields: []`.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $vq = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); '{0,-8} {1,-7} {2,-7} {3,-8} {4}' -f 'project', 'search', 'KB', 'overlap', 'search lesson chunks found in KB'; foreach ($p in '1009338','1009392','1010069','1011517','1011718','1011742','1012268','1012329') { $f = "project_id eq '$p' and gate_label eq 'Closeout'"; try { $q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = $vq; filter = $f; top = 50; select = 'psr_row_id,body' } | ConvertTo-Json -Depth 8; $v = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body $q -ContentType 'application/json').value); $sk = @($v | ForEach-Object { [string]$_.psr_row_id }); $sl = @($v | Where-Object { [string]$_.body -match 'lesson' } | ForEach-Object { [string]$_.psr_row_id }); $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $kk = @((Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json').references | Where-Object { $_ } | ForEach-Object { [string]$_.sourceData.psr_row_id }); '{0,-8} {1,-7} {2,-7} {3,-8} {4} of {5}' -f $p, $sk.Count, $kk.Count, @($kk | Where-Object { $sk -contains $_ }).Count, @($sl | Where-Object { $kk -contains $_ }).Count, $sl.Count } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-8} ERROR {1}' -f $p, $m } }
```

Read it for:

- The 1009338 row should read `50 50 50 2 of 2`, matching A37. If it doesn't, stop: the setup changed.
- `overlap` equal to both counts on a row: the same chunks on that project.
- `overlap` below the counts: the two APIs return different chunks. The last column then says whether the lesson-mentioning chunks survived anyway.
- `ERROR` on a row: that project wasn't measured. Its row proves nothing.

### O4. Precision, tokens and latency of `none` against default reranking

Size and time per project. It runs 16 retrieves one after another.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $rtu = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; '{0,-8} {1,-7} {2,-5} {3,-10} {4,-10} {5}' -f 'project', 'mode', 'refs', 'ref chars', 'body chars', 'wall ms'; foreach ($p in '1009338','1009392','1010069','1011517','1011718','1011742','1012268','1012329') { foreach ($mode in 'rerank','none') { try { $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '$p' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = $mode } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $t0 = Get-Date; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $ms = [int]((Get-Date) - $t0).TotalMilliseconds; $refs = @($r.references | Where-Object { $_ }); $rc = if ($refs.Count) { (ConvertTo-Json -InputObject $refs -Depth 8 -Compress).Length } else { 0 }; $bc = 0; foreach ($x in $refs) { $bc += ([string]$x.sourceData.body).Length }; '{0,-8} {1,-7} {2,-5} {3,-10} {4,-10} {5}' -f $p, $mode, $refs.Count, $rc, $bc, $ms } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-8} {1,-7} ERROR {2}' -f $p, $mode, $m } } }
```

Read it for:

- `refs` should match F16. A mismatch means the setup changed.
- `ref chars` is the size of the references as JSON, all `sourceData` fields included. Divide by 4 for a rough token count per project, which is what the answer step receives if it passes references through whole.
- `body chars` is the chunk text alone, the floor if the answer step passes only `body`.
- `wall ms` is round-trip time from this machine, one call at a time. Compare the `none` rows against the `rerank` rows, and the sum against the 30-second target, keeping in mind that the pipeline may run projects in parallel.

Precision needs a reader. The command below prints the text of each default-reranked reference on 1009338 and the activity arguments. Count how many carry lessons prose, then compare with the 50 from `none` (saved by the optional capture command in Operating notes).

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $rtu = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50 } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; try { $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; '--- ACTIVITY ARGUMENTS ---'; $r.activity | Where-Object { $_.type -eq 'searchIndex' } | ForEach-Object { $_.searchIndexArguments | Select-Object queryType, semanticConfigurationName, searchConfigurationName, @{n='searchFieldsCount';e={@($_.searchFields | Where-Object { $_ }).Count}} } | Format-List; '--- REFERENCES ---'; @($r.references | Where-Object { $_ }) | ForEach-Object { $t = ([string]$_.sourceData.body) -replace '\s+', ' '; if ($t.Length -gt 120) { $t = $t.Substring(0, 120) }; '{0,-6} doc={1}' -f $_.rerankerScore, $_.sourceData.citation_doc_name; '       ' + $t } } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- How many of the roughly 9 references carry lessons prose. If most do, default reranking is precise but incomplete; F16 shows what it loses.
- `queryType` in the activity arguments. The spec changelog records it being added there, and A8's dump didn't show it.
- Which of `semanticConfigurationName` and `searchConfigurationName` the service fills. An earlier dump showed `searchConfigurationName: "default"`, which isn't in the documented activity arguments.

### O5. Lists that name `content_vector`: stored as sent, and keyword scope

The stored-list half:

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ksu = "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; try { $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); foreach ($v in @( @{ label = 'body + content_vector'; names = @('body', 'content_vector') }, @{ label = 'restore []'; names = @() } )) { $sf = @($v.names | ForEach-Object { @{ name = $_ } }); $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null; $sp = (Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters; $state = if (-not ($sp.PSObject.Properties.Name -contains 'searchFields')) { 'ABSENT' } else { ConvertTo-Json -InputObject @($sp.searchFields) -Compress }; '{0,-22} sent {1,-2} fields   stored = {2}' -f $v.label, $sf.Count, $state } } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `stored = [{"name":"body"},{"name":"content_vector"}]`: the service stores the list as sent.
- Any other stored value: the service rewrites the list, and option B in "Implementation" needs a read-back after every PUT.
- The last line must read `restore []` with `stored = []`. If the command stops with `ERROR` between the two PUTs, `ps-ks-allfields` may be left holding the narrow list; rerun it.

The keyword-scope half has no count-based test. The vector query fills every candidate slot (F13), so the count reads the same whether BM25 searches one field or all of them. Option A in "Implementation" (no list) doesn't depend on it.

### O6. Grouping, count and sort

Design work, no command. Pick a project-state option under "Grouping, project state and Source Priority", and move counts and sorts to code that doesn't depend on the retrieve contract: the Search API, or an MCP server knowledge source that returns results computed by our own code (untested).

### O7. `neverQuerySource` at `minimal` effort

A13 failed on a typo in a knowledge source name. This is the corrected request.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $rtu = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview"; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }, @{ knowledgeSourceName = 'knowledgesource-1789660272864'; kind = 'searchIndex'; neverQuerySource = $true }, @{ knowledgeSourceName = 'knowledgesource-1789660431937'; kind = 'searchIndex'; neverQuerySource = $true } ); includeActivity = $true } | ConvertTo-Json -Depth 12; try { $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $acts = @($r.activity | Where-Object { $_.type -eq 'searchIndex' }); 'references: ' + @($r.references | Where-Object { $_ }).Count + '   searchIndex activities: ' + $acts.Count; $acts | Select-Object id, count, @{n='filter';e={$_.searchIndexArguments.filter}} | Format-Table -AutoSize } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `searchIndex activities: 1`, with the Closeout filter: `neverQuerySource` works at `minimal`, and the production knowledge base can serve the evidence fetch without a single-source copy.
- `searchIndex activities: 3`: the flag is ignored at `minimal`. Use a single-source knowledge base.
- `ERROR` with HTTP 400: the service rejects the flag here. Read the message.

### O8. The MCP tool's input schema

Needs `az` signed in with a role that can query the knowledge base (Entra token, audience `https://search.azure.com`).

```powershell
$tok = az account get-access-token --resource https://search.azure.com --query accessToken -o tsv; $u = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/mcp?api-version=2026-08-01-preview"; $b = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'; try { $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $u -Headers @{ Authorization = "Bearer $tok"; Accept = 'application/json, text/event-stream' } -Body $b -ContentType 'application/json'; 'HTTP ' + $r.StatusCode; 'filterAddOn in schema: ' + ($r.Content -match 'filterAddOn'); 'knowledgeSourceParams in schema: ' + ($r.Content -match 'knowledgeSourceParams'); $r.Content } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `filterAddOn in schema: True`: MCP can carry the `search.ismatch` workaround. Revisit ADR 4.
- `False`: MCP can't carry it. That result is the citable reason for ADR 4.
- `ERROR` with 401 or 403: the token or role is missing. An error asking for `initialize` means the server wants the MCP handshake first.

### O9. `search.ismatch` end to end on the failing prompts

No command yet. F21 proves the syntax parses. Whether it fixes an answer needs prompts where the parser matters. The eight-project prompt can't test it: it names every project, so the filter is a `project_id` equality and no text reaches a parser.

| # | Prompt | Construct | Arms that must differ |
|---|---|---|---|
| P0 | "List the lessons learned for project 1009338." | none | none; the control |
| P1 | "Which projects used Amazon Web Services as a vendor?" | all words required | `simple/all`, `simple/any`, no filter |
| P2 | "What lessons came from the Fronteer upgrade?" (misspelling kept) | fuzzy | `full/any` with `Fronteer~1`, `simple`, no filter |
| P3 | "Show projects where Yusoff was sponsor or work lead." | field scoping | `search.ismatch('Yusoff','roles_project_sponsor,roles_work_lead')`, no filter |
| P4 | "Find projects about decommissioning legacy infrastructure." | concept, no exact term | no filter against every arm; the negative control |
| P5 | "Which projects mention schedule and delay close together in the closeout narrative?" | proximity | `full` with `"schedule delay"~10`, `simple`, no filter |
| P6 | "Find projects in the decommission family: decommission, decommissioning, decommissioned." | prefix against regex | `simple` with `decommission*`, `full` with `/decommission.*/`, no filter |
| P7 | "Which SAP projects had lessons learned but were not Hardware Deploy?" | negation | `simple/all` with `SAP -Hardware`, `full` with `SAP NOT Hardware`, no filter |
| P8 | "Give me lessons learned from closed projects in the Kinaxis portfolio." | phrase boost | `search.ismatchscoring('"lessons learned"^3','body,title','full','any')`, `search.ismatch` with the same arguments, no filter |

Run P0, P1, P3 and P8 first. Hold the filter scope and `maxOutputDocuments` fixed and vary only the `search.ismatch` call. Record per arm: references, activity count, the golden project IDs recovered, and how many returned chunks carry the target content. The last column decides. Run the arms on a knowledge source with the vector query on (F9), or the result measures the missing vector query instead of the filter.

## Pitfalls for future agents

- Activity `count` is taken after the reranker threshold. Zero doesn't mean nothing was retrieved. Test with `resultsProcessing: "none"`.
- A threshold sweep whose only survivor scores above every threshold tested proves nothing about the threshold (F20).
- Limits mask each other. `resultsProcessing: "none"` looked inert because the token budget capped references near 9 (F12). Change one limit at a time and read count and references together.
- Before crediting a gain to the keyword lane, run BM25 alone. BM25 over every field gave 1 for `lessons learned` (F14), so the gain from 1 to 9 was never keyword.
- An explicit `searchFields` list without `content_vector` silently turns the vector query off (F9). Microsoft's Python sample uses such a list.
- A failed call leaves the result variable null, and `@($null.references).Count` prints 1. Wrap every call in try/catch and print ERROR.
- `maxOutputDocuments` accepts only 50 to 200 (F6).
- A pasted `-Uri "$env:..."` can lose its space (A25). Build URLs into variables first.
- Load `env.ps1` in each new shell. Otherwise every call fails with `Object reference not set to an instance of an object` (A31).
- Wait about 15 seconds after a knowledge source PUT before probing it (F10).
- `elapsedMs` 0 on reranked rows is a reporting quirk, not a cache (F8).
- Research-agent summaries misreported GitHub issue state and quoted sentences that aren't on current pages. Open the source before recording anything.
- Don't cite "if the only searchable field is a vector field, then only pure vector search is used". Microsoft deleted it on 2026-06-12, commit `3832581a` of `MicrosoftDocs/azure-ai-docs`.
- The semantic reranker can be bypassed from `2026-08-01-preview` on. Older sources describe it as mandatory for agentic retrieval.
- "No workaround exists" is an opinion until a test proves it.
- Runs on the production knowledge source (F17, F18, F20 to F23) had the vector query off. Don't read them as evidence about hybrid retrieval.

## Microsoft documentation

Quotes used in other sections sit next to the claim they support. The quotes below back the vector-query and index findings. All were checked on the current page on 2026-09-18.

**The vector query at `minimal` effort.**

- "If your index contains vector fields, the query plan includes these fields if they're `searchable` and have a `vectorizer` assignment." ([Create an index for agentic retrieval, Add a vectorizer](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index))
- "At query time, when vector fields are present in the index, the agentic retrieval engine executes a vector query in parallel to the text query." (same page, Example index definition)
- "There's nothing in the vectorizer definition that needs to be changed to work with agentic retrieval." (same page, Add a vectorizer)
- "The vectorizer must be the same embedding model used to create the vectors in the index." (same page, Example index definition)
- "If the index includes vector fields, you need a valid vectorizer definition so the agentic retrieval engine can vectorize query inputs. Otherwise, vector fields are ignored." ([Query a knowledge base, Search index behavior](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve))
- `minimal`: "Disables LLM-based query planning to deliver the lowest cost and latency for agentic retrieval. It issues direct text and vector searches across the knowledge sources listed in the knowledge base, and returns the best-matching passages." ([Set the retrieval reasoning effort](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-set-retrieval-reasoning-effort))
- The tutorial's model-free `minimal` knowledge base is "a knowledge base that performs hybrid retrieval from the knowledge source." ([Tutorial: Build an agentic retrieval solution, Understand the solution](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-pipeline))
- "You can reference multiple knowledge sources in a single knowledge base. The agentic retrieval engine queries all of them in a single request. Subqueries are generated for each knowledge source, and the top results are returned in the retrieval response." ([What is a knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-overview))

**Index and service rulings (F3).**

- "To minimize space requirements, we recommend setting retrievable and stored to false." A recommendation, not a requirement. ([Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index))
- "You can use an existing index that meets the criteria, even if it was created with an earlier API version" (same page).
- "Confidential computing disables or restricts certain features, including agentic retrieval, semantic ranker, query rewrite, and skillset execution." ([Region support](https://learn.microsoft.com/en-us/azure/search/search-region-support))
- `knowledgeRetrieval`: "The default value is free. To enable paid usage, set knowledgeRetrieval to standard." ([Migrate agentic retrieval code](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-migrate))

**What no page says.** No page says that an explicit `searchFields` list without the vector field turns the vector query off (F9, F10). The nearest sentences:

- "By default, all `searchable` fields are included in query execution, and all `retrievable` fields are returned in results. You can choose which fields to use for each action in the search index knowledge source definition." ([Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index))
- `searchFields`: "Used to restrict which fields to search on the search index." Its examples write all fields as `[{ "name": "*" }]`. ([Knowledge Sources - Create or Update, 2026-08-01-preview](https://learn.microsoft.com/en-us/rest/api/searchservice/knowledge-sources/create-or-update?view=rest-searchservice-2026-08-01-preview))
- The Python samples on [Create a search index knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index) set `search_fields = [SearchIndexFieldReference(name="id")]`, a text-only list, which by F9 turns the vector query off.

**Don't cite.**

| Sentence | Why |
|---|---|
| "if the only searchable field is a vector field, then only pure vector search is used" | deleted on 2026-06-12, commit `3832581a`; absent from the current create-index page |
| portal objects "still use the 2025-08-01-preview schema" | absent from the overview page. The current wording: "Objects created in either portal might use preview schemas and require migration when you move to the generally available REST API version" |
| "Facets, sorting, document count pagination, and orderby are not available." | absent from the current retrieve page. Cite the retrieve contract (the parameter tables above) instead |
| The create-index criteria row "Scoring profile / Optional / Boosts relevance for specific fields. Set defaultScoringProfile to apply automatically." | present, but the retrieve page says retrieve doesn't apply index scoring profiles |
| `alwaysQuerySource` on the reasoning-effort page | that page now names the property `alwaysQueryKnowledgeSource`; the retrieve page still says `alwaysQuerySource` |
| "expect to call a native Azure OpenAI or Foundry endpoint directly" (Q&A 5955030) | not on the page; the staff answer's wording is in Operating notes |

## Outside evidence

- [Foundry IQ benchmark post](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/foundry-iq-improve-recall-by-up-to-54-with-knowledge-bases/4524852), Azure AI Search team, 2026-06-02: defines hybrid as BM25 plus vector, reports single-call evidence recall (BM25 57.5, hybrid 67.1, knowledge base `minimal` 72.1) and a retrained reranker. No row matches our hybrid-plus-semantic baseline. Not re-checked; the page didn't load on 2026-09-18.
- [`chatreadretrieveread.py`](https://github.com/Azure-Samples/azure-search-openai-demo/blob/main/app/backend/approaches/chatreadretrieveread.py) in Microsoft's reference app: the agentic path passes no vector query, no `top` and no query type.
- [Spec CHANGELOG](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/search/data-plane/Search/CHANGELOG.md): `queryType` added to the search-index activity arguments; every vector entry applies to the Search API.
- [TypeSpec, models-knowledgebase.tsp](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/search/data-plane/Search/models-knowledgebase.tsp): the activity arguments have no vector property, and `2026-08-01-preview` adds `citationUrl`, "A Search-owned URL that points at the backing document for this reference, usable as a citation target." Whether it can carry our `citation_url` values is untested.
- [Stack Overflow 79891856](https://stackoverflow.com/questions/79891856) with [Microsoft Q&A 5780377](https://learn.microsoft.com/en-us/answers/questions/5780377/semantic-ranker-is-a-documented-limitation-with-ve), 2026-02-18: one engineer measured the semantic ranker lowering Hit@1 on vector-dominated hybrid results across 8,068 queries. It predates the retrained ranker and uses a different corpus.
- [azure-sdk-for-python #42299](https://github.com/Azure/azure-sdk-for-python/issues/42299): `doc_key` doesn't keep the exact index value; `include_reference_source_data` does (REST `includeReferenceSourceData`, used in A29 and later).
- [azure-search-openai-demo #2569](https://github.com/Azure-Samples/azure-search-openai-demo/issues/2569): references once returned only semantic configuration fields; closed 2026-07-18 as resolved.
- [Jannik Reinhard, Foundry IQ Deep Dive](https://jannikreinhard.com/foundry-iq-knowledge-bases/): the one hands-on independent write-up; repeats "keyword, vector or hybrid" without testing it.
- [Pankaj Pandey on Medium](https://medium.com/@pankaj_pandey/azures-agentic-retrieval-an-llm-in-front-of-the-search-engine-and-a-second-bill-on-every-query-6d7d0cbb0045), 2026-04-18: conceptual cost critique, no measurements.
- Microsoft Q&A threads on empty agentic results ([5924441](https://learn.microsoft.com/en-us/answers/questions/5924441/unable-to-get-the-response-with-agentic-retrieval), [5627268](https://learn.microsoft.com/en-us/answers/questions/5627268/ai-foundry-agents-stopped-searching-the-knowledge), [2278561](https://learn.microsoft.com/en-us/answers/questions/2278561/issues-with-empty-response-in-azure-ai-search-agen), [2283142](https://learn.microsoft.com/en-us/answers/questions/2283142/issue-while-implementing-knowledge-agents-retrieve)): causes named are MCP 403s, identity, RBAC, index names, region or an index without vectors. None names a vector-query cause.

No public source compares agentic retrieval against the Search API on one index or analyzes the activity array.

Not reached: Reddit (blocked, JSON API included), the Microsoft Q&A search API, direct Medium (read through `r.jina.ai`), the markaicode latency benchmark (HTTP 403), LinkedIn, and the Microsoft Ignite sessions BRK142 and BRK193 (no transcripts).

## Operating notes

- **Environment.** In each new PowerShell shell, run `. .\src\api\env.ps1` from the root of the application repository. It sets `AZURE_SEARCH_ENDPOINT` and `AZURE_SEARCH_API_KEY`.
- **API versions.** Search API queries use `2024-07-01`, index reads use `2026-04-01`, and knowledge sources, knowledge bases and retrieve use `2026-08-01-preview`.
- **Test objects.** `ps-kb-isolated` (over the production knowledge source), `ps-kb-allfields` and `ps-ks-allfields` (`searchFields: []` after A36). ADR 2 says why they exist.
- **Knowledge base LLM.** If a model is ever attached, it must be a native endpoint. The Microsoft staff answer on [Q&A 5955030](https://learn.microsoft.com/en-us/answers/questions/5955030/apim-not-supported-for-knowledge-base-llm-in-agent), 2026-08-01: "These calls expect a native Azure OpenAI/Foundry endpoint and a supported auth model, not an APIM proxy."
- **PowerShell.** The traps are in `CLAUDE.md` at the repository root. This machine runs Constrained Language Mode. Piping a multi-line script into `powershell.exe -Command -` prints nothing; stub tests run with `powershell.exe -NoProfile -NonInteractive -Command "Get-Content -Raw -Path '.\file.ps1' | Invoke-Expression"`. The current stub is `temp\handoff-check\stub17.ps1`, with the runner `run17.sh`.
- **Capture raw evidence (optional).** Reruns the three A37 calls and writes each request and response to `.\same-chunks-evidence\`. Expect `HTTP 200 items=50` three times and `overlap with KB = 50` twice. The response files hold full chunk `body` text.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $dir = Join-Path (Get-Location) 'same-chunks-evidence'; New-Item -ItemType Directory -Force -Path $dir | Out-Null; $vq = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); $calls = @( @{ name = '1-search-hybrid'; uri = $su; body = @{ search = 'lessons learned'; vectorQueries = $vq; filter = $f; top = 50; select = 'psr_row_id,body' } }, @{ name = '2-search-hybrid-semantic'; uri = $su; body = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = $vq; filter = $f; top = 50; select = 'psr_row_id,body' } }, @{ name = '3-kb-retrieve'; uri = $rtu; body = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } } ); $keys = @{}; $failed = $false; foreach ($c in $calls) { $req = $c.body | ConvertTo-Json -Depth 12; Set-Content -Path (Join-Path $dir "$($c.name).request.json") -Value $req -Encoding UTF8; try { $resp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $c.uri -Headers $h -Body $req -ContentType 'application/json'; Set-Content -Path (Join-Path $dir "$($c.name).response.json") -Value $resp.Content -Encoding UTF8; $j = $resp.Content | ConvertFrom-Json; $keys[$c.name] = if ($c.name -like '3*') { @($j.references | Where-Object { $_ } | ForEach-Object { [string]$_.sourceData.psr_row_id }) } else { @($j.value | ForEach-Object { [string]$_.psr_row_id }) }; '{0,-26} HTTP {1}  items={2}' -f $c.name, $resp.StatusCode, $keys[$c.name].Count } catch { $failed = $true; $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-26} ERROR {1}' -f $c.name, $m } }; if ($failed) { 'overlap not computed: a call failed' } else { $kb = $keys['3-kb-retrieve']; foreach ($n in '1-search-hybrid','2-search-hybrid-semantic') { '{0,-26} overlap with KB = {1}' -f $n, @($keys[$n] | Where-Object { $kb -contains $_ }).Count } }; 'files written to ' + $dir
```

- **Cleanup, when testing is finished.** Deletes every `ps-` test object. The production knowledge source is deliberately absent from the list: `ps-kb-isolated` only references it. Knowledge bases go first, because the service refuses to delete a knowledge source that a knowledge base references. Each line reads `deleted` or `skipped` with the reason.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; foreach ($kb in 'ps-kb-allfields','ps-kb-isolated') { $u = "$ep/knowledgebases/$($kb)?api-version=2026-08-01-preview"; try { Invoke-RestMethod -Method Delete -Uri $u -Headers $h | Out-Null; "deleted $kb" } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; "skipped $($kb): $m" } }; foreach ($ks in 'ps-ks-allfields') { $u = "$ep/knowledgesources/$($ks)?api-version=2026-08-01-preview"; try { Invoke-RestMethod -Method Delete -Uri $u -Headers $h | Out-Null; "deleted $ks" } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; "skipped $($ks): $m" } }
```

## Appendix: commands run 2026-09-17

Commands in the order they were run, with the result the user got. Numbers in the results come from the user's runs on `workdeliverygpt-dev-srch`.

The command text differs from what was typed in four ways, so that every line runs on its own:

- literal knowledge base and knowledge source names in place of `$prodKb` and `$prodKs`;
- A1 and A2 are reconstructed from a screenshot and put on one line each;
- A4 and A8 are folded into one line each;
- A16 is hardened with `Add-Member -Force`.

All 19 were run under Constrained Language Mode against a local stub that fakes Azure responses. Each parses and runs, and the error paths in A6 and A13 fire. The stub checks syntax and readout, not service behavior.

### A1. Vectorizer and profile on the index (F1)

```powershell
$r = Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $r.vectorSearch.vectorizers; $r.vectorSearch.profiles
```

Result: vectorizer `ps_text_3_small`, kind `azureOpenAI`, `resourceUri` an internal proxy host ending in `/wdgpt`, `deploymentId` `text-embedding-3-small`, key auth, `authIdentity` unset. Profile `content-vector-hnsw-profile`.

Reconstructed from the user's screenshot, where it ran as three lines.

### A2. Vectorizer called by the service with `kind:"text"` (F1)

```powershell
$q = @{ select = "project_id,title"; vectorQueries = @( @{ kind = "text"; text = "SaaS project closeout duration"; fields = "content_vector"; k = 3; exhaustive = $true } ) } | ConvertTo-Json -Depth 6; Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json' | Select-Object -ExpandProperty value
```

Result: 3 results with no filter and `exhaustive: true`. 0.7561 and 0.7460 on project 1007355 "Project RED (EEDE Phase 1)", 0.7443 on project 1007122 "2022 - Gateway EAS Cloud Migration".

Proves the service reached the embedding endpoint through the proxy and got a usable vector. Reconstructed from the screenshot, where it ran as several lines.

### A3. Discover the knowledge base and knowledge source names

```powershell
$prodKb = (((Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).value) | Where-Object { $_.name -notlike 'ps-kb-*' })[0].name; $prodKs = (((Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgesources?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).value) | Where-Object { $_.name -notlike 'ps-ks-*' })[0].name; "knowledge base:   $prodKb"; "knowledge source: $prodKs"
```

Result: `knowledgebase-1788979805148` and `knowledgesource-1788979786196`.

`[0]` picked the right source because of list order, not by design. Every later command uses the literal names.

### A4. BM25 only, natural-language probe string (not a valid probe)

```powershell
$q = @{ search = "retrospective observations on what the delivery team would repeat"; filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 50; count = $true } | ConvertTo-Json -Depth 8; $r1 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; "BM25 count: " + $r1.'@odata.count'; $r1.value | Select-Object -First 5 '@search.score', project_id, title | Format-Table -AutoSize
```

Result: `BM25 count: 601`. The top 5 are all project 1009338, "MWS - SDWAN2023", scoring from 26.65 down to 17.99.

It failed as a probe because the default `searchMode` is `any`, so one shared word such as `team` or `delivery` is enough to match. A natural-language sentence cannot be lexically disjoint from project documents. As run, the count and the top-5 readout were two separate lines.

### A5. Vector only, same probe string (not a valid probe)

```powershell
$q = @{ search = $null; vectorQueries = @( @{ kind = "text"; text = "retrospective observations on what the delivery team would repeat"; fields = "content_vector"; k = 50 } ); filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 50; count = $true } | ConvertTo-Json -Depth 8; $r2 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; "vector count: " + $r2.'@odata.count'; $r2.value | Select-Object -First 3 '@search.score', project_id, title | Format-Table -AutoSize
```

Result: `vector count: 50`. Scores 0.0824, 0.0821, 0.0620.

Proves nothing by itself, because a vector query returns `k` neighbours for any input. A11 shows that the low scores come from the query text, not a broken vectorizer (F2).

### A6. Retrieve with `messages` (F5)

```powershell
$b = @{ messages = @( @{ role = "user"; content = @( @{ type = "text"; text = "retrospective observations on what the delivery team would repeat" } ) } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kb = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "references: " + @($kb.references).Count
```

Result: HTTP 400, `"Messages input not supported when 'minimal' reasoning effort is requested. Use intents input instead."` The line then printed `references: 1`. That is a false count: `$kb` was never assigned, and `@($null.references).Count` is 1.

Re-running it reproduces the error and nothing else.

### A7. Retrieve with `intents` on the production knowledge base (F4)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbA = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "control references: " + @($kbA.references).Count; $kbA.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs, @{n='filter';e={$_.searchIndexArguments.filter}}
```

Result: `control references: 28`, from three `searchIndex` activities. Id 0 had count 1 and filter `project_id eq '1009338' and gate_label eq 'Closeout'`. Id 1 had count 50 and no filter. Id 2 had count 33 and no filter. elapsedMs was 0 on all three.

Proves the knowledge base queries all three knowledge sources, and `filterAddOn` applies only to the one it names.

### A8. Full activity array for the same call (F9)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbA = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; $kbA.activity | ConvertTo-Json -Depth 8
```

Result: the `project_similarity_index` activity lists 28 `searchFields`, all text, with neither `body` nor `content_vector` among them. The `ldp_index` and `dbr_index` activities each carry their own field list.

As run, this was `$kbA.activity | ConvertTo-Json -Depth 8` in the same shell after A7. Here it repeats the retrieve so the line runs on its own. The user's transcription of the output had some low-confidence field names. The stored list reads back as 29 fields (A36); the names are open (O1).

### A9. BM25 only, gibberish token (F8)

```powershell
$q = @{ search = "zqxjvwkbhf"; filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 50; count = $true } | ConvertTo-Json -Depth 8; $r3 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; "gibberish BM25 count: " + $r3.'@odata.count'
```

Result: `gibberish BM25 count: 0`.

### A10. Retrieve with the gibberish token on the production knowledge base (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "zqxjvwkbhf" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbB = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "gibberish references: " + @($kbB.references).Count; $kbB.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object count, elapsedMs
```

Result: `gibberish references: 0`. Activity counts 0, 0 and 0, with elapsedMs 50, 50 and 67.

0 references because default reranking drops every vector neighbour of a gibberish token (F8). On the `project_similarity_index` source the vector query is also off (F9).

### A11. Vector only, relevant text (F2)

```powershell
$q = @{ search = $null; vectorQueries = @( @{ kind = "text"; text = "lessons learned from this project closeout, what went well and what went wrong"; fields = "content_vector"; k = 10 } ); filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 10; count = $true } | ConvertTo-Json -Depth 8; $r4 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; $r4.value | Select-Object -First 5 '@search.score', project_id, title | Format-Table -AutoSize
```

Result: 0.6461, 0.6465, 0.6411, 0.6377, 0.6313, all on project 1009338.

Eight times the 0.08 from A5, so the embedding model matches the index.

### A12. Knowledge sources on the knowledge base (F4)

```powershell
(Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).knowledgeSources | Select-Object name
```

Result: `knowledgesource-1788979786196`, `knowledgesource-1789660272864`, `knowledgesource-1789660431937`.

The first attempt wrote `$prodKb?api-version` and failed with `"Invalid or missing api-version query string parameter"`. `$($prodKb)?` fixed it, and the literal name here avoids the problem.

### A13. `neverQuerySource` on the other two sources (failed)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }, @{ knowledgeSourceName = 'knowledgesource-1789660272084'; kind = "searchIndex"; neverQuerySource = $true }, @{ knowledgeSourceName = 'knowledgesource-1789660431937'; kind = "searchIndex"; neverQuerySource = $true } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbC = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "references: " + @($kbC.references).Count; $kbC.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count
```

Result: HTTP 400, `"Knowledge Source Params target Knowledge Source name must match a Knowledge Base Knowledge Source name."` The line also printed a false `references: 1`.

The cause is a typo in the command: it has `knowledgesource-1789660272084`, and the real name is `knowledgesource-1789660272864`. It was not retried, because a single-source knowledge base (A14) gives the same isolation without depending on `neverQuerySource`. Whether `neverQuerySource` works at `minimal` effort is open (O7).

### A14. Create `ps-kb-isolated` (F7)

```powershell
$kbb = @{ name = 'ps-kb-isolated'; description = 'Baseline: project_similarity knowledge source only.'; knowledgeSources = @( @{ name = 'knowledgesource-1788979786196' } ); outputMode = 'extractiveData'; retrievalReasoningEffort = @{ kind = 'minimal' } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-isolated?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $kbb -ContentType 'application/json'
```

Result: created, with one knowledge source, no models, and `minimal` effort.

### A15. Retrieve `lessons learned` on `ps-kb-isolated` (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbD = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-isolated/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "references: " + @($kbD.references).Count; $kbD.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs
```

Result: `references: 1`, from one activity with id 0, count 1, elapsedMs 0.

This is the clean single-source baseline. It matches the filtered activity in A7.

### A16. Clone the production knowledge source with `searchFields` emptied (F7)

```powershell
$ks = Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/knowledgesource-1788979786196?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $c = ($ks | ConvertTo-Json -Depth 20 | ConvertFrom-Json) | Select-Object -Property * -ExcludeProperty '@odata.context','@odata.etag'; $c.name = 'ps-ks-allfields'; $c | Add-Member -NotePropertyName description -NotePropertyValue 'searchFields emptied' -Force; $c.searchIndexParameters.searchFields = @(); Invoke-RestMethod -Method Put -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body ($c | ConvertTo-Json -Depth 20) -ContentType 'application/json'
```

Result: created `ps-ks-allfields`. The echo showed `searchIndexName`, `sourceDataFields` and `searchFields`, and no `semanticConfigurationName`.

As run, the description was set with `$c.description = '...'`. That assignment throws when the source has no `description` property. The production source has one, so it worked. This command uses `Add-Member -Force`, which works either way.

### A17. Create `ps-kb-allfields` (F7)

```powershell
$kbb = @{ name = 'ps-kb-allfields'; description = 'Sibling with searchFields emptied.'; knowledgeSources = @( @{ name = 'ps-ks-allfields' } ); outputMode = 'extractiveData'; retrievalReasoningEffort = @{ kind = 'minimal' } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $kbb -ContentType 'application/json'
```

Result: created, with one knowledge source, no models, and `minimal` effort.

### A18. Retrieve the gibberish token on the sibling (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "zqxjvwkbhf" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbE = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "gibberish references: " + @($kbE.references).Count; $kbE.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs
```

Result: `gibberish references: 0`, from one activity with count 0.

0 references because default reranking drops every vector neighbour (F8).

### A19. Retrieve `lessons learned` on the sibling (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbF = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "real references: " + @($kbF.references).Count; $kbF.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs
```

Result: 9 references, from one activity with count 9 and elapsedMs 0.

9 references against A15's 1. The gain comes from the vector query, which the production list turns off (F9). As run, the label read `gibberish references: 9` because the line was copied from A18. It is relabeled here.

## Appendix: commands run 2026-09-18

Same service and conventions as the appendix above. Commands A24 and later were run against the local stub before the user ran them, except A21, A22 and A23, which are read-only.

### A20. Re-run of A2 and A1

Result: identical to A2 (0.7561, 0.7460, 0.7443). A1 now also printed `modelName` `text-embedding-3-small`, `authIdentity` blank and `customWebApiParameters` empty.

### A21. Service settings with `az search service list` (failed)

```powershell
az search service list --query "[?name=='workdeliverygpt-dev-srch'].{name:name, resourceGroup:resourceGroup, sku:sku.name, computeType:computeType, semanticSearch:semanticSearch, knowledgeRetrieval:knowledgeRetrieval}" -o jsonc
```

Result: `the following arguments are required: --resource-group/-g`. This CLI build requires a resource group for `list`.

### A22. Service settings (F3)

```powershell
$rg = az resource list --name workdeliverygpt-dev-srch --resource-type Microsoft.Search/searchServices --query "[0].resourceGroup" -o tsv; "resource group: $rg"; az resource show --resource-group $rg --name workdeliverygpt-dev-srch --resource-type Microsoft.Search/searchServices --api-version 2026-03-01-preview --query "{sku:sku.name, computeType:properties.computeType, semanticSearch:properties.semanticSearch, knowledgeRetrieval:properties.knowledgeRetrieval}" -o jsonc
```

Result: `resource group: workdeliverygpt-dev-rg`; `computeType` Default, `knowledgeRetrieval` standard, `semanticSearch` standard, `sku` standard.

### A23. Index vector fields, algorithm and semantic default (F3)

```powershell
$ix = Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index?api-version=2026-04-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; '--- VECTOR FIELDS ---'; $ix.fields | Where-Object { $_.vectorSearchProfile } | Select-Object name, type, searchable, retrievable, stored, dimensions, vectorSearchProfile | Format-Table -AutoSize; '--- PROFILES ---'; $ix.vectorSearch.profiles | Select-Object name, algorithm, compression, vectorizer | Format-Table -AutoSize; '--- ALGORITHMS ---'; $ix.vectorSearch.algorithms | Select-Object name, kind | Format-Table -AutoSize; '--- SEMANTIC ---'; 'defaultConfiguration: ' + $ix.semantic.defaultConfiguration
```

Result: one vector field, `content_vector`, `Collection(Edm.Single)`, 1536 dimensions, `searchable`, `retrievable`, `stored` all True, profile `content-vector-hnsw-profile`. Profile: algorithm `content-vector-hnsw-config`, no compression, vectorizer `ps_text_3_small`. Algorithm kind `hnsw`. `defaultConfiguration:` blank.

### A24. `searchFields` variants in place on `ps-ks-allfields` (F10)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ks = Invoke-RestMethod -Uri "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers $h; $sdf = @($ks.searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $cfgs = @((Invoke-RestMethod -Uri "$ep/indexes/project_similarity_index?api-version=2026-04-01" -Headers $h).semantic.configurations | ForEach-Object { $_.name }); 'semantic configurations: ' + ($cfgs -join ', ') + '   sourceDataFields kept: ' + $sdf.Count; $variants = @( @{ label = 'absent'; p = @{} }, @{ label = 'absent + sc'; p = @{ semanticConfigurationName = $cfgs[0] } }, @{ label = 'star'; p = @{ searchFields = @( @{ name = '*' } ) } }, @{ label = 'vector named'; p = @{ searchFields = @( @{ name = 'content_vector' } ) } }, @{ label = 'restore []'; p = @{ searchFields = @() } } ); foreach ($v in $variants) { $p = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf }; foreach ($k in $v.p.Keys) { $p[$k] = $v.p[$k] }; try { $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = $p } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers $h -Body $body -ContentType 'application/json' | Out-Null; $sp = (Invoke-RestMethod -Uri "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers $h).searchIndexParameters; $state = if (-not ($sp.PSObject.Properties.Name -contains 'searchFields')) { 'ABSENT' } elseif (@($sp.searchFields).Count -eq 0) { 'EMPTY []' } else { 'SET ' + (ConvertTo-Json -InputObject @($sp.searchFields) -Compress) }; '{0,-13} stored searchFields = {1}   semanticConfigurationName = {2}' -f $v.label, $state, $sp.semanticConfigurationName; if ($v.label -eq 'restore []') { continue }; foreach ($t in 'zqxjvwkbhf','lessons learned') { try { $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview" -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '    {0,-16} refs={1,-4} count={2,-4} ms={3}' -f $t, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '    {0,-16} ERROR {1}' -f $t, $m } } } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-13} REJECTED  {1}' -f $v.label, $m } }
```

Result: `semantic configurations: default   sourceDataFields kept: 94`. Then, as `zqxjvwkbhf` / `lessons learned` refs and count, all `ms=0`:

```
absent          stored ABSENT                     0/0    9/9
absent + sc     stored ABSENT, sc = default       0/0    9/9
star            stored SET [{"name":"*"}]         0/0    9/9
vector named    stored SET [{"name":"content_vector"}]   0/0    0/0
restore []      stored EMPTY []
```

The `vector named` 0/0 for `lessons learned` did not repeat in A26 or A28, which waited or ran later; treat it as a propagation delay right after the PUT.

### A25. Result filters off, first attempt (failed)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $variants = @( @{ label = 'threshold 0'; k = 'rerankerThreshold'; v = 0.0 }, @{ label = 'processing none'; k = 'resultsProcessing'; v = 'none' }, @{ label = 'failOnError'; k = 'failOnError'; v = $true } ); foreach ($p in @( @{ kb = 'ps-kb-allfields'; ks = 'ps-ks-allfields' } )) { foreach ($v in $variants) { try { $ksp = @{ knowledgeSourceName = $p.ks; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }; $ksp[$v.k] = $v.v; $b = @{ intents = @( @{ type = 'semantic'; search = 'zqxjvwkbhf' } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/$($p.kb)/retrieve?api-version=2026-08-01-preview" -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} {1,-16} refs={2,-4} count={3,-4} ms={4}' -f $p.kb, $v.label, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} {1,-16} ERROR {2}' -f $p.kb, $v.label, $m } } }
```

Result: three rows of `ERROR The remote name could not be resolved: 'urihttps'`. The terminal paste joined `-Uri` to the URL. Later commands build each URL into a variable first.

### A26. Vector-only `searchFields` with filters off, `lessons learned` (F11)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $vec = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = @( @{ name = 'content_vector' } ) } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $vec -ContentType 'application/json' | Out-Null; 'set searchFields = content_vector only'; foreach ($v in @( @{ label = 'plain' }, @{ label = 'processing none'; k = 'resultsProcessing'; v = 'none' }, @{ label = 'threshold 0'; k = 'rerankerThreshold'; v = 0.0 }, @{ label = 'failOnError'; k = 'failOnError'; v = $true } )) { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }; if ($v.k) { $ksp[$v.k] = $v.v }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} refs={1,-4} count={2,-4} ms={3}' -f $v.label, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} ERROR {1}' -f $v.label, $m } }; $rst = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = @() } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $rst -ContentType 'application/json' | Out-Null; 'restored searchFields = []'
```

Result:

```
plain            refs=9    count=9    ms=0
processing none  refs=9    count=50   ms=447
threshold 0      refs=13   count=13   ms=0
failOnError      refs=9    count=9    ms=0
restored searchFields = []
```

### A27. Gibberish with reranking bypassed, `maxOutputDocuments` 49 (failed)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $put = { param($sf, $label) $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null; Start-Sleep -Seconds 15; "--- searchFields = $label (after 15 s wait) ---" }; $probe = { foreach ($t in 'zqxjvwkbhf','lessons learned') { foreach ($mode in 'rerank','none') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 49; resultsProcessing = $mode }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} {1,-7} refs={2,-4} count={3,-4} ms={4}' -f $t, $mode, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} {1,-7} ERROR {2}' -f $t, $mode, $m } } } }; & $put @() '[]'; & $probe; & $put @( @{ name = 'content_vector' } ) 'content_vector'; & $probe; & $put @() '[] (restored)'
```

Result: every retrieve returned `Value for MaxOutputDocuments must be between 50 and 200.` The PUTs and waits ran, and `searchFields` ended restored to `[]`.

### A28. Gibberish with reranking bypassed, `maxOutputDocuments` 51 (F8)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $put = { param($sf, $label) $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null; Start-Sleep -Seconds 15; "--- searchFields = $label (after 15 s wait) ---" }; $probe = { foreach ($t in 'zqxjvwkbhf','lessons learned') { foreach ($mode in 'rerank','none') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 51; resultsProcessing = $mode }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} {1,-7} refs={2,-4} count={3,-4} ms={4}' -f $t, $mode, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} {1,-7} ERROR {2}' -f $t, $mode, $m } } } }; & $put @() '[]'; & $probe; & $put @( @{ name = 'content_vector' } ) 'content_vector'; & $probe; & $put @() '[] (restored)'
```

Result:

```
--- searchFields = [] ---
zqxjvwkbhf       rerank  refs=0    count=0    ms=0
zqxjvwkbhf       none    refs=7    count=51   ms=477
lessons learned  rerank  refs=10   count=10   ms=0
lessons learned  none    refs=9    count=51   ms=643
--- searchFields = content_vector ---
zqxjvwkbhf       rerank  refs=0    count=0    ms=0
zqxjvwkbhf       none    refs=7    count=51   ms=513
lessons learned  rerank  refs=10   count=10   ms=0
lessons learned  none    refs=9    count=51   ms=451
--- searchFields = [] (restored) ---
```

### A29. Gibberish candidates against Search API vector neighbours (F8)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; $key = @((Invoke-RestMethod -Uri "$ep/indexes/project_similarity_index?api-version=2026-04-01" -Headers $h).fields | Where-Object { $_.key })[0].name; 'index key field: ' + $key; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $q = @{ select = $key; filter = $f; top = 51; vectorQueries = @( @{ kind = 'text'; text = 'zqxjvwkbhf'; fields = 'content_vector'; k = 51 } ) } | ConvertTo-Json -Depth 8; $vk = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body $q -ContentType 'application/json').value | ForEach-Object { [string]$_.$key }); $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $b = @{ intents = @( @{ type = 'semantic'; search = 'zqxjvwkbhf' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 51; resultsProcessing = 'none' } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $kk = @($r.references | Where-Object { $_ } | ForEach-Object { if ($_.sourceData.$key) { [string]$_.sourceData.$key } else { [string]$_.docKey } }); $hit = @($kk | Where-Object { $vk -contains $_ }); 'Search API vector-only neighbours: ' + $vk.Count; 'KB gibberish references (none):   ' + $kk.Count; 'KB references found among the Search API vector neighbours: ' + $hit.Count + ' of ' + $kk.Count; 'first KB keys: ' + (($kk | Select-Object -First 3) -join ', ')
```

Result: `index key field: psr_row_id`; Search API vector-only neighbours 51; KB gibberish references (none) 7; 7 of 7 found among the Search API neighbours. First keys: `1009338_1009338-1009338-g3-itcash-sdwan-2023-closeout-86f644863c06ccb2_chunk_435`, `..._chunk_252`, `..._chunk_207`.

### A30. `lessons learned` with request-level `maxOutputDocuments` 50 (F11)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; foreach ($v in @( @{ label = 'rerank default' }, @{ label = 'threshold 0'; k = 'rerankerThreshold'; v = 0.0 }, @{ label = 'processing none'; k = 'resultsProcessing'; v = 'none' } )) { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50 }; if ($v.k) { $ksp[$v.k] = $v.v }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $refs = @($r.references | Where-Object { $_ }); $les = @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' }); $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} refs={1,-4} count={2,-4} body mentions lesson={3,-4} ms={4}' -f $v.label, $refs.Count, $a.count, $les.Count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} ERROR {1}' -f $v.label, $m } }
```

Result:

```
rerank default   refs=9    count=9    body mentions lesson=2    ms=0
threshold 0      refs=13   count=50   body mentions lesson=2    ms=0
processing none  refs=9    count=50   body mentions lesson=2    ms=571
```

### A31. A32 and A33, first attempt (failed)

Both commands in a new shell without `. .\src\api\env.ps1`. Every call returned `Object reference not set to an instance of an object`, which `Invoke-RestMethod` throws when a header value is null. Nothing reached the service. Load the environment file in each new shell.

### A32. Knowledge base definition and `maxOutputSize` (F12)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $kb = Invoke-RestMethod -Uri "$ep/knowledgebases/ps-kb-allfields?api-version=2026-08-01-preview" -Headers $h; '--- KNOWLEDGE BASE ---'; $kb | Select-Object -Property * -ExcludeProperty '@odata.context','@odata.etag','knowledgeSources' | ConvertTo-Json -Depth 8; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; '--- RETRIEVE, none, maxOutputDocuments 50 + maxOutputSize ---'; foreach ($sz in 50000, 200000) { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; maxOutputSize = $sz; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $refs = @($r.references | Where-Object { $_ }); $les = @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' }); $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; 'maxOutputSize={0,-7} refs={1,-4} count={2,-4} body mentions lesson={3}' -f $sz, $refs.Count, $a.count, $les.Count } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'maxOutputSize={0,-7} ERROR {1}' -f $sz, $m } }
```

Result: the knowledge base definition shows `retrieveDefaults: null`, `models: []`, `outputMode: extractiveData`, `retrievalReasoningEffort: minimal`, and `retrievalInstructions` and `answerInstructions` null.

```
maxOutputSize=50000   refs=38   count=50   body mentions lesson=2
maxOutputSize=200000  refs=50   count=50   body mentions lesson=2
```

### A33. Search API baseline (F14)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; foreach ($m in @( @{ label = 'BM25 only'; q = @{ search = 'lessons learned' } }, @{ label = 'vector only'; q = @{ vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ) } }, @{ label = 'hybrid'; q = @{ search = 'lessons learned'; vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ) } }, @{ label = 'hybrid+semantic'; q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ) } } )) { try { $q = $m.q; $q['filter'] = $f; $q['top'] = 50; $q['select'] = 'body'; $r = Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body ($q | ConvertTo-Json -Depth 8) -ContentType 'application/json'; $v = @($r.value); $les = @($v | Where-Object { [string]$_.body -match 'lesson' }); '{0,-16} results={1,-4} body mentions lesson={2}' -f $m.label, $v.Count, $les.Count } catch { $e = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} ERROR {1}' -f $m.label, $e } }
```

Result:

```
BM25 only        results=1    body mentions lesson=1
vector only      results=50   body mentions lesson=2
hybrid           results=50   body mentions lesson=2
hybrid+semantic  results=50   body mentions lesson=2
```

### A34. Eight-project comparison (F16)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; '{0,-8} {1,-22} {2,-22} {3,-22}' -f 'project', 'Search API hyb+sem', 'KB rerank', 'KB none'; foreach ($p in '1009338','1009392','1010069','1011517','1011718','1011742','1012268','1012329') { $f = "project_id eq '$p' and gate_label eq 'Closeout'"; $out = @(); try { $q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); filter = $f; top = 50; select = 'body' } | ConvertTo-Json -Depth 8; $v = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body $q -ContentType 'application/json').value); $out += ('{0} res, {1} lesson' -f $v.Count, @($v | Where-Object { [string]$_.body -match 'lesson' }).Count) } catch { $out += 'ERROR' }; foreach ($mode in 'rerank','none') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = $mode }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $refs = @($r.references | Where-Object { $_ }); $out += ('{0} refs, {1} lesson' -f $refs.Count, @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' }).Count) } catch { $out += 'ERROR' } }; '{0,-8} {1,-22} {2,-22} {3,-22}' -f $p, $out[0], $out[1], $out[2] }
```

Result:

```
project  Search API hyb+sem     KB rerank              KB none
1009338  50 res, 2 lesson       9 refs, 2 lesson       50 refs, 2 lesson
1009392  50 res, 2 lesson       4 refs, 1 lesson       50 refs, 2 lesson
1010069  11 res, 1 lesson       11 refs, 1 lesson      11 refs, 1 lesson
1011517  50 res, 2 lesson       25 refs, 2 lesson      50 refs, 2 lesson
1011718  50 res, 1 lesson       8 refs, 1 lesson       50 refs, 1 lesson
1011742  50 res, 2 lesson       13 refs, 2 lesson      50 refs, 2 lesson
1012268  50 res, 2 lesson       8 refs, 1 lesson       50 refs, 2 lesson
1012329  50 res, 2 lesson       5 refs, 2 lesson       50 refs, 2 lesson
```

### A35. Production `searchFields` list and candidate count (F9)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; foreach ($c in @( @{ kb = 'ps-kb-isolated'; ks = 'knowledgesource-1788979786196'; mod = 50 }, @{ kb = 'ps-kb-allfields'; ks = 'ps-ks-allfields'; mod = 50 }, @{ kb = 'ps-kb-allfields'; ks = 'ps-ks-allfields'; mod = 200 } )) { $rtu = "$ep/knowledgebases/$($c.kb)/retrieve?api-version=2026-08-01-preview"; foreach ($t in 'zqxjvwkbhf','lessons learned') { try { $ksp = @{ knowledgeSourceName = $c.ks; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = $c.mod; resultsProcessing = 'none' }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = $c.mod; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} max={1,-4} {2,-16} refs={3,-4} count={4,-4} ms={5}' -f $c.kb, $c.mod, $t, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} max={1,-4} {2,-16} ERROR {3}' -f $c.kb, $c.mod, $t, $m } } }
```

Result:

```
ps-kb-isolated   max=50   zqxjvwkbhf       refs=0    count=0    ms=59
ps-kb-isolated   max=50   lessons learned  refs=1    count=1    ms=16
ps-kb-allfields  max=50   zqxjvwkbhf       refs=50   count=50   ms=1135
ps-kb-allfields  max=50   lessons learned  refs=50   count=50   ms=545
ps-kb-allfields  max=200  zqxjvwkbhf       refs=159  count=200  ms=612
ps-kb-allfields  max=200  lessons learned  refs=143  count=200  ms=447
```

### A36. `searchFields` lists that include `content_vector` (F10)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $prod = @((Invoke-RestMethod -Uri "$ep/knowledgesources/knowledgesource-1788979786196?api-version=2026-08-01-preview" -Headers $h).searchIndexParameters.searchFields | ForEach-Object { $_.name }); 'production list: ' + $prod.Count + ' fields'; $variants = @( @{ label = 'prod list + content_vector'; names = @($prod + 'content_vector') }, @{ label = 'body + content_vector'; names = @('body', 'content_vector') }, @{ label = 'restore []'; names = @() } ); foreach ($v in $variants) { $sf = @($v.names | ForEach-Object { @{ name = $_ } }); $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; try { Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; "--- $($v.label): PUT REJECTED $m"; continue }; if ($v.label -eq 'restore []') { '--- restored searchFields = []'; break }; Start-Sleep -Seconds 15; "--- $($v.label) ($($sf.Count) fields, after 15 s wait) ---"; foreach ($t in 'zqxjvwkbhf','lessons learned') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50; resultsProcessing = 'none' }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '    {0,-16} refs={1,-4} count={2,-4} ms={3}' -f $t, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '    {0,-16} ERROR {1}' -f $t, $m } } }
```

Result: `production list: 29 fields`. Production list plus `content_vector` (30 fields): `zqxjvwkbhf` refs 50, count 50, 1,108 ms; `lessons learned` refs 50, count 50. `body` plus `content_vector`: `zqxjvwkbhf` refs 50, count 50, 530 ms; `lessons learned` refs 50, count 50. Restored to `[]`. An earlier attempt in a shell without `. .\src\api\env.ps1` failed the same way as A31 and sent nothing.

### A37. Same-chunks check, `lessons learned` (F15)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $key = @((Invoke-RestMethod -Uri "$ep/indexes/project_similarity_index?api-version=2026-04-01" -Headers $h).fields | Where-Object { $_.key })[0].name; $vq = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); $sets = @{}; foreach ($m in @( @{ label = 'hybrid'; q = @{ search = 'lessons learned'; vectorQueries = $vq } }, @{ label = 'hybrid+semantic'; q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = $vq } } )) { $q = $m.q; $q['filter'] = $f; $q['top'] = 50; $q['select'] = "$key,body"; $v = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body ($q | ConvertTo-Json -Depth 8) -ContentType 'application/json').value); $sets[$m.label] = @{ keys = @($v | ForEach-Object { [string]$_.$key }); les = @($v | Where-Object { [string]$_.body -match 'lesson' } | ForEach-Object { [string]$_.$key }) } }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $refs = @((Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json').references | Where-Object { $_ }); $kk = @($refs | ForEach-Object { if ($_.sourceData.$key) { [string]$_.sourceData.$key } else { [string]$_.docKey } }); $kl = @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' } | ForEach-Object { [string]$_.sourceData.$key }); 'key field: ' + $key + '   KB references: ' + $kk.Count + '   KB lesson chunks: ' + $kl.Count; foreach ($n in 'hybrid','hybrid+semantic') { $s = $sets[$n]; '{0,-16} results={1,-3} overlap with KB={2,-3} lesson chunks={3}, of which in KB={4}' -f $n, $s.keys.Count, @($kk | Where-Object { $s.keys -contains $_ }).Count, $s.les.Count, @($s.les | Where-Object { $kk -contains $_ }).Count }; 'first KB keys: ' + (($kk | Select-Object -First 2) -join ', ')
```

Result:

```
key field: psr_row_id   KB references: 50   KB lesson chunks: 2
hybrid           results=50  overlap with KB=50  lesson chunks=2, of which in KB=2
hybrid+semantic  results=50  overlap with KB=50  lesson chunks=2, of which in KB=2
```
