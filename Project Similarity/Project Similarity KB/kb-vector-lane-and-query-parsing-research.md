# Retrieval API: the vector lane runs, what cuts its results, and what the filter language gives back

Scope: Azure AI Search agentic retrieval against the Project Similarity index on `workdeliverygpt-dev-srch`. API version `2026-08-01-preview`. Doc quotes are from Microsoft Learn, dated 2026-09-17. Measurements recorded 2026-09-18.

---

## 1. The evidence fetch returns 1 chunk where the Search API returns 50

### 1.1 Measured

Project 1009338, filter `gate_label eq 'Closeout'`, 601 chunks in the index, `top` and `maxOutputDocuments` both 50:

```
component removed from the Search API payload      returned
─────────────────────────────────────────────      ────────
nothing (BM25 + vector + semantic rerank)                50
vector query removed (BM25 + semantic rerank)             1
semantic rerank removed (BM25 + vector)                  50
both removed (BM25 only)                                  1
BM25 text removed (vector only)                          50

Retrieval API, same filter, same index, search='lessons learned'
  production knowledge source (28-field searchFields list)            1
  ps-kb-allfields (searchFields omitted, see Test 3)                  9
```

The Retrieval API count of 1 happens to equal the Search API BM25-only count of 1, but it isn't a missing vector lane: the vector leg runs (1.5). The gap from 50 has three measured causes:

- The production `searchFields` list leaves out `body`, which starves the keyword lane: 1 reference against 9 on the sibling (1.4).
- The semantic reranker and its threshold drop most of the 50 candidates (1.7).
- References stay near 9 to 13 even with reranking bypassed. The cause of that cap is unmeasured (1.7).

### 1.2 What the docs say must happen

The knowledge base runs at `retrievalReasoningEffort: minimal`. Microsoft defines that level as:

