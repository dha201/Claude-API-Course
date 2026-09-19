# Query parsing and `search.ismatch` reference

How to get field scoping, fuzzy matching and all-word matching back on the Retrieval API, how every Search API parameter maps to the Retrieval API, and why the activity array can show `queryType: full`.

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

## Search API parameters against the Retrieval API

No parameter in the retrieve request:

| Search API | What `chat_similarity` uses it for | Retrieval API |
|---|---|---|
| `facets` | `_facet_member_ids`, gate coverage, project membership | absent |
| `count` | exact totals | absent |
| `orderby` | top N by spend or date | absent |
| `skip` | pages past the first | absent |
| `top` | hard result cap | `maxOutputDocuments`, 50 to 200 only ([F6](evidence.md#f6)) |
| `searchMode` | `all` against `any` | absent ("there's no search mode") |
| `queryType` | `simple` or `full` | implied `semantic` |
| `scoringProfile`, `scoringParameters` | field-weighted boosting | "Agentic retrieval doesn't accept `scoringProfile` or `scoringParameters` inputs." Stored profiles don't apply either: "It doesn't apply the underlying index's scoring profiles, including `defaultScoringProfile`." ([Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)) |
| `@search.rerankerBoostedScore` | boosted score readback | "Retrieve responses also don't surface @search.rerankerBoostedScore." (same page) |
| `highlight`, `answers`, `captions` | snippets and extractive answers | absent; `outputMode: answerSynthesis` needs a model |
| `minimumCoverage`, `sessionId`, `scoringStatistics` | partial-index tolerance, scoring consistency | absent |

Kept, renamed or moved:

| Search API | Retrieval API | Scope |
|---|---|---|
| `search` | `intents[].search` | per request; several allowed ([F22](evidence.md#f22)) |
| `filter` | `baseFilter` AND `filterAddOn` | stored, then per request; can only narrow |
| `select` | `sourceDataFields` | fixed on the knowledge source |
| `searchFields` | `searchFields` | fixed on the knowledge source, shared by both lanes |
| `semanticConfiguration` | `semanticConfigurationName` | fixed on the knowledge source |
| `vectorQueries` | none; the service embeds `intents[].search` with the index vectorizer | no precomputed vector, no `k` |
| `semanticQuery` | none; `intents[].search` does both searching and reranking | the Search API payload searches on `lessons learned` and reranks against the full question ([F19](evidence.md#f19)); the Retrieval API can't split them |
| L2 threshold | `rerankerThreshold` in `knowledgeSourceParams` | cuts ([F11](evidence.md#f11)) |
| `searchFields`, `queryType`, `searchMode` per request | `search.ismatch` arguments 2, 3 and 4 in `filterAddOn` | per request |

Retrieval API only: `retrievalReasoningEffort` (above `minimal` needs a model, [F5](evidence.md#f5)), multi-source fan-out and source selection, `retrievalInstructions`, `answerInstructions`, `outputMode`, `maxOutputSize`, `includeActivity`, `alwaysQuerySource`, `neverQuerySource`, `failOnError`, `queryHints`, `queryHintOverrides`, `resultsProcessing`, citation URLs, `x-ms-query-source-authorization`, `retrieveDefaults`.

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
