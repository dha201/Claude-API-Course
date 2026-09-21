# Ground truth

What is true now about the Azure AI Search Retrieval API for Project Similarity. Each claim carries its headline number and links the finding that measured it; each statement about Microsoft behavior links the Microsoft page. Full result tables are in [evidence.md](evidence.md). Service `workdeliverygpt-dev-srch`, index `project_similarity_index`, Retrieval API version `2026-08-01-preview`. Microsoft quotes checked on the current page on 2026-09-18.

## Question and status

Can the Azure AI Search Retrieval API (a knowledge base over a knowledge source, at `minimal` reasoning effort) replace every Search API call in `chat_similarity`? The goal is a full migration with no Search API calls left ([ADR 7](decisions.md#adr-7)).

Across 16 user prompts graded answer by answer, the Retrieval API path was worse on 12, gave the same answer on 2, both paths declined 1, and 1 was mixed ([F23](evidence.md#f23)). The failures fall into three groups:

| Failure | What happens | Status |
|---|---|---|
| Evidence fetch | The production setup returns 1 reference for `lessons learned` on a project whose 601 Closeout chunks give the Search API 50 results | Solved by configuration: parity with the Search API on all eight test projects ([F16](evidence.md#f16)). Not yet applied in `chat_similarity` ([O2](runbook.md#o2)) |
| Gate list | The retrieve request has no `facets`, so `gates_present` comes back empty. A project with no record row then resolves to state Unknown and gets no evidence call. This hit project 1012329 in the eight-project run ([F17](evidence.md#f17)) | Design: gate coverage stamped at ingest ([search-api-parity.md](search-api-parity.md#gate-coverage), [O6](runbook.md#o6)) |
| Count and sort | The retrieve request has no `count` and no `orderby`. "How many SAP projects are there in total?" gets 47 on the Search API and no total on the Retrieval API. "Top 10 Hardware Deploy by spend" can't be ordered by spend ([F23](evidence.md#f23)) | Design: enumerate the matching projects and count and sort in code ([search-api-parity.md](search-api-parity.md#complete-project-enumeration), [O10](runbook.md#o10)) |

The last two are gaps in the retrieve contract: it has no `facets`, `count` or `orderby`. Both routes are untested. Every Search API capability `chat_similarity` uses, and its Retrieval API route, is mapped in [search-api-parity.md](search-api-parity.md): 3 proven, 2 syntax only, 9 design, 1 with no route.

Project 1009338, filter `project_id eq '1009338' and gate_label eq 'Closeout'` (601 chunks), query `lessons learned`:

```
  Search API, hybrid + semantic ranker, top 50                    50 results      F14
  Retrieval API, production knowledge source                       1 reference    F7
  Retrieval API, searchFields removed                              9 references   F7
  Retrieval API, searchFields removed, reranking bypassed,        50 references   F12, F15
    maxOutputSize 200,000                                          (the same 50 chunks as the Search API)
```

Next step: apply [Configuration that works](#configuration-that-works) to `chat_similarity`, then rerun the eight-project prompt and the 16-prompt evaluation ([O2](runbook.md#o2)).

## Current facts

Each line is one measured fact with its headline number. The finding holds the full table, the setup and the date.

**Service, index and request surface**

- The index vectorizer `ps_text_3_small` reaches `text-embedding-3-small` through an internal proxy with key auth ([F1](evidence.md#f1)).
- The vectorizer matches the model that built the index: relevant text scores 0.63 to 0.65, irrelevant text 0.06 to 0.08 ([F2](evidence.md#f2)).
- The service runs `knowledgeRetrieval` standard, and the index has one vector field, `content_vector`, 1536 dimensions, `searchable`, with the vectorizer assigned ([F3](evidence.md#f3)).
- The production knowledge base queries all three of its knowledge sources on every retrieve. `knowledgeSourceParams` configures a source; it doesn't select one ([F4](evidence.md#f4)).
- At `minimal` effort the request takes `intents` only, with `type: semantic` only. `low`, `medium` and `answerSynthesis` need a model ([F5](evidence.md#f5)).
- `maxOutputDocuments` accepts only 50 to 200 ([F6](evidence.md#f6)).

**The retrieve pipeline**

- The Retrieval API runs the vector query. With reranking bypassed, a token in no document finds 51 candidates, all among the Search API's own vector neighbours ([F8](evidence.md#f8)).
- An explicit `searchFields` list without `content_vector` turns the vector query off. The production knowledge source finds 0 candidates for that token and 1 result for `lessons learned` ([F9](evidence.md#f9)).
- A list that names `content_vector` keeps the vector query on: 50 of 50 ([F10](evidence.md#f10)).
- Default reranking keeps 9 of 50 candidates on project 1009338; `rerankerThreshold` 0 keeps 13 ([F11](evidence.md#f11)).
- The default output token budget caps references at 9. `maxOutputSize` 50,000 gives 38 and 200,000 gives 50 ([F12](evidence.md#f12)).
- With reranking bypassed, candidates follow `maxOutputDocuments`: 200 at 200, which the 200,000 budget then cuts to 143 to 159 ([F13](evidence.md#f13)).

**Parity with the Search API**

- On project 1009338 the Search API finds 1 result with BM25 alone and 50 with hybrid search, 2 of which mention "lesson" ([F14](evidence.md#f14)).
- With the [configuration that works](#configuration-that-works), the knowledge base returns the same 50 chunks, 50 of 50 matched on `psr_row_id` ([F15](evidence.md#f15)).
- On all eight test projects it matches the Search API's result count and "lesson" count ([F16](evidence.md#f16)).
- Default reranking returns 4 to 25 references on those projects and drops a "lesson" chunk on 1009392 and 1012268 ([F16](evidence.md#f16)).

**Runs through the deployed pipeline, vector query off at the time**

- The eight-project prompt returned 10 references from 4,259 Closeout chunks. Project 1012329 got no evidence call, because the lost gate list left it in state Unknown ([F17](evidence.md#f17)).
- Across 16 graded prompts the Retrieval API was worse on 12, the same on 2, both declined 1, and 1 was mixed ([F23](evidence.md#f23)).
- `search.ismatch` in `filterAddOn` parses and filters: `'Fronteer~1'` with `'full'` matched 15 documents where no filter matched 0 ([F21](evidence.md#f21)).
- Four `intents[]` in one request returned 57 references ([F22](evidence.md#f22)).

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
| `searchFields` | knowledge source | 1 | Fields the query runs against, for both lanes. An explicit list without `content_vector` turns the vector query off | 1 against 50 ([F9](evidence.md#f9)); a list with `content_vector` keeps it on ([F10](evidence.md#f10)) |
| vectorizer, vector field | index | 1, vector | Embeds the query text. The field must be `searchable` with a profile naming a vectorizer | works through the proxy ([F8](evidence.md#f8)) |
| `filterAddOn`, `baseFilter` | request, knowledge source | before 1 | Yes or no eligibility, applied to both lanes | vector neighbours respect the filter ([F8](evidence.md#f8)) |
| `resultsProcessing` | request or knowledge source | 2 | `rerank` (default) or `none` (skip the reranker) | 9 to 50 references ([F12](evidence.md#f12)) |
| `rerankerThreshold` | request | 2 | Minimum reranker score. HTTP 400 with `none` | 9 to 13 references ([F11](evidence.md#f11)) |
| `semanticConfigurationName` | knowledge source | 2 | Fields the reranker reads | a blank index default still resolves ([F3](evidence.md#f3)) |
| `maxOutputDocuments` | request and source | 1 and 3 | Candidate count under `none`, and the reference cap. 50 to 200 only | 200 candidates at 200 ([F13](evidence.md#f13)) |
| `maxOutputSize` | request | 3 | Token budget for references | 9 to 50 references ([F12](evidence.md#f12)) |

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

Two points about lists that name `content_vector` are unproven: that the keyword lane stays limited to the listed text fields (vector results fill all 50 either way), and that the service stores the list exactly as sent ([O5](runbook.md#o5)).

## Configuration that works

These settings gave parity with the Search API on all eight projects ([F16](evidence.md#f16)) and the same 50 chunks on 1009338 ([F15](evidence.md#f15)):

- **Knowledge source.** Remove `searchFields` (the Retrieval API then searches every searchable field, `content_vector` included). A narrow list that names `content_vector` also keeps the vector query on ([F10](evidence.md#f10)), with two unproven points ([O5](runbook.md#o5)).
- **Retrieve request, the `knowledgeSourceParams` entry for the search index.** `resultsProcessing: "none"` and `maxOutputDocuments` 50.
- **Retrieve request, top level.** `maxOutputDocuments` 50 and `maxOutputSize` 200,000.
- **Not sent.** `rerankerThreshold`, which returns HTTP 400 together with `none`.

Trade-offs:

- **Precision.** Default reranking returns 4 to 25 references and drops a lesson chunk on 2 of 8 projects. `none` returns 50 per project and loses none ([F16](evidence.md#f16)). On 1009338 the 9 reranked references and the 50 unreranked ones hold the same 2 lesson chunks ([F11](evidence.md#f11), [F12](evidence.md#f12)), so `none` sends 41 more chunks for no extra lesson chunk there. How many of the 50 carry lessons prose without the word "lesson" is unmeasured ([O4](runbook.md#o4)).
- **Tokens.** Fifty references per project cost more tokens in the answer step than 4 to 25. The size is unmeasured ([O4](runbook.md#o4)).
- **Latency.** Activity `elapsedMs` under `none` ranged from 447 to 1,135 ms per retrieve ([A26](commands.md#a26), [A28](commands.md#a28), [A35](commands.md#a35)). Reranked rows report 0, a reporting quirk ([F8](evidence.md#f8)), so the two modes can't be compared from `elapsedMs`. Wall-clock time against the 30-second target is unmeasured ([O4](runbook.md#o4)).
- **Scores.** References under `none` carry no `rerankerScore`, so any code that sorts or filters on it must change ([ranking signal](search-api-parity.md#ranking-signal)).
- **`maxOutputDocuments` 200.** Returns 143 to 159 references at the 200,000 budget ([F13](evidence.md#f13)). Nothing measured needs it.
- **Gate list.** 1012329 still gets no evidence call until the gate-list failure is fixed ([F17](evidence.md#f17), [O6](runbook.md#o6)).