> "Disables LLM-based query planning to deliver the lowest cost and latency for agentic retrieval. It issues direct text and vector searches across the knowledge sources listed in the knowledge base, and returns the best-matching passages."
> [Set the retrieval reasoning effort](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-set-retrieval-reasoning-effort#reasoning-effort-levels)

Microsoft's own tutorial builds a knowledge base with `minimal` effort and an empty `models` array, then calls it "a knowledge base that performs hybrid retrieval from the knowledge source" ([Tutorial: Build an agentic retrieval solution](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-pipeline#understand-the-solution)).

So vector search runs with no model attached, and the measurements in 1.5 agree. Attaching a model to the knowledge base doesn't change that. A model only unlocks `retrievalReasoningEffort` above `minimal` and `outputMode: answerSynthesis`.

### 1.3 The two gates that control whether `content_vector` participates

Gate 1, the vectorizer:

> "If the index includes vector fields, you need a valid vectorizer definition so the agentic retrieval engine can vectorize query inputs. Otherwise, vector fields are ignored."
> [Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)

> "If your index contains vector fields, the query plan includes these fields if they're `searchable` and have a `vectorizer` assignment."
> [Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index#add-a-vectorizer)

Gate 2, query execution scope:

> "By default, all `searchable` fields are included in query execution, and all `retrievable` fields are returned in results. You can choose which fields to use for each action in the search index knowledge source definition."
> [Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index)

Both gates are satisfied. The index definition of `project_similarity_index` reads:

```
setting                                  value
───────────────────────────────────────  ──────────────────────────────────────────────
vector fields                            one, content_vector
content_vector type                      Collection(Edm.Single), 1536 dimensions
content_vector searchable/retrievable/stored   true / true / true
vector profile                           content-vector-hnsw-profile, algorithm hnsw, no compression
vectorizer                               ps_text_3_small, kind azureOpenAI, key auth
vectorizer resourceUri                   an internal proxy host with a /wdgpt path
deploymentId, modelName                  text-embedding-3-small
semantic configurations                  one, named default
semantic.defaultConfiguration            blank

service: sku standard, computeType Default, semanticSearch standard, knowledgeRetrieval standard
```

`content_vector` is `searchable` and has a vectorizer, so Gate 1 passes. On the sibling knowledge source the vector leg runs with `searchFields` omitted, set to `[]`, or set to `[{"name":"content_vector"}]` (1.5, Test 4), so Gate 2 doesn't block it either.

### 1.4 The production `searchFields` list starves the keyword lane

The `activity` array from the retrieve response prints this:

```
searchFields=[{'name':'accountable_portfolio'}, {'name':'accountable_portfolio_l2'}, …]
```

That's an explicit 28-field list, and `body` isn't in it. The documented default is an empty array, and an empty array means every searchable field. So on the production knowledge source the keyword lane never searches `body`, the field that holds the chunk text.

Emptying the list on the sibling knowledge source moves `lessons learned` from 1 reference to 9 (1.1). `searchFields` absent, `[]`, `[{"name":"*"}]`, and absent with `semanticConfigurationName: "default"` set explicitly all give the same results: 0 for the gibberish query in 1.5 with reranking on, 9 or 10 for `lessons learned`.

The same list also puts `accountable_portfolio` and the other structured entity columns in the keyword lane for prose queries. Whether that dilutes BM25 scoring is unmeasured. Test 5 measures it.

### 1.5 The vector leg runs through the vectorizer

The Search API payload passes a precomputed embedding:

```json
"vectorQueries": [{ "kind": "vector", "vector": <1536-dim>, "fields": "content_vector", "k": 50 }]
```

`"kind": "vector"` means the client computed the embedding, so on that path the search service never calls `ps_text_3_small`. The Retrieval API can't accept a precomputed vector. It calls the vectorizer itself.

A token that sits in no document isolates the vector leg, because BM25 has nothing to match. Measured with `zqxjvwkbhf` on `ps-kb-allfields`, filter `project_id eq '1009338' and gate_label eq 'Closeout'`:

```
query                                                              result
─────────────────────────────────────────────────────────────────  ──────────────────────
Search API, BM25 only                                              0
Search API, vector only, kind: text, fields content_vector, k 51   51 neighbours
Retrieval API, resultsProcessing "none", maxOutputDocuments 51     count 51, 7 references
Retrieval API, default reranking                                   count 0, 0 references
```

All 7 references are among the 51 vector neighbours, matched on the index key `psr_row_id`. The `resultsProcessing: "none"` result is the same with `searchFields` set to `[]` and to `[{"name":"content_vector"}]`.

So the knowledge base runs hybrid retrieval, vector leg included, and `ps_text_3_small` works through the proxy endpoint. With default reranking, the semantic reranker drops every vector neighbour of a gibberish query, which is why that run returns 0.

### 1.6 The `activity` array can't confirm or deny a vector query

`searchIndexArguments` has a fixed five-field shape and never carries vector arguments:

```json
"searchIndexArguments": {
  "search": "...",
  "filter": null,
  "sourceDataFields": [],
  "searchFields": [],
  "semanticConfigurationName": "en-semantic-config"
}
```
[Query a knowledge base, Activity array](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve#activity-array)

Don't read the absence of `vectorQueries` there as proof either way. Don't read `activity` `count` as the number of retrieved candidates either. The retrieve API's TypeSpec defines it as "The count of documents retrieved that were sufficiently relevant to pass the reranker threshold." That's why the gibberish query in 1.5 shows count 0 with default reranking and count 51 with reranking bypassed, with the same vector neighbours retrieved underneath.

### 1.7 The semantic reranker and an unexplained cap cut the 50 candidates

`lessons learned` on `ps-kb-allfields`:

```
maxOutputDocuments            mode                       references  count
────────────────────────────  ─────────────────────────  ──────────  ─────
per-source 50, request 50     default reranking                   9      9
                              rerankerThreshold 0                13     50
                              resultsProcessing "none"            9     50
per-source 50 only            default reranking                   9      9
                              rerankerThreshold 0                13     13
                              resultsProcessing "none"            9     50
51                            default reranking                  10     10
                              resultsProcessing "none"            9     51
```

In each of the first three rows, 2 of the returned chunks have a `body` that mentions "lesson".

```
  601 Closeout chunks
        │
        ├─► retrieval: keyword + vector, 50 candidates per subquery
        ▼
     L2 semantic rerank + threshold      resultsProcessing: "none" turns this off
        │                                rerankerThreshold sets the cut
        ▼
     reference cap, cause unmeasured     holds even with the rerank off
        │
        ▼
     references
```

- The retrieval stage finds 50 candidates, the per-subquery limit quoted in 4.2.
- The semantic reranker and its default threshold keep 9 or 10 of them. `rerankerThreshold` 0 keeps 13, so the threshold moves the result.
- On the production knowledge source, `rerankerThreshold` at 1.0, 0.0, 2.0 and 3.0 all returned count 1, and the one survivor scored 3.846. Every tested threshold keeps a 3.846 document, so that sweep never tested low-scoring candidates.
- References stay near 9 to 13 with reranking bypassed and request-level `maxOutputDocuments` 50. The cause of that cap is unmeasured. Candidates are the `retrieveDefaults` stored on the knowledge base and the output token budget `maxOutputSize`.
- `maxOutputDocuments` accepts only 50 to 200. A value of 49 returns `Value for MaxOutputDocuments must be between 50 and 200.` A failed call leaves the PowerShell result variable null, and `@($null.references).Count` prints 1, so a rejected value reads as 1 reference.
- How many of the Search API's 50 chunks carry lessons prose is unmeasured, so the precision of the two paths can't be compared yet.

---

## 2. Test steps

Tests 1, 3 and 4 have results. Tests 2 and 5 are unmeasured. Tests 1 and 2 touch the Search API only and change nothing.

### Test 1: does the vectorizer work

`"kind": "text"` forces the search service to call `ps_text_3_small`, which is what the Retrieval API does. The gibberish token keeps BM25 out of the result.

```http
POST {{search-endpoint}}/indexes/{{index}}/docs/search?api-version=2026-04-01
Content-Type: application/json
api-key: {{admin-key}}

{
  "search": null,
  "vectorQueries": [
    { "kind": "text", "text": "zqxjvwkbhf", "fields": "content_vector", "k": 51 }
  ],
  "filter": "project_id eq '1009338' and gate_label eq 'Closeout'",
  "select": "chunk_id,project_id,gate_label",
  "top": 51,
  "count": true
}
```

Result: 51 neighbours. The vectorizer works through the proxy endpoint, and Gate 1 passes. The retrieve-side half of this test is in 1.5.

### Test 2: does the vectorizer use the same model that built the index

> "The vectorizer must be the same embedding model used to create the vectors in the index."
> [Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index)

1536 dimensions is consistent with `text-embedding-3-small`. It's also consistent with `text-embedding-ada-002`, which would return HTTP 200 and wrong neighbors. Run the same query two ways and compare the returned id sets:

```
A.  "kind": "text",   "text": "lessons learned"
B.  "kind": "vector", "vector": <the pipeline's own embedding of "lessons learned">
```

Same top-10 ids and near-identical `@search.score` means the same model. Disjoint ids mean a model mismatch, and the running vector leg returns wrong chunks. Fix `deploymentId` and `modelName` on the vectorizer before you continue.

The index definition (`GET {{search-endpoint}}/indexes/{{index}}?api-version=2026-04-01`) gives the chain in 1.3: `content_vector` uses `content-vector-hnsw-profile`, which names `ps_text_3_small`, whose `deploymentId` and `modelName` are `text-embedding-3-small`. Whether that deployment produced the stored vectors is unmeasured, and the A/B comparison above is what settles it.

### Test 3: a knowledge source with no `searchFields` list

Create a second knowledge source against the same index. Omit `searchFields`, which means every searchable field including `content_vector`. Copy `sourceDataFields` verbatim from the production knowledge source, because it controls what comes back in `sourceData` and changing it would confound the result.

Don't modify the production knowledge source. A sibling lets you A/B and keeps DEV working.

```http
PUT {{search-endpoint}}/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview
Content-Type: application/json
api-key: {{admin-key}}

{
  "name": "ps-ks-allfields",
  "kind": "searchIndex",
  "description": "Twin of the production knowledge source with searchFields omitted.",
  "searchIndexParameters": {
    "searchIndexName": "{{index}}",
    "semanticConfigurationName": "{{same-semantic-config-as-production}}",
    "sourceDataFields": [ ... copy verbatim ... ]
  }
}
```

```http
PUT {{search-endpoint}}/knowledgebases/ps-kb-allfields?api-version=2026-08-01-preview
Content-Type: application/json
api-key: {{admin-key}}

{
  "name": "ps-kb-allfields",
  "knowledgeSources": [{ "name": "ps-ks-allfields" }],
  "outputMode": "extractiveData",
  "retrievalReasoningEffort": { "kind": "minimal" }
}
```

No `models`. That holds the model variable fixed and tests the claim in 1.2.

```http
POST {{search-endpoint}}/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview
Content-Type: application/json
api-key: {{query-key}}

{
  "intents": [{ "type": "semantic", "search": "lessons learned" }],
  "knowledgeSourceParams": [{
    "knowledgeSourceName": "ps-ks-allfields",
    "kind": "searchIndex",
    "filterAddOn": "project_id eq '1009338' and gate_label eq 'Closeout'",
    "includeReferences": true,
    "maxOutputDocuments": 50
  }],
  "includeActivity": true
}
```

Result: 9 references and count 9, against 1 reference on the production knowledge source. The gap isn't a missing vector lane (1.5). The gain comes from `body` entering the keyword lane (1.4). The remaining cut from 50 is in 1.7.

### Test 4: name `content_vector` in `searchFields`

Same setup as Test 3, but with `searchFields` present:

```json
"searchFields": [{ "name": "content_vector" }]
```

Result: the service accepts `content_vector` in `searchFields`, and it changes nothing measurable. The gibberish query in 1.5 returns the same count 51 and 7 references with reranking bypassed.

### Test 5: measure BM25 precision across three field scopes

Build a third knowledge source scoped to the 13 `CONTENT_SEARCH_FIELDS`.

```
  KS-A  production      searchFields = 28 fields, body not among them
  KS-B  allfields       searchFields omitted                              (Test 3)
  KS-C  content-scoped  searchFields = 13 content fields                  (Test 5)
```

Run the same prompts across all three. This measures whether the structured entity columns are the cause of the noise described in 1.4.

### What not to test first

- **Attaching a model to the knowledge base.** Section 1.2 rules it out for retrieval breadth.
- **`maxOutputDocuments` below 50.** The service rejects any value outside 50 to 200 (1.7).
- **Longer search text.** Measured on project 1009338: `lessons learned` returns 1 reference carrying lessons prose out of 1. The full `semanticQuery` sentence returns 45 references carrying lessons prose in 2. Those 43 extra chunks consume the evidence token budget. It trades a recall problem for a noise problem.

---

## 3. Why the query planner sets `queryType` to `"full"`

### 3.1 Lucene boost syntax has no other parser

The generated string in the Microsoft example is `language:(ja\-JP)^2`. It uses two constructs the simple parser doesn't have:

| Construct | `'simple'` | `'full'` |
|---|---|---|
| `field:` fielded search | not supported | [supported](https://learn.microsoft.com/en-us/azure/search/query-lucene-syntax#fielded-search) |
| `^2` term boost | not supported | [supported](https://learn.microsoft.com/en-us/azure/search/query-lucene-syntax#term-boosting) |

The simple parser's whole operator set is `+ | - " ( ) *` ([Simple query syntax](https://learn.microsoft.com/en-us/azure/search/query-simple-syntax#boolean-operators)). Given `language:(ja\-JP)^2`, it would treat the colon and the caret as ordinary text and search for the literal words.

Microsoft states the rewrite directly:

> "A generated boost rewrites the query in full Lucene syntax while preserving the original terms."
> [Create a search index knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index#configure-query-hints-preview)

So `queryType: "full"` isn't a planner choice. It's forced by emitting a boost. No boost means no flip.

### 3.2 `semantic` isn't an alternative to `simple` or `full`

`simple` and `full` are parsers. `semantic` is a reranking stage. They sit on different layers.

```
  PARSER                    RETRIEVAL                RERANK
  queryType: simple ─┐
  queryType: full   ─┼──► keyword search ─┐
                     │                    ├──► RRF ──► L2 semantic rerank
  embedding ─────────┴──► vector search ──┘            queryType: "semantic"
```

For a knowledge source that layer is fixed:

> "For knowledge sources that target a search index, the implied query type is `semantic`, and there's no search mode."
> [Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)

That's why `intents[].type` accepts only `semantic`. Values `keyword`, `vector`, `hybrid`, `simple` and `full` each return HTTP 400 with "Valid types are: semantic".

The planner isn't picking `full` over `semantic`. Semantic reranking stays on. `full` describes the parser for the generated boost string, one layer down.

The same separation is what makes the `search.ismatch` workaround legal. `intents[].search` goes to the locked semantic path. The third argument of `search.ismatch` inside `filterAddOn` selects a parser for a different string. Two strings, two parsers, no interaction.

### 3.3 At `minimal` effort no planner runs

> "At `minimal` effort, this step is skipped and queries are issued directly to knowledge sources."
> [Agentic retrieval overview](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview#architecture-and-workflow)

Nothing rewrites the query. The `search_text` reaches the index unchanged. The only `queryType` under our control anywhere in this path is the third argument of `search.ismatch`.

---

## 4. The decomposer against the knowledge base query planner

They do overlapping jobs. At `minimal` effort the decomposer stands in for a planner that doesn't run.

```
                   chat_similarity decomposer    knowledge base query planner
  ─────────────────────────────────────────────────────────────────────────────
  input            user text                     user text plus chat history
  output           one structured intent:        N subqueries as plain search
                   filters, search_fields,       strings, plus at most one
                   search_text, topics, gates    OData filter and one Lucene boost
  grounding        ENUM_FIELD_VALUES             the fieldValues you pre-listed
  invalid value    demoted to search text        hint not applied, no fallback
  guarantee        deterministic                 best effort
  source picking   not applicable, one index     picks which knowledge sources to hit
  fan-out          1 search                      N searches, run in parallel
```

### 4.1 Where they duplicate: filter generation

`queryHints` filter hints would be a second copy of the filter logic in `sources.py` and `field_policy.py`, with a limit our data breaks. The limits are 5 filter hints on unique fields, 128 characters per value, 2,048 characters combined across all values in one hint ([Configure query hints](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index#configure-query-hints-preview)). `roles_work_lead` holds thousands of person names, so it can't be enumerated inside 2,048 characters. `project_solution` could be. The decomposer's guard demotes an invalid enum value to search text; a hint has no equivalent fallback.

### 4.2 Where they don't: subquery fan-out multiplies the 50-chunk limit

The 50-chunk limit applies per subquery, not per request:

> "Each subquery reranks up to 50 chunks."
> [Agentic retrieval overview, Estimate costs](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview#example-estimate-costs)

Measured: 4 distinct intents in one retrieve call returned 57 references, with per-intent counts of 4, 21, 50 and 13. One intent against one project stops at 50.

The decomposer emits one `search_text`. We can emit several `intents[]` instead, without any planner:

```json
"intents": [
  { "type": "semantic", "search": "lessons learned" },
  { "type": "semantic", "search": "what went well on this project" },
  { "type": "semantic", "search": "what went wrong, issues and challenges encountered" },
  { "type": "semantic", "search": "recommendations for future projects" },
  { "type": "semantic", "search": "key takeaways and drivers of success" }
]
```

That's five 50-chunk windows instead of one, and each one keeps its own precision. Compare that against one padded search string, which returned 45 references with 2 carrying lessons prose.

This is a partial mitigation, not a fix. Each window still passes through the semantic reranker and its threshold, which cut `lessons learned` from 50 candidates to 9 (1.7).

### 4.3 What blocks `queryHints` today

1. Best effort. "Hints are best effort, so the model might not generate a filter or boost for every request."
2. Dead at `minimal`. "Hints need model-driven query planning, so they aren't applied when the retrieval reasoning effort is `minimal`."
3. The deployment model is `gpt-4o`, and stored filter hints return HTTP 400. Validation reads the stored hints, not the override: "The service checks stored filters before applying `queryHintOverrides`, so an empty or boosts-only override doesn't bypass this validation. Stored `fieldValue` and `multiWordExpression` boosts alone don't trigger the validation." A boosts-only knowledge source works on `gpt-4o`, as long as it stores no filter hint.
4. Wrong layer. "Generated filters combine with `baseFilter` and `filterAddOn` by using `AND`." A generated filter can only narrow. A boost only moves rank order.

---

## 5. Search API parameters against the Retrieval API

### 5.1 Gone, no workaround

| Search API | What chat_similarity uses it for | Retrieval API |
|---|---|---|
| `facets` | `_facet_member_ids`, gate coverage, project membership | absent |
| `count` | exact totals, for example 47 SAP projects | absent |
| `orderby` | top N by spend, by date | absent |
| `skip` | pages past the first | absent |
| `top` | hard result cap | `maxOutputDocuments` exists but accepts only 50 to 200, so it can't set a cap below 50 (1.7) |
| `searchMode` | `all` against `any` on the main query | absent: "there's no search mode" |
| `queryType` at request level | `simple` or `full` on the main query | locked to implied `semantic` |
| `scoringProfile`, `scoringParameters` | field-weighted boosting | rejected: "Agentic retrieval doesn't accept `scoringProfile` or `scoringParameters` inputs." Retrieve doesn't apply the index's scoring profiles either ([Search index knowledge source, Limitations](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index)). For recency use [freshness-aware retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-configure-freshness) |
| `@search.rerankerBoostedScore` | boosted score readback | "Retrieve responses also don't surface `@search.rerankerBoostedScore`" |
| `highlight`, `highlightPreTag`, `highlightPostTag` | snippet highlighting | absent |
| `answers`, `captions` | extractive answers and captions | absent. `outputMode: answerSynthesis` replaces them and needs a model |
| `minimumCoverage` | partial-index tolerance | absent |
| `sessionId`, `scoringStatistics` | scoring consistency across replicas | absent |

### 5.2 Kept, renamed or moved

| Search API | Retrieval API | Note |
|---|---|---|
| `search` | `intents[].search` | accepts several, see 4.2 |
| `filter` | `baseFilter` on the knowledge source, `AND` `filterAddOn` per request | `filterAddOn` can only narrow |
| `select` | `sourceDataFields` on the knowledge source | fixed per source, not per request |
| `searchFields` | `searchFields` on the knowledge source | fixed per source, not per request. This is the constraint in 1.4 |
| `semanticConfiguration` | `semanticConfigurationName` on the knowledge source | optional since `2026-05-01-preview` |
| `queryType: "semantic"` | implied, always on | `resultsProcessing: "none"` turns off the rerank, not the semantic first pass |
| L2 threshold | `rerankerThreshold` in `knowledgeSourceParams` | moves the result: 9 references at the default, 13 at 0 (1.7). HTTP 400 if combined with `resultsProcessing: "none"` |
| `vectorQueries` | none. The engine builds it through the index vectorizer | no precomputed vector accepted, see 1.5 |
| `semanticQuery` as a separate rerank string | none. `intents[].search` does both jobs | the Search API payload reranks against the full question while searching on `lessons learned`. The Retrieval API can't split those |

### 5.3 Rebuildable through `filterAddOn`

| Search API | Rebuilt as |
|---|---|
| `searchFields` scoping, per request | `search.ismatch(q, 'f1,f2')`, argument 2 |
| `queryType: 'full'` for fuzzy, proximity, regex, infix wildcard | `search.ismatch(q, 'f1', 'full', ...)`, argument 3 |
| `searchMode: 'all'` | `search.ismatch(q, 'f1', '...', 'all')`, argument 4 |
| score contribution from the above | `search.ismatchscoring(...)` in place of `search.ismatch(...)` |

`search.ismatch` decides which documents qualify and adds nothing to rank. `search.ismatchscoring` feeds the score. Since the Retrieval API removes `scoringProfile`, `orderby` and the separate `semanticQuery`, `search.ismatchscoring` is the only rank lever left.

### 5.4 Retrieval API only, no Search API equivalent

`retrievalReasoningEffort` (needs a model above `minimal`), multi-source fan-out and source selection, `retrievalInstructions`, `answerInstructions`, `outputMode: answerSynthesis`, `maxOutputSizeInTokens` (named `maxOutputSize` from 2026-05-01-preview on, per [Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)), `includeActivity`, `alwaysQuerySource`, `neverQuerySource`, `failOnError`, `queryHints`, `queryHintOverrides`, `resultsProcessing`, citation URLs, `x-ms-query-source-authorization` for query-time permission filtering, `retrieveDefaults`, `corsOptions`.

Of these, multi-intent fan-out is the only one that moves a failing prompt, and the decomposer can drive it without the rest.

---

## 6. Test prompts for the `queryType` comparison

### 6.1 The eight-project prompt can't test this

The prompt "Extract all lessons learned for these eight project IDs: 1009338, 1009392, 1010069, 1011517, 1011718, 1011742, 1012268, 1012329" produces `scope=named`, `search_fields=[]`, `explicit_gates=None`. The filter is a `project_id` equality. No text reaches a parser, so `simple` against `full` and `any` against `all` can't differ. It measures the evidence fetch, not query parsing.

### 6.2 What changes between the parsers

```
                      'simple'   'full'    no filterAddOn, intents[].search only
  multi-word AND      yes, '+'   yes, AND  no hard requirement, semantic ranking
  prefix  lux*        yes        yes       no
  infix   non*al      no         yes       no
  suffix  /.*eer/     no         yes       no
  fuzzy   Fronteer~1  no         yes       semantic can recover some cases
  proximity "a b"~5   no         yes       no
  fielded f:term      no         yes       no
  boost   term^2      no         yes       no
  NOT     -term       yes        yes       no
```

Sources: [Simple query syntax](https://learn.microsoft.com/en-us/azure/search/query-simple-syntax), [Lucene query syntax](https://learn.microsoft.com/en-us/azure/search/query-lucene-syntax).

### 6.3 Nine candidate prompts

P0 is the control. Each row names the construct it forces and the reason it earns a slot.

| # | Prompt | Construct | Arms that must differ | Reason |
|---|---|---|---|---|
| **P0** | "List the lessons learned for project 1009338." | none, `project_id` equality only | none | Control. Variance here means the measurement setup is unreliable, so read P1 through P8 only after P0 comes out flat. |
| **P1** | "Which projects used Amazon Web Services as a vendor?" | multi-word entity, all words required | `simple/all` against `simple/any` against no filter | Three words, and `any` matches every project containing "Services". `search.ismatch('Amazon Web Services','vendors','simple','all')` already measured 50 documents. The `any` and no-filter numbers are missing. |
| **P2** | "What lessons came from the Fronteer upgrade?" with the misspelling kept | fuzzy | `full/any` with `Fronteer~1` against `simple` against no filter | `search.ismatch('Fronteer~1','title','full','any')` measured 15 documents where the unfiltered query returned 0. It's also the one case where `intents[].search` alone can recover the term through semantic matching, so it tells us whether fuzzy buys anything. |
| **P3** | "Show projects where Yusoff was sponsor or work lead." | field scoping, two fields, one term | `search.ismatch('Yusoff','roles_project_sponsor,roles_work_lead')` against no filter | Isolates argument 2 with arguments 3 and 4 left at their defaults. The filtered arm measured 9 documents. The no-filter baseline is missing, and without the filter "Yusoff" matches across all 28 fields in the production `searchFields` list. |
| **P4** | "Find projects about decommissioning legacy infrastructure." | concept with no exact term to match | no filter against any `search.ismatch` arm | Negative control. If `intents[].search` alone wins here and every `search.ismatch` arm only narrows, we learn when to leave the filter off, which we need as much as when to add it. |
| **P5** | "Which projects mention schedule and delay close together in the closeout narrative?" | proximity | `full` with `"schedule delay"~10` against `simple` against no filter | Proximity has no simple-syntax equivalent. `simple` either matches the exact phrase or splits it into two OR'd terms, so the two arms measure different document sets. |
| **P6** | "Find projects in the decommission family: decommission, decommissioning, decommissioned." | prefix against infix | `simple` with `decommission*` against `full` with `/decommission.*/` against no filter | Tests whether `en.microsoft` lemmatization already covers the variants. If it does, prefix search adds nothing and we drop a workaround. Wildcard terms skip lexical analysis, so `Decommission*` misses the lowercase token `decommission`. |
| **P7** | "Which SAP projects had lessons learned but were not Hardware Deploy?" | negation | `simple/all` with `SAP -Hardware` against `full` with `SAP NOT Hardware` against no filter | `simple` with `any` expands `SAP -Hardware` to `SAP OR -Hardware OR *` and returns the whole index. This is the prompt where we want to see that happen on purpose. |
| **P8** | "Give me lessons learned from closed projects in the Kinaxis portfolio." | phrase boost | `search.ismatchscoring('"lessons learned"^3','body,title','full','any')` against `search.ismatch` with the same arguments against no filter | The only arm that measures rank order. Every other row measures which documents qualify. This one measures whether `search.ismatchscoring` moves lessons-bearing chunks up inside the 50-chunk window. |

Minimum set if you run four: P0, P1, P3, P8. Control, a three-word entity where `any` and `all` must diverge, field scoping in isolation, and the only rank lever.

### 6.4 Arms

Hold the filter scope and `maxOutputDocuments` fixed. Vary only the `search.ismatch` call.

```
  ARM 0   no filterAddOn past the scope equality
  ARM 1   search.ismatch(q, 'fields')                        defaults: simple, any
  ARM 2   search.ismatch(q, 'fields', 'simple', 'all')
  ARM 3   search.ismatch(q, 'fields', 'full',   'any')
  ARM 4   search.ismatch(q, 'fields', 'full',   'all')
  ARM 5   search.ismatchscoring(q, 'fields', 'full', 'any')  rank, not qualification
  ARM 6   ARM 0 plus several intents[]                       the fan-out in 4.2
  ARM 7   every arm above against KS-B from Test 3           body in the keyword lane
```

Record per arm: reference count, `source_retrieved`, which golden project ids came back, how many returned chunks carry the target content, and `elapsedMs`. The fourth column decides the result. 45 references with 2 useful is worse than 1 reference with 1 useful.

Run ARM 7 last. If several arms collapse to the same numbers on KS-B, `search.ismatch` was compensating for the missing `body` field rather than adding capability.

---

## 7. `resultsProcessing: "none"`

Measured: search `*`, `resultsProcessing: "none"`, `maxOutputDocuments` 200, on project 1012173 returned 50 references and 50 `source_retrieved`. Identical to every other wildcard arm.

It acts on the rerank stage in the 1.7 diagram. It doesn't touch the retrieval stage or the reference cap below the rerank, so on `lessons learned` `count` rises to the full candidate set while references stay at 9.

What it does:

> "References from the knowledge source omit `rerankerScore`, and results keep their underlying order within the source's retrieval activity. When any source bypasses reranking, Azure AI Search distributes final results across activities in round-robin order, following knowledge source declaration order. Reranked activities stay ordered by score."
> [Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)

Three consequences:

- References carry no `rerankerScore`. Any score-based cut downstream goes blind.
- "If the resolved value is `none` and the request includes `rerankerThreshold`, Search returns `400 Bad Request`." The evidence fetch sends `rerankerThreshold: 1.0` today, so sending both is a hard 400.
- Resolution order is `knowledgeSourceParams`, then the value stored on the knowledge source, then `rerank`.

Round-robin distribution across activities forces even coverage across several intents instead of letting one high-scoring intent take every output slot. Paired with ARM 6 on the eight-project prompt, round-robin across eight per-project intents gives one bucket per project. It doesn't count and it doesn't group, so it isn't a facet. It distributes.

---

## 8. REST against MCP

### 8.1 Documented

Same knowledge base, two front doors. The MCP endpoint wraps the same retrieve action.

| | REST and SDK `retrieve` | MCP endpoint |
|---|---|---|
| Endpoint | `POST {service}/knowledgebases/{kb}/retrieve?api-version=…` | `{service}/knowledgebases/{kb}/mcp?api-version=…` |
| Shape | one HTTP POST with a JSON body you control | MCP server exposing the `knowledge_base_retrieve` tool |
| Caller | our code | any MCP client, for example Foundry Agent Service, GitHub Copilot, Claude, Cursor |
| Response | documented `response`, `references`, `activity` | "The MCP tool result currently differs from the REST and SDK response shape." |
| Auth | `api-key` header or Entra bearer token | Entra bearer token, audience `https://search.azure.com/`. Foundry connects with `authType: ProjectManagedIdentity`, `category: RemoteTool` |
| Per-user access control | `x-ms-query-source-authorization` on the request | same header on the MCP tool connection, or per request through a structured input |

Sources: [Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve), [Tutorial: Build an agentic retrieval solution](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-pipeline).

The endpoint is built as:

```python
mcp_endpoint = f"{endpoint.rstrip('/')}/knowledgebases/{base_name}/mcp?api-version=2026-08-01-preview"
```

and bound with `allowed_tools=["knowledge_base_retrieve"]`.

### 8.2 The input schema isn't published

Microsoft Learn doesn't document the `knowledge_base_retrieve` input schema. That matters because the `search.ismatch` workaround lives in `filterAddOn`, which is a `knowledgeSourceParams` field. If the MCP tool doesn't expose `knowledgeSourceParams`, the MCP path can't carry the workaround.

MCP servers advertise their own schema. Get it directly:

```http
POST {{search-endpoint}}/knowledgebases/{{kb}}/mcp?api-version=2026-08-01-preview
Content-Type: application/json
Accept: application/json, text/event-stream
Authorization: Bearer {{token-for-https://search.azure.com/}}

{ "jsonrpc": "2.0", "id": 1, "method": "tools/list" }
```

Read `inputSchema` in the response. Look for `knowledgeSourceParams` and `filterAddOn` inside it, plus `retrievalReasoningEffort`, `includeActivity` and `maxOutputSize`. Send `initialize` first if the server requires a handshake.

---

## 9. `filterAddOn` and `search.ismatch`

### 9.1 What `filterAddOn` is

An OData filter expression, combined with the knowledge source's stored `baseFilter`:

```
effective filter = baseFilter AND filterAddOn
```

> "Because the filters are combined with `AND`, `filterAddOn` can only narrow the persisted base filter. It can't replace or broaden it."
> [Create a search index knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index#persist-a-base-filter-on-a-knowledge-source-preview)

A filter generated from a query hint combines on top of both with `AND`.

It's an OData filter, so it takes the whole filter language: `eq`, `ne`, `gt`, `ge`, `lt`, `le`, `and`, `or`, `not`, `search.in()`, collection lambdas `any()` and `all()`, geo functions, plus the two full-text functions below.

### 9.2 Grammar

```
search_is_match_call ::=
    'search.ismatch'('scoring')?'(' search_is_match_parameters ')'

search_is_match_parameters ::=
    string_literal(',' string_literal(',' query_type ',' search_mode)?)?

query_type  ::= "'full'" | "'simple'"
search_mode ::= "'any'" | "'all'"
```
[OData full-text search functions](https://learn.microsoft.com/en-us/azure/search/search-query-odata-full-text-search-functions#syntax)

Three overloads only:

```
search.ismatch(search)
search.ismatch(search, searchFields)
search.ismatch(search, searchFields, queryType, searchMode)
```

Three arguments is a syntax error. `queryType` and `searchMode` arrive as a pair or not at all.

The function returns `Edm.Boolean`, so it composes with `and`, `or` and `not` like any other predicate.

### 9.3 Argument 1: `search`, type `Edm.String`, required

The query string, in whichever syntax argument 3 declares.

| Syntax | Operators |
|---|---|
| `'simple'`, the default | `+` AND, `\|` OR, `-` NOT, `"…"` phrase, `(…)` grouping, `*` prefix only |
| `'full'` | all of the above, plus `AND`, `OR`, `NOT` as words, `field:term` fielded search, `term~n` fuzzy, `"a b"~n` proximity, `term^n` boost, `/regex/`, infix and suffix wildcards |

Escaping rules:

- Inside an OData string literal, double a single quote: `O''Brien`.
- Simple-syntax operators needing a backslash: `+ | " ( ) ' \`
- Full-syntax operators needing a backslash: `+ - & | ! ( ) { } [ ] ^ " ~ * ? : \ /`
- In a JSON request body, escape interior double quotes again:

```json
"filterAddOn": "search.ismatch('\"schedule delay\"~10', 'body', 'full', 'any')"
```

Behaviors that produce wrong results silently:

- Fuzzy applies to single terms, not phrases. `"lessons learned"~1` is a proximity search. For fuzzy, write `lessons~ learned~`.
- Edit distance maxes at 2. Expansion caps at 50 terms.
- Wildcard, prefix, regex and fuzzy terms skip lexical analysis and match literal index tokens. Most analyzers lowercase, so `Fronteer*` misses `fronteer`. Lowercase these terms in the pipeline.
- Full syntax rejects a lone negation. `-luxury` alone and `-luxury *` are both errors. Simple syntax expands `-luxury` to `-luxury *` instead.
- `|` isn't supported for OR in full syntax. Use `OR`.

### 9.4 Argument 2: `searchFields`, type `Edm.String`, optional

> "Comma-separated list of searchable fields to search in; defaults to all searchable fields in the index. When you use fielded search in the `search` parameter, the field specifiers in the Lucene query override any fields specified in this parameter."

One string, commas inside it, no spaces after the commas:

```
'roles_project_sponsor,roles_work_lead'
```

Every field named must be `searchable: true`. This is the per-request replacement for the Search API `searchFields` parameter. It's the only field-scoping lever the Retrieval API gives us, because the knowledge source `searchFields` is fixed at create time.

Fielded search in argument 1 beats this argument. So:

```
search.ismatch('gate_label:Closeout lessons', 'body,title', 'full', 'any')
```

looks for `Closeout` only in `gate_label`, and `lessons` in `body` and `title`.

### 9.5 Argument 3: `queryType`, `'simple'` or `'full'`, default `'simple'`

Which parser reads argument 1. Operators per parser are in 9.3.

It's independent of the request-level query type, which for a knowledge source is locked to implied `semantic`. Section 3.2 covers why the two never interact.

### 9.6 Argument 4: `searchMode`, `'any'` or `'all'`, default `'any'`

> "Indicates whether any or all of the search terms in the `search` parameter must be matched in order to count the document as a match. When you use the Lucene Boolean operators in the `search` parameter, they take precedence over this parameter."

`'any'` ORs the terms and favors recall. `'all'` ANDs the terms and favors precision.

`'Amazon Web Services'` with `'any'` matches any project containing the word "Services". With `'all'`, all three words must appear. That's why the measured probe used `'all'`, and why P1 in 6.3 runs `'any'` to quantify what `'all'` saves.

The `searchMode` and NOT interaction:

| `queryType` | `searchMode` | `wifi -luxury` expands to | Result |
|---|---|---|---|
| simple | any | `wifi OR -luxury OR *` | the entire index |
| simple | all | `wifi AND -luxury AND *` | has wifi, lacks luxury |
| full | any | negation always ANDed | has wifi, lacks luxury |
| full | all | negation always ANDed | has wifi, lacks luxury |

[Lucene query syntax, NOT Boolean operator](https://learn.microsoft.com/en-us/azure/search/query-lucene-syntax#not-boolean-operator)

If the decomposer ever emits a `-term`, `'simple'` with `'any'` returns everything. Never pair them.

### 9.7 `search.ismatchscoring`

Identical overloads and identical parameters. One difference:

> "The relevance score of documents matching the `search.ismatchscoring` query contributes to the overall document score, whereas for `search.ismatch`, the document score doesn't change."

Both can appear in the same filter expression. Documents that qualify only through a non-scoring clause come back with `@search.score` of 0.

### 9.8 Limits

- No lambdas. `vendors/any(v: search.ismatch(...))` is rejected. Top level only. On a collection field you can filter on the collection or full-text search it, but you can't correlate the two on the same element. [Troubleshooting collection filters](https://learn.microsoft.com/en-us/azure/search/search-query-troubleshoot-collection-filters)
- Search API only. Not supported in Suggest or Autocomplete. `filterAddOn` is a Search API filter, so it's in scope.
- Query size: search clause at most 100,000 characters, at most 1,024 clauses, prefix terms at most 1,000 characters, about 32 KB per individual term.

### 9.9 Worked examples, one argument isolated per example

```odata
-- 1 argument, defaults to simple and any
search.ismatch('lessons learned')

-- 2 arguments, field scoping
search.ismatch('Yusoff', 'roles_project_sponsor,roles_work_lead')

-- 4 arguments, all words required, simple parser
search.ismatch('Amazon Web Services', 'vendors', 'simple', 'all')

-- fuzzy, needs full
search.ismatch('Fronteer~1', 'title', 'full', 'any')

-- proximity, needs full
search.ismatch('"schedule delay"~10', 'body', 'full', 'any')

-- fielded search plus boost, scoring variant so the boost reaches the score
search.ismatchscoring('body:("lessons learned")^3 OR title:closeout', '', 'full', 'any')

-- composed with ordinary OData, the shape the evidence fetch needs
search.ismatch('Yusoff', 'roles_work_lead', 'simple', 'all')
  and gate_label eq 'Closeout'
  and project_id eq '1009338'

-- negation, safe pairing only
search.ismatch('SAP -Hardware', 'vendors,project_solution', 'simple', 'all')

-- two functions in one expression: qualify on one clause, rank on the other
search.ismatch('Closeout', 'gate_label')
  and search.ismatchscoring('lessons learned takeaways', 'body,title', 'full', 'any')
```

---

## 10. Decision records

### ADR 1: Don't attach a model to the knowledge base to widen retrieval

**Decision.** Keep `models` empty and `retrievalReasoningEffort: minimal` while we diagnose the reranker cut and the reference cap in 1.7.

**Why.** Microsoft defines `minimal` as issuing text and vector searches, their tutorial calls a model-free `minimal` knowledge base hybrid, and the gibberish test in 1.5 shows the vector leg running with no model attached. Attaching one adds Azure OpenAI token cost and an extra latency stage, and it changes two variables at once while we isolate one.

**Revisit when.** The cause of the reference cap in 1.7 is measured, or we want `outputMode: answerSynthesis` or `retrievalReasoningEffort` above `minimal`.

### ADR 2: Test with a sibling knowledge source, never by editing the production one

**Decision.** Create `ps-ks-allfields` and `ps-kb-allfields` alongside the production objects.

**Why.** `searchFields` is fixed on the knowledge source, so testing it means changing the object the DEV pipeline queries. A sibling keeps DEV working and gives us an A/B pair against identical index content. A knowledge source is a top-level object with no per-index limit, so the cost is one extra object.

**Revisit when.** A sibling wins, and we promote its config onto the production knowledge source.

### ADR 3: Don't add `queryHints`

**Decision.** Keep filter generation in the decomposer. Don't store `queryHints` on the knowledge source.

**Why.** Filter hints need the exhaustive allowed-value list inside 2,048 characters, and `roles_work_lead` holds thousands of person names. Hints are best effort with no fallback, while the decomposer guard demotes an invalid enum value to search text. Hints don't run at `minimal` effort at all, and stored filter hints return HTTP 400 on the `gpt-4o` deployment.

**Revisit when.** We move off `gpt-4o` and above `minimal` effort, and we want a `multiWordExpression` boost for domain phrases such as "lessons learned" and "closeout report". That hint kind duplicates nothing we own, and boosts alone don't trigger the `gpt-4o` validation.

### ADR 4: Call the Retrieval API over REST, not MCP

**Decision.** Keep the pipeline on `POST /knowledgebases/{kb}/retrieve`.

**Why.** The `search.ismatch` workaround lives in `filterAddOn` under `knowledgeSourceParams`, and Microsoft doesn't publish the `knowledge_base_retrieve` input schema, so we can't confirm MCP carries it. Microsoft also states the MCP tool result differs from the REST response shape, and the `KB_TRACE` instrumentation reads `activity` in the REST shape. MCP exists so third-party agent runtimes can call a knowledge base without a client, and we already have a client.

**Revisit when.** The `tools/list` call in 8.2 shows `filterAddOn` in the input schema, and a Foundry-hosted agent needs to call the knowledge base directly.

---

## Sources

- [Query a knowledge base via API or MCP](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)
- [Create a search index knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index)
- [What is a knowledge source?](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-overview)
- [Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index)
- [Create a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-knowledge-base)
- [Set the retrieval reasoning effort](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-set-retrieval-reasoning-effort)
- [Agentic retrieval overview](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview)
- [Tutorial: Build an agentic retrieval solution](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-pipeline)
- [OData full-text search functions](https://learn.microsoft.com/en-us/azure/search/search-query-odata-full-text-search-functions)
- [Lucene query syntax](https://learn.microsoft.com/en-us/azure/search/query-lucene-syntax)
- [Simple query syntax](https://learn.microsoft.com/en-us/azure/search/query-simple-syntax)
- [Configure a vectorizer](https://learn.microsoft.com/en-us/azure/search/vector-search-how-to-configure-vectorizer)
- [Troubleshooting collection filters](https://learn.microsoft.com/en-us/azure/search/search-query-troubleshoot-collection-filters)
