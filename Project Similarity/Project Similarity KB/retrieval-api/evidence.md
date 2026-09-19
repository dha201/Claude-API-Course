# Evidence

Every measured finding, [F1](#f1) to [F23](#f23), with its setup, result table, date and the commands in [commands.md](commands.md) that produced it. [ground-truth.md](ground-truth.md) states what these findings mean.

Setup for [F7](#f7) to [F16](#f16) unless a finding says otherwise:

- `ps-kb-allfields`: a single-source knowledge base over `ps-ks-allfields`, a copy of the production knowledge source with `searchFields` set to `[]`. `minimal` effort, no models, `outputMode: extractiveData`.
- `ps-kb-isolated`: a single-source knowledge base over the production knowledge source `knowledgesource-1788979786196`.
- `intents` with `type: semantic`, project 1009338, filter `project_id eq '1009338' and gate_label eq 'Closeout'` (601 chunks), query `lessons learned`.
- refs = references returned, count = activity `count`.
- "lesson" = returned chunks whose `body` matches the regex `lesson`. It's a rough measure: lessons prose without the word isn't counted.

<a id="f1"></a>

## F1. The index vectorizer works from the Search API

2026-09-17 and 2026-09-18. [A1](commands.md#a1), [A2](commands.md#a2), [A20](commands.md#a20).

- `vectorQueries` with `kind: "text"` makes the service call the vectorizer. With no filter it returned 3 results: 0.7561, 0.7460, 0.7443.
- Vectorizer `ps_text_3_small`: kind `azureOpenAI`, `resourceUri` an internal proxy host with a `/wdgpt` path, `deploymentId` and `modelName` `text-embedding-3-small`, key auth, `authIdentity` unset, `customWebApiParameters` empty.

The service reaches the embedding model through the proxy with key auth.

<a id="f2"></a>

## F2. The embedding model matches the index

2026-09-17. [A5](commands.md#a5), [A11](commands.md#a11).

Same vectorizer, same filter, vector-only queries:

```
  "lessons learned from this project closeout, what went well and what went wrong"   0.6313 to 0.6465
  "retrospective observations on what the delivery team would repeat"                0.0620 to 0.0824
```

A mismatched embedding model can't produce that separation.

<a id="f3"></a>

## F3. Service and index settings

2026-09-18. [A22](commands.md#a22), [A23](commands.md#a23).

```
  Service     sku standard, computeType Default, semanticSearch standard, knowledgeRetrieval standard
  Index       one vector field, content_vector: Collection(Edm.Single), 1536 dimensions,
              searchable, retrievable and stored all true
              profile content-vector-hnsw-profile: algorithm content-vector-hnsw-config (hnsw),
              no compression, vectorizer ps_text_3_small
              one semantic configuration, default; semantic.defaultConfiguration blank
```

Retrieval still resolves a semantic configuration and returns reranker scores with the index default blank. These settings rule out confidential computing, free-tier knowledge retrieval billing, a second vector field and a profile without a vectorizer.

<a id="f4"></a>

## F4. The production knowledge base queries three knowledge sources

2026-09-17. [A7](commands.md#a7), [A12](commands.md#a12).

```
  knowledgesource-1788979786196    project_similarity_index
  knowledgesource-1789660272864    ldp_index
  knowledgesource-1789660431937    dbr_index
```

One retrieve with `filterAddOn` on the first source returned 28 references from three `searchIndex` activities: count 1 (filtered), 50 and 33 (unfiltered). `knowledgeSourceParams` configures a source; it doesn't select one. Any reference count from the production knowledge base mixes three indexes, so every later measurement uses a single-source knowledge base.

<a id="f5"></a>

## F5. The retrieve request at `minimal` effort

- `messages` returns HTTP 400 `Messages input not supported when 'minimal' reasoning effort is requested. Use intents input instead.` ([A6](commands.md#a6), 2026-09-17).
- `intents[].type` accepts only `semantic`. `keyword`, `vector`, `hybrid`, `simple` and `full` each return HTTP 400 `Valid types are: semantic` (production knowledge base, command and date not recorded).
- `retrievalReasoningEffort` `low` or `medium` returns HTTP 400 `A Knowledge Base model must be specified`, and `outputMode: answerSynthesis` returns HTTP 400 `A model must be specified` (same run).

<a id="f6"></a>

## F6. `maxOutputDocuments` accepts only 50 to 200

2026-09-18. [A27](commands.md#a27).

49 returned `Value for MaxOutputDocuments must be between 50 and 200.` Any record of 1 or 10 returning "count 1" comes from a failed call that printed a false count ([runbook.md, Pitfalls](runbook.md#pitfalls-for-future-agents)).

<a id="f7"></a>

## F7. Single-source baselines with default settings

2026-09-17. [A10](commands.md#a10), [A14](commands.md#a14) to [A19](commands.md#a19). Per-source `maxOutputDocuments` 50, default reranking, default token budget.

```
  knowledge base                     knowledge source                    query             refs  count
  ps-kb-isolated                     production                          lessons learned     1     1
  ps-kb-allfields                    ps-ks-allfields (searchFields [])   lessons learned     9     9
  ps-kb-allfields                    ps-ks-allfields                     zqxjvwkbhf          0     0
  production knowledge base (F4)     all three                           zqxjvwkbhf          0     0, 0, 0
```

The gain from 1 to 9 comes from the vector query, which the production list turns off ([F9](#f9)). The 0 for the gibberish token is the reranker dropping every vector neighbour ([F8](#f8)).

<a id="f8"></a>

## F8. The Retrieval API runs the vector query

2026-09-18. [A9](commands.md#a9), [A28](commands.md#a28), [A29](commands.md#a29).

`zqxjvwkbhf` is in no document, and BM25 returns 0 for it ([A9](commands.md#a9)). On `ps-kb-allfields`, per-source `maxOutputDocuments` 51, 15 seconds after each knowledge source PUT:

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

With reranking bypassed, the knowledge base finds 51 candidates for a token no keyword query can match. A Search API vector-only query for the same token (`k` 51, same filter) returned 51 neighbours, and all 7 knowledge base references are among them, matched on the index key `psr_row_id` ([A29](commands.md#a29)). So the Retrieval API runs the vector query through the proxy vectorizer, and the filter applies to it. With default reranking, the semantic ranker drops every one of those neighbours, so the count reads 0.

Reference keys look like `1009338_1009338-1009338-g3-itcash-sdwan-2023-closeout-86f644863c06ccb2_chunk_435`. `elapsedMs` reads 0 on every reranked row, including requests never sent before, so it's a reporting quirk, not a cache.

<a id="f9"></a>

## F9. An explicit `searchFields` list without `content_vector` turns the vector query off

2026-09-18. [A33](commands.md#a33), [A35](commands.md#a35), [A36](commands.md#a36).

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

With reranking bypassed, the production knowledge source still finds no candidate for the gibberish token, so no vector query runs on it. Its single `lessons learned` result matches the Search API's BM25-only result count of 1 ([A33](commands.md#a33)). The two knowledge sources differ only in `searchFields`: the production one stores an explicit list, which reads back as 29 fields with no `content_vector` ([A36](commands.md#a36)), and `ps-ks-allfields` stores `[]`. This is the cause of 1 against 9 in [F7](#f7). No Microsoft page says an explicit list turns the vector query off ([sources.md](sources.md)).

The field names in the production list are open ([O1](runbook.md#o1)). The executed list in the activity array ([A8](commands.md#a8)) was transcribed by hand as 28 text fields without `body` or `content_vector`, and some transcribed names are low confidence.

<a id="f10"></a>

## F10. `searchFields` values that keep the vector query on

2026-09-18. [A24](commands.md#a24), [A26](commands.md#a26), [A28](commands.md#a28), [A36](commands.md#a36). On `ps-ks-allfields`:

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

The 9 references with reranking on need the vector query, because BM25 over every field returns 1 result for `lessons learned` ([A33](commands.md#a33)). The gibberish rows can only come from the vector query. So a narrow keyword list is safe if it names `content_vector`. Two points about such lists are unproven ([O5](runbook.md#o5)).

Right after the PUT that set `[{"name":"content_vector"}]`, one `lessons learned` retrieve returned 0 ([A24](commands.md#a24)). It didn't repeat after a 15-second wait ([A26](commands.md#a26), [A28](commands.md#a28)), so it was propagation delay.

<a id="f11"></a>

## F11. The reranker threshold cuts candidates

2026-09-18. [A26](commands.md#a26), [A30](commands.md#a30). Per-source `maxOutputDocuments` 50, default token budget.

```
  mode                                             refs  count  lesson   command
  default reranking                                  9      9      2      A26, A30
  rerankerThreshold 0                               13     13             A26
  rerankerThreshold 0, request maxOutputDocuments 50 13     50      2      A30
  resultsProcessing "none"                           9     50      2      A26, A30
  failOnError true                                   9      9             A26
```

Default reranking keeps 9 of 50 candidates (10 of 51, [F8](#f8)). Threshold 0 keeps 13. With reranking bypassed, all 50 candidates pass stage 2 but references stay at 9, because the default token budget caps them ([F12](#f12)). `failOnError: true` raised no error.

A threshold sweep on the production knowledge source can't show a cut: its only survivor scores 3.846, above every tested threshold ([F20](#f20)).

<a id="f12"></a>

## F12. The output token budget capped references near 9

2026-09-18. [A30](commands.md#a30), [A32](commands.md#a32).

`ps-kb-allfields` stores `retrieveDefaults: null`, `models: []`, `outputMode: extractiveData`, `retrievalReasoningEffort: minimal`, and null `retrievalInstructions` and `answerInstructions`. `resultsProcessing: "none"`, `maxOutputDocuments` 50 on the request and the source:

```
  maxOutputSize   refs  count  lesson   command
  default            9     50      2    A30
   50,000           38     50      2    A32
  200,000           50     50      2    A32
```

The request-level `maxOutputDocuments` alone doesn't lift references past 9 ([A30](commands.md#a30)). The retrieve page says a request-level `maxOutputDocuments` with no token limit "Returns up to the specified number of grounding documents and doesn't apply a maxOutputSizeInTokens limit." and also "A document that exceeds the maxOutputSizeInTokens output budget can be omitted from the response." ([Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)). On this project the default budget still cut references to 9, and an explicit `maxOutputSize` lifted them. `maxOutputSize` is the `2026-05-01-preview` and later name for `maxOutputSizeInTokens` (same page).

On project 1012173 (88 chunks), `*` reached 50 references at the default budget ([F18](#f18)). Why the default budget binds at 9 on 1009338 and not there is unmeasured.

<a id="f13"></a>

## F13. With reranking bypassed, candidates follow `maxOutputDocuments`

2026-09-18. [A28](commands.md#a28), [A35](commands.md#a35).

Candidates are 51 at 51 ([F8](#f8)), 50 at 50 and 200 at 200 ([F9](#f9) table). At 200, the 200,000-token budget cuts references to 159 for the gibberish token and 143 for `lessons learned`. With reranking on, candidates stop at the ranker's 50-chunk window ([ground-truth.md](ground-truth.md#how-a-retrieve-runs)).

<a id="f14"></a>

## F14. Search API baseline on project 1009338

2026-09-18. [A33](commands.md#a33). `top` 50, `select` `body`, same filter.

```
  mode              results  lesson
  BM25 only             1       1
  vector only          50       2
  hybrid               50       2
  hybrid+semantic      50       2
```

BM25 over every field finds 1 result for `lessons learned`, and the vector query supplies the rest. Both APIs return the same 2 chunks that mention "lesson", and the default-rerank knowledge base run already held those 2 ([F11](#f11)).

<a id="f15"></a>

## F15. The knowledge base returns the same 50 chunks as the Search API

2026-09-18. [A37](commands.md#a37). Project 1009338 only.

The knowledge base's 50 references (`resultsProcessing: "none"`, `maxOutputDocuments` 50, `maxOutputSize` 200,000) are the same 50 chunks as the Search API's top 50 for hybrid and for hybrid with the semantic ranker: overlap 50 of 50, matched on `psr_row_id`. Both lesson-mentioning chunks are among them. On the other seven projects only the counts were compared ([F16](#f16), [O3](runbook.md#o3)).

<a id="f16"></a>

## F16. Parity on all eight projects

2026-09-18. [A34](commands.md#a34). Closeout filter per project, `lessons learned`. Search API: hybrid with the semantic ranker, `top` 50. Knowledge base: `ps-kb-allfields`, `maxOutputDocuments` 50 on the request and the source, `maxOutputSize` 200,000. Each cell is results, then lesson.

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
- 1012329 returns lesson chunks when queried directly, so its production failure is the lost gate list ([F17](#f17)), not retrieval.

## Measured with no command in commands.md

[F17](#f17) to [F23](#f23) come from the application trace, the evaluation sheet and runs from before 2026-09-17. Their commands weren't recorded, so each gives its source and the date where one exists.

<a id="f17"></a>

## F17. The eight-project prompt through the deployed pipeline

2026-09-16 20:13 UTC, deployed DEV pod, `KB_TRACE`. Production knowledge base, so the vector query was off ([F9](#f9)). The evidence fetch sent `rerankerThreshold` 1.0, `maxOutputDocuments` 50 and the default token budget.

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

The total is the sum of the per-project rows. The evaluation sheet records the same run as "1 to 4 chunks per project" ([F23](#f23), row 16). The Search API path on the same prompt returned 45 chunks for 1009338. The Retrieval API answer gave lessons for 4 projects (1009338, 1009392, 1010069, 1011517) and "no lessons found" for 4, while all 8 hold lessons in their Closeout documents ([F23](#f23), row 16).

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

<a id="f18"></a>

## F18. Single-project sweep on project 1012173

2026-09-15. Production knowledge base and knowledge source, so the vector query was off ([F9](#f9)). `filterAddOn: "project_id eq '1012173'"` (88 chunks). All nine calls returned HTTP 200.

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
- Source retrieved stayed at 50 with `resultsProcessing: "none"` and 200 documents, where [F13](#f13) predicts up to 88. The run didn't record whether 200 was set on the request, the source or both.

<a id="f19"></a>

## F19. Search API components on project 1009338

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

[A33](commands.md#a33) repeated BM25 only and vector only on 2026-09-18 with the same counts ([F14](#f14)).

<a id="f20"></a>

## F20. Production knowledge source: query text and threshold

Date not recorded, before 2026-09-17. Project 1009338 Closeout, production knowledge base, per-source `maxOutputDocuments` 50, default token budget. The vector query is off on this knowledge source ([F9](#f9)), so these counts are BM25 matches over the listed fields that survive the reranker.

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

Longer strings add 21 to 43 references that carry no lessons prose. The threshold sweep says nothing about the threshold, because every tested value keeps the 3.846 survivor ([F11](#f11) measures the cut).

<a id="f21"></a>

## F21. `search.ismatch` in `filterAddOn` parses and filters

Date not recorded. Production knowledge base, 7 requests, all HTTP 200, each filter echoed back in the activity array.

```
  filterAddOn                                                         documents matched
  search.ismatch('Yusoff','roles_project_sponsor,roles_work_lead')                   9
  search.ismatch('Fronteer~1','title','full','any')                                15
  search.ismatch('Amazon Web Services','vendors','simple','all')                   50
  the Amazon filter and gate_label eq 'Closeout'                                    6
```

- `Fronteer` with no `filterAddOn` returned 0 documents. The production knowledge source runs BM25 only ([F9](#f9)), so that 0 is keyword search without fuzzy matching.
- `vendors/any(v: search.ismatch('Kinaxis'))` is rejected: no lambdas.
- `search.ismatch('q','field','full')` is a syntax error: arguments 3 and 4 come as a pair.

Not measured: the no-filter baselines, whether the returned documents carry the content asked for, `simple` against `full` and `any` against `all` on one string, `search.ismatchscoring`, and whether any failing prompt passes with the filter in the pipeline ([O9](runbook.md#o9)).

<a id="f22"></a>

## F22. Four intents in one retrieve request

Date not recorded. Production knowledge base (three sources, [F4](#f4)).

4 intents returned 57 references, with per-intent counts 4, 21, 50 and 13 (sum 88). The knowledge source configuration wasn't recorded, and neither was whether the drop from 88 to 57 is deduplication or an output cap. The test in staging ([U8](staging-findings.md#u8)) re-measures it on a single-source knowledge base.

<a id="f23"></a>

## F23. Sixteen-prompt evaluation

Source: `Project Similarity/kb_vs_search_eval.csv`, one row per prompt, column "Verdict". Production knowledge base, so the vector query was off on the evidence fetch ([F9](#f9)). Date not recorded.

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
