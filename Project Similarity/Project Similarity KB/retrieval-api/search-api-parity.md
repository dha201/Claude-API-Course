# Search API parity

Every Search API capability `chat_similarity` uses, where it sits in the retrieval pipeline, and its route on the Retrieval API. The goal is a full migration: every call goes through the knowledge base retrieve request, and no Search API call remains ([ADR 7](decisions.md#adr-7)). Call sites follow [Project similarity retrieval diagram.md](../../Project%20similarity%20retrieval%20diagram.md).

## Status legend

| Status | Meaning |
|---|---|
| Proven | A measurement on our service shows the Retrieval API route gives the Search API result |
| Syntax only | The service accepts the route; whether it gives the same answer is untested |
| Design | A route exists on paper; nothing has run it |
| No route | No Retrieval API parameter and no candidate route yet. An opinion until tested |

```
  Proven       ███          3
  Syntax only  ██           2
  Design       █████████    9
  No route     █            1
```

## Parity map

| Call site | Search API feature used | Retrieval API route | Status | Evidence, next step |
|---|---|---|---|---|
| **find_projects** Lane 1, `_hybrid_discovery` | `search` plus a precomputed vector (`vectorQueries`, `k` 50) plus `filter`, run twice in parallel (precision with the tag, recall without), merged by score | Two retrieve calls, one per filter. The service embeds `intents[].search` with the index vectorizer ([F8](evidence.md#f8)). Merge in code | Design | Hybrid retrieval with a filter is proven on the evidence fetch ([F16](evidence.md#f16)), not on discovery. [O2](runbook.md#o2) |
| Lane 1, rerank | semantic ranker scoring a separate `semanticQuery` (the full question) | none: `intents[].search` is both the search string and the rerank string. With `resultsProcessing: "none"` nothing reranks | No route | Changes order, not the retrieved set. Parity was measured on sets ([F15](evidence.md#f15)) |
| Lane 1, intent `search_fields` | per-request `searchFields` scoping BM25 | `search.ismatch` argument 2 in `filterAddOn`. It filters; it doesn't scope ranking | Syntax only | [F21](evidence.md#f21), [O9](runbook.md#o9) |
| Lane 1, misspelled title | the Search API resolves "Fronteer" to project 1007814 ([F23](evidence.md#f23) row 13) | the vector query, or `search.ismatch('Fronteer~1','title','full','any')` | Syntax only | The filter matched 15 documents where no filter matched 0, with the vector query off ([F21](evidence.md#f21)). [O9](runbook.md#o9) |
| Lane 2, `_facet_member_ids` | `facets` on `project_id`, `searchMode all`, `queryType simple`, `top 0` | All-words and field scope through `search.ismatch`; the complete project list through [enumeration](#complete-project-enumeration) | Design | [O10](runbook.md#o10) |
| Lane 3, `_sorted_project_ids_by_field` | facets the distinct project set, reads each project's field value, sorts in code | The same [enumeration](#complete-project-enumeration), then sort on the value from `sourceData` in code. It doesn't need `orderby` | Design | [O10](runbook.md#o10) |
| Lane 4, `_facet_confirm_filter` | facet total, stamped as `facet_total_count` | Count the distinct `project_id` values from the [enumeration](#complete-project-enumeration) | Design | [O10](runbook.md#o10) |
| **profile_projects**, PSR sample | `top 1` plus a `gate_label` facet for `gates_present` | Gate coverage stamped onto every chunk at ingest, read from any one chunk ([gate coverage](#gate-coverage)) | Design | Needs an index change. [O6](runbook.md#o6) |
| profile_projects, record read | `top 2`, filter on the record rows | Retrieve with the same filter; it returns up to 50, trim in code | Proven | Record rows came back for 7 of 8 projects; 1012329 has none ([F17](evidence.md#f17)) |
| **fetch_evidence**, `_fetch_document_rank` | hybrid plus semantic ranker with `semanticQuery`, 13 content `searchFields`, `top` 50, per-gate filter, one query per named project | `searchFields` removed, `resultsProcessing: "none"`, `maxOutputDocuments` 50, `maxOutputSize` 200,000, one retrieve per project ([configuration](ground-truth.md#configuration-that-works)) | Proven | Same 50 chunks on 1009338 ([F15](evidence.md#f15)); same counts on 8 projects ([F16](evidence.md#f16)). [O2](runbook.md#o2), [O3](runbook.md#o3) |
| **rank_projects**, score, order and elicit gate | `@search.rerankerScore` to order projects; the top score against 1.5 to decide whether to ask the user to narrow | `rerankerScore` is absent under `resultsProcessing: "none"` ([ranking signal](#ranking-signal)) | Design | [O6](runbook.md#o6) |
| **determine_reply**, authoritative count | `facet_counts` | Lane 4's count | Design | [O10](runbook.md#o10) |
| **Cross-cutting**, access control | per-source ACL filter columns on every query | The same columns in `filterAddOn` or `baseFilter`; `x-ms-query-source-authorization` per request | Design | Named projects passed 9 of 9 checks ([F17](evidence.md#f17)); open scope untested |
| Cross-cutting, source isolation | one index per query | The production knowledge base queries 3 sources ([F4](evidence.md#f4)); a single-source knowledge base isolates one | Proven | [F7](evidence.md#f7). `neverQuerySource` is the other route, untested ([O7](runbook.md#o7)) |
| Cross-cutting, trace | each request and response logged (`KB_TRACE`) | the `activity` array, which has no vector arguments and counts after the reranker ([F8](evidence.md#f8)), plus our own trace lines | Design | Spec work item 10 |

## Blocked rows

### Complete project enumeration

Lanes 2, 3 and 4, and the count in `determine_reply`, need every distinct project that matches a filter. The Search API's facets give that over the whole index. The retrieve request has no `facets`, `count`, `orderby` or `skip`, and returns at most 200 rows per call ([F6](evidence.md#f6)).

**Route (Design).** Retrieve with `filterAddOn` set to the filter, `search` `*`, `resultsProcessing: "none"`, `maxOutputDocuments` 200 and `maxOutputSize` 200,000. Take the distinct `project_id` values from `sourceData` in code. Their number is Lane 4's count. Sorting them by a field value in code gives Lane 3.

Risks:

- **More than 200 matching rows.** There's no `skip`, so the filter would have to be split into narrower filters of 200 rows or fewer each. Untested.
- **Completeness.** With reranking bypassed, candidates follow `maxOutputDocuments` ([F13](evidence.md#f13)). But `*` with 200 documents returned 50 of 88 chunks on project 1012173, unexplained ([F18](evidence.md#f18)).
- **Chunk rows crowd the slots.** Chunks carry stamped project metadata, so one project can fill many of the 200 rows. Filtering to record rows (`row_type`) gives one row per project per source; the `row_type` values aren't recorded here.
- **Fields.** `project_id` and the sort field must be in the knowledge source's `sourceDataFields`.

**Test.** [O10](runbook.md#o10) runs the Hardware Deploy filter from [F23](evidence.md#f23) row 12 on both APIs and compares the project lists. ZEST 1012929 ($13.5M) should rank sixth by spend.

**Fallback.** An MCP server knowledge source that returns counts and groups computed by our own code. It rules out `minimal` effort: "The minimal retrieval reasoning effort isn't supported. Use low or medium instead." ([MCP server knowledge source, Limitations and considerations](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-mcp-server)). It also needs a model and a public HTTPS endpoint. Untested.

### Gate coverage

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

With no facets, state comes only from the record row's `work_status`. A project without a record row reads Unknown and gets nothing ([F17](evidence.md#f17)). Three ways out:

1. Derive project state from the record row only, and drop the gate fallback.
2. Precompute gate coverage at ingest and stamp it onto every chunk.
3. Give the Unknown state a non-empty source list.

Option 2 keeps the current behavior on both APIs and needs an index change. The design choice is [O6](runbook.md#o6).

### Ranking signal

`rank_projects` orders projects by reranker score and asks the user to narrow when the top score is under 1.5. The Retrieval API path asked to narrow on 4 of 16 prompts ([F23](evidence.md#f23)). Under `resultsProcessing: "none"` references carry no `rerankerScore`, so both uses lose their input. Options, all untested:

- A second retrieve with default reranking on the top candidates only, read for its `rerankerScore`. Default reranking drops lesson chunks on the evidence fetch ([F16](evidence.md#f16)), so it can't replace the first call.
- Rank by the stage 1 order, and base the narrow-down rule on how many projects came back instead of a score.
- Keep default reranking on discovery calls only, where a score matters more than completeness.

The choice is part of [O6](runbook.md#o6).

## Search API parameters against the Retrieval API

| Search API | Retrieval API | Map row |
|---|---|---|
| `facets` | none | Lanes 2 to 4, profile_projects, determine_reply |
| `count` | none | Lane 4 |
| `orderby` | none; Lane 3 already sorts in code | Lane 3 |
| `skip` | none, so one call returns at most 200 rows | Lanes 2 to 4 |
| `top` | `maxOutputDocuments`, 50 to 200 only ([F6](evidence.md#f6)); trim in code | profile_projects, fetch_evidence |
| `search` | `intents[].search`; several allowed ([F22](evidence.md#f22)) | Lane 1, fetch_evidence |
| `filter` | `baseFilter` AND `filterAddOn`; can only narrow | every row |
| `select` | `sourceDataFields`, fixed on the knowledge source | every row |
| `searchFields` | `searchFields` on the knowledge source, shared by both lanes; or `search.ismatch` argument 2 per request | Lane 1, fetch_evidence |
| `searchMode` | `search.ismatch` argument 4 ("there's no search mode" on the request) | Lane 2 |
| `queryType` `simple` or `full` | `search.ismatch` argument 3; the request's query type is implied `semantic` | Lane 1, Lane 2 |
| `vectorQueries` | none; the service embeds `intents[].search` with the index vectorizer, no `k` | Lane 1, fetch_evidence |
| `semanticConfiguration` | `semanticConfigurationName`, fixed on the knowledge source | Lane 1 rerank |
| `semanticQuery` | none; `intents[].search` does both searching and reranking ([F19](evidence.md#f19)) | Lane 1 rerank, fetch_evidence |
| L2 threshold | `rerankerThreshold` in `knowledgeSourceParams`; cuts ([F11](evidence.md#f11)); HTTP 400 with `resultsProcessing: "none"` | rank_projects |
| `@search.rerankerScore` | `rerankerScore` on references; absent under `resultsProcessing: "none"` | rank_projects |
| `scoringProfile`, `scoringParameters` | none: "Agentic retrieval doesn't accept `scoringProfile` or `scoringParameters` inputs." Stored profiles don't apply either: "It doesn't apply the underlying index's scoring profiles, including `defaultScoringProfile`." ([Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)) | not in the diagram |
| `@search.rerankerBoostedScore` | none: "Retrieve responses also don't surface @search.rerankerBoostedScore." (same page) | not in the diagram |
| `highlight`, `answers`, `captions` | none; `outputMode: answerSynthesis` needs a model | not in the diagram |
| `minimumCoverage`, `sessionId`, `scoringStatistics` | none | not in the diagram |

Retrieval API only: `retrievalReasoningEffort` (above `minimal` needs a model, [F5](evidence.md#f5)), multi-source fan-out and source selection, `retrievalInstructions`, `answerInstructions`, `outputMode`, `maxOutputSize`, `includeActivity`, `alwaysQuerySource`, `neverQuerySource`, `failOnError`, `queryHints`, `queryHintOverrides`, `resultsProcessing`, citation URLs, `x-ms-query-source-authorization`, `retrieveDefaults`.

## Field scope, fuzzy and all-word matching through `search.ismatch`

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

Limits: no lambdas (`vendors/any(v: search.ismatch(...))` is rejected, [F21](evidence.md#f21)), so a collection field can be filtered or full-text searched but not both on the same element ([Troubleshooting collection filters](https://learn.microsoft.com/en-us/azure/search/search-query-troubleshoot-collection-filters)). The search clause is at most 100,000 characters and 1,024 clauses.

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

## Query hints, and why `queryType` shows `full`

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
