| # | Status | Capability | Use case (example question) | Goal (pass condition) | Today (Search API) | Knowledge Base route | Evidence |
|---:|---|---|---|---|---|---|---|
| 1 | Proven | **Document retrieval:** fetch a project's documents | "Extract all lessons learned for these eight project IDs" | Return the same Closeout passages as today for each project (50 on 1009338), so all 8 get their lessons | Hybrid + reranker, top 50 | The three settings from slide 7 | Same 50 on 1009338, same counts on 8 (F15, F16) |
| 2 | Proven | **Record lookup:** read a project's record row | "Is Rocca officially the delivery manager on 1009338?" | Return the project's record row so the answer states the recorded delivery manager, as today | Top 2 record rows by filter | Same filter, trimmed in code | 7 of 8; the 8th has none (F17) |
| 3 | Proven | **Source isolation:** keep the three sources separate | Any question: evidence comes only from PSR documents, not WPM or PECT records | Every evidence passage comes from the one source asked for | One index per query | Knowledge base with one source | F7 |
| 4 | Accepted, not verified | **Field-scoped matching:** one field only, every word required | "Which projects officially list Amazon Web Services as a vendor?" | Find all 10 projects whose vendor field lists Amazon Web Services, and leave out projects that only mention AWS in documents | `searchFields` + `searchMode all` | `search.ismatch` filter | Accepted; answers unchecked |
| 5 | Accepted, not verified | **Fuzzy matching:** tolerate a misspelling | "Show me data for the Fronteer Upgrade project." | Resolve "Fronteer" to the FronTier project, 1007814, and answer | Fuzzy search | `search.ismatch` with fuzzy | 15 documents matched (F21) |
| 6 | Designed, not run | **Semantic discovery:** find candidate projects by meaning | "Office move projects and their benefits" (no project ID) | Find the same candidate projects as today, with no project ID given | Two hybrid searches, merged | Two retrieve calls, merged in code | None |
| 7 | Designed, not run | **Grouping:** list every project matching a value | "For SAP projects, what are the cost estimates from the last 2 years?" | List all 11 matching projects, not 1 | Facets on project ID | Pull matching record rows, list in code | Slide 10 test |
| 8 | Designed, not run | **Sorting:** order by a stored number (spend) | "Top 10 Hardware Deploy projects by Total Actuals" | Return the same 10 projects in spend order, with ZEST 1012929 sixth | Facets, then sort in code | Same row pull, sort in code | Slide 10 test |
| 9 | Designed, not run | **Counting:** count matching projects | "How many SAP projects are there in total?" | Count 47 | Facet count | Count the pulled rows | Slide 10 test |
| 10 | Designed, not run | **Exact totals:** state the total in the answer | The same SAP question | The answer says "47", not "at least 1" | Facet total | Count from item 9 | Slide 10 test |
| 11 | Designed, not run | **Project status:** derive it from gate documents | Lessons for 1012329, a closed project with no record row | 1012329 reads as Closed and returns its lessons | Facet on gate label | Gate list stamped on data at load time | Needs an index change |
| 12 | Designed, not run | **Ranking and confidence:** rank projects, decide when to narrow | "Which SaaS projects closed in the last two years have a duration under 12 months?" | Answer (today ranks 18, names 5) instead of asking the user to narrow. Same answer-or-narrow decision as today on all 16 questions | Reranker score vs 1.5 | A replacement signal (no score when bypassed) | None |
| 13 | Designed, not run | **Access control:** filter by user on open questions | Two users with different access ask "How many SAP projects are there?" | Each user sees exactly the projects, documents, and citations they see today | Per-source access filters | Same filters on the Knowledge Base | Named projects 9 of 9; open questions untested |
| 14 | Designed, not run | **Tracing:** log every retrieval step | Support asks why an answer left out a project | Any answer can be reproduced from its trace | Every request logged | Our trace + Knowledge Base activity log | None |
| 15 | No route | **Full-question reranking:** re-score against the whole question | A long question where the search words ("lessons learned") are shorter than the full question | Answers stay the same as today without this step | Reranker scores the full question | None: one string for search and rerank | Doesn't apply with the reranker bypassed |

---

Search.ismatch() vs intents[].search:

They don't conflict, because they act in two different places. The retrieve request's query type decides how chunks get scored and ranked. search.ismatch sits inside the filter and only decides which chunks are allowed in. Think of a judge and a bouncer.
 request
   │
   ├─ filterAddOn:  search.ismatch('"lessons learned"', 'body', 'full', 'all')
   │                └─ BOUNCER: parses ITS OWN string with ITS OWN queryType/searchMode,
   │                   answers yes/no per chunk. No score. Runs before anything ranks.
   │
   ▼  only "yes" chunks are eligible, for BOTH lanes
   │
   ├─ intents[].search = "lessons learned"
   │    ├─ BM25 lane    ← JUDGE: parsed by the retrieve request's own
   │    │                 (locked) parser, scores term matches in searchFields
   │    └─ vector lane  ← JUDGE: embeds the text, scores similarity
   │                      (no parser involved at all)
   │    merged into one hybrid order
   │
   ├─ L2 reranker   "rerank": rescores and cuts  |  "none": skipped
   ▼
 references

What search.ismatch's query type means
	It applies only to the string inside the function.
	full gives you Lucene: phrases, ~ proximity, wildcards, field:term. all requires every term.
	The result is true or false per chunk. It never changes a chunk's score.
---> ESSENTIALLY GOOD FOR FUZZY MATCHING


with reranking off, versus plain hybrid on its own:
 
 	Hybrid, reranking off	Hybrid, reranking off, plus search.ismatch(... 'full', 'all')
Which chunks compete	Everything the filter allows	Only chunks where body matches the Lucene expression
How they're ranked	BM25 and vector, merged	Same: BM25 and vector, merged
Vector lane	Nearest neighbours from the whole filtered pool	Nearest neighbours from the smaller pool that passed ismatch
Risk	Noise: loosely related chunks	Misses: lessons prose that doesn't match the exact expression is excluded, even if the vector lane would have found it











---

## Vector Search - searchFields 

Different APIs --> Different Contracts, where each Param usages are different.

	• On the Search API, searchFields scopes only the keyword lane, and the vector lane has its own vectorQueries[].fields. So a text-only field list is normal and safe there. chat_similarity sends 13 text fields that way today (F19).
	• On the knowledge source, one field list covers both lanes. If the list names only text fields, vector search has no field to run on, so it doesn't run, and nothing reports it.
		"Text-only list" means a list of text fields with no vector field in it. Our production list is 29 text fields and doesn't include content_vector, so that the keyword search doesn't hit the embedding which add noise and result in poor quality.
		
		Because the knowledge source uses that one list for both lanes, the vector lane only searches the fields on the list. There's no vector field on it, so the vector lane has nothing to search and never runs. Nothing warns you: no error and no message in the response. You just get keyword results only.
		
	• Leaving the list empty works. Anyone who carries over their Search API field list hits this.


Example: 
	• Search API: searchFields covers the keyword only, and vector field separately, in vectorQueries[].fields. 
		------------------------------------------------------------------------------------------------------------------------
		POST /indexes/project_similarity_index/docs/search?api-version=2024-07-01
		{
		  "search": "lessons learned",
		  "searchFields": "body",
		  "vectorQueries": [{
		      "kind": "vector",
		      "vector": [0.0123, -0.0841, 0.0337, 0.0019, -0.0562, ... 1536 numbers total],
		      "fields": "content_vector",
		      "k": 50
		  }],
		  "filter": "project_id eq '1009338' and gate_label eq 'Closeout'",
		  "top": 50
		}
		------------------------------------------------------------------------------------------------------------------------
		
	• Knowledge base: there's no vectorQueries. The knowledge source's searchFields is the only field list, that covers both keyword and vector. 
	• A list without content_vector turns vector search off. A list with it keeps vector search on:
		○ Step 1: the knowledge source holds the field list
			PUT /knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview
			{
			  "name": "ps-ks-allfields",
			  "kind": "searchIndex",
			  "description": "searchFields emptied.",
			  "searchIndexParameters": {
			    "searchIndexName": "project_similarity_index",
			    "searchFields": [
			      { "name": "body" },              ← keyword lane: text field
			      { "name": "content_vector" }     ← vector lane: keeps the vector query on
			    ],
			    "sourceDataFields": [
			      { "name": "psr_row_id" },
			      { "name": "project_id" },
			      { "name": "gate_label" },
			      { "name": "citation_doc_name" },
			      { "name": "body" }
			    ]
			  }
			}
		Step 2: the retrieve request only carries text; the service uses the list from step 1
			POST /knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview
			{
			  "intents": [{ "type": "semantic", "search": "lessons learned" }],
			  "knowledgeSourceParams": [{
			      "knowledgeSourceName": "ps-ks-allfields",    ← points at step 1, so body + content_vector apply
			      "kind": "searchIndex",
			      "filterAddOn": "project_id eq '1009338' and gate_label eq 'Closeout'",
			      "includeReferences": true,
			      "includeReferenceSourceData": true,
			      "resultsProcessing": "none",
			      "maxOutputDocuments": 50
			  }],
			  "maxOutputDocuments": 50,
			  "maxOutputSize": 200000,
			  "includeActivity": true
			}
			
		Response:
		{
		  "references": [
		    { "type": "searchIndex", "id": "0", "activitySource": 0,
		      "docKey": "1009338_1009338-1009338-g3-itcash-sdwan-2023-closeout-86f644863c06ccb2_chunk_435",
		      "sourceData": {
		        "psr_row_id": "1009338_1009338-1009338-g3-itcash-sdwan-2023-closeout-86f644863c06ccb2_chunk_435",
		        "project_id": "1009338", "gate_label": "Closeout",
		        "body": "Lessons learned: phased cutover reduced …" } },
		    …  49 more, no rerankerScore because reranking was skipped
		  ],
		  "activity": [
		    { "type": "searchIndex", "id": 0, "knowledgeSourceName": "ps-ks-allfields",
		      "count": 50,
		      "searchIndexArguments": {
		        "search": "lessons learned",
		        "filter": "project_id eq '1009338' and gate_label eq 'Closeout'",
		        "searchFields": [ { "name": "body" }, { "name": "content_vector" } ]
		      } }
		  ]
		}
		
			




Pages that only mention vectors in passing: the overview ("can be keyword, vector, or hybrid search"), the knowledge source overview, and the search index knowledge source page.

Query a knowledge base using the retrieve action or MCP endpoint doesn't mention or show whether the SearchFields can contain the vectorQueries











All 50 knowledge base references are the same 50 chunks as the Search API's top 50, both for hybrid and for hybrid plus semantic ranker.


Call 1: Search API, hybrid
 
		POST {endpoint}/indexes/project_similarity_index/docs/search?api-version=2024-07-01
		api-key: {key}
		Content-Type: application/json
		
		{
		  "search": "lessons learned",
		  "vectorQueries": [
		    { "kind": "text", "text": "lessons learned", "fields": "content_vector", "k": 50 }
		  ],
		  "filter": "project_id eq '1009338' and gate_label eq 'Closeout'",
		  "top": 50,
		  "select": "psr_row_id,body"
		}
	
Call 2: Search API, hybrid plus semantic ranker. Same as call 1, plus:
 
		  "queryType": "semantic",
		  "semanticConfiguration": "default",
	
Call 3: knowledge base retrieve
		 
		POST {endpoint}/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview
		api-key: {key}
		Content-Type: application/json
		
		{
		  "intents": [ { "type": "semantic", "search": "lessons learned" } ],
		  "knowledgeSourceParams": [
		    {
		      "knowledgeSourceName": "ps-ks-allfields",
		      "kind": "searchIndex",
		      "filterAddOn": "project_id eq '1009338' and gate_label eq 'Closeout'",
		      "includeReferences": true,
		      "includeReferenceSourceData": true,
		      "resultsProcessing": "none",
		      "maxOutputDocuments": 50
		    }
		  ],
		  "maxOutputDocuments": 50,
		  "maxOutputSize": 200000,
		  "includeActivity": true
		}
	Ø ps-ks-allfields had searchFields = [] at the time. 
	Ø The comparison matched psr_row_id from each Search API result against sourceData.psr_row_id in each knowledge base reference.
	
Output:
Project 1009338, Closeout chunks, query "lessons learned", 2026-09-18 (A37).
Compared against the knowledge base's 50 references	Results returned	Same chunks as the knowledge base	Chunks mentioning "lesson"	Of those, also in the knowledge base
Search API, hybrid	50	50 of 50	2	2 of 2
Search API, hybrid + semantic ranker	50	50 of 50	2	2 of 2
 


























---















# `search.ismatch` on the Retrieval API

## 1. What it is

`search.ismatch` is a full-text search inside an OData filter. It returns true or false for each chunk. It does not change the score of a chunk.

> "for `search.ismatch`, the document score doesn't change." ([OData full-text search functions](https://learn.microsoft.com/en-us/azure/search/search-query-odata-full-text-search-functions))

On the Retrieval API, put it in `filterAddOn`. The service joins `filterAddOn` to the stored `baseFilter` with `AND`:

> "Because the filters are combined with `AND`, `filterAddOn` can only narrow the persisted base filter. It can't replace or broaden it." ([Create a search index knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index))

**Evidence gap.** No Microsoft page shows `search.ismatch` inside `filterAddOn`. The OData page says the function is "only supported in filters in the Search API". Our test [F21](evidence.md#f21) is the only proof that it works on the Retrieval API: 15 documents with the filter, 0 without it. That test ran with the vector lane off.

## 2. Where it acts in the retrieve pipeline

```
 retrieve request
   │
   ├─ baseFilter AND filterAddOn
   │    └─ search.ismatch('<text>', '<fields>', '<simple|full>', '<any|all>')
   │         parses its own string with its own parser. Answers true or false per chunk.
   │
   ▼  only "true" chunks go on
   │
   ├─ intents[].search
   │    ├─ BM25 lane: implied query type "semantic", no search mode, fields = searchFields on the knowledge source
   │    └─ vector lane: embeds the text with the index vectorizer. No parser.   ← gate on this lane: UNTESTED
   │    merged into one order ("underlying result order". The merge method is not documented.)
   │
   ├─ reranker:  resultsProcessing "rerank" → scores up to 50 candidates, cuts below rerankerThreshold
   │             resultsProcessing "none"   → skipped, stage 1 order kept
   │
   ├─ output: deduplication, maxOutputDocuments, maxOutputSize
   ▼
 references
```

Two strings go through two parsers. The `search.ismatch` string decides which chunks can compete. `intents[].search` ranks the chunks that pass. The two strings never interact.

## 3. Arguments

| # | Argument | Values | Default | Rule |
|---|---|---|---|---|
| 1 | search text | a query string | required | parsed by argument 3 |
| 2 | fields | comma-separated list of `searchable` fields | **all searchable fields in the index** | A `field:term` inside argument 1 overrides this list |
| 3 | queryType | `'simple'` or `'full'` | `'simple'` | selects the parser for argument 1 |
| 4 | searchMode | `'any'` or `'all'` | `'any'` | Lucene Boolean operators in argument 1 override this value |

- Arguments 3 and 4 come as a pair, or not at all.
- The default for argument 2 is every searchable field in the index. It is **not** the `searchFields` list on the knowledge source. If you leave out argument 2, the gate matches the text in any searchable field.

## 4. Parser: `simple` against `full`

| Feature | `simple` | `full` |
|---|---|---|
| Phrase `"a b"` | yes | yes |
| Prefix `term*` | yes | yes |
| AND / OR / NOT | `+` `\|` `-` | `AND` `OR` `NOT` (capital letters), `+`, `-`, `!`. **`\|` is not supported.** |
| Grouping `( )` | yes | yes |
| Fuzzy `term~n` | **no**: "its implementation in Azure AI Search excludes fuzzy search" | yes. n = 0 to 2, default 2, up to 50 expanded terms |
| Proximity `"a b"~n` | no | yes |
| Fielded `field:term` | no | yes |
| Boost `term^n` | no | Accepted. Inside `search.ismatch` it has no effect, because the function does not score. This is our inference from the OData page. Microsoft does not state it directly |
| Regex `/…/`, infix and suffix wildcards | no | yes |

**Traps that give wrong results with no error message:**

| Trap | Result | Correct form |
|---|---|---|
| `simple` + `any` + a negation: `'wifi -luxury'` | Expands to `wifi OR -luxury OR *`, so the filter matches **every chunk** | Use `'all'`, or use `'full'` |
| A lone negation in `full`: `'-luxury'` | Not allowed | Use `not search.ismatch('luxury')` |
| Fuzzy on a phrase: `'"lessons learned"~1'` | Proximity, not fuzzy | `'lessons~1 learned~1'` |
| Uppercase in a wildcard, regex or fuzzy term: `'Fronteer~1'`, `'Contoso*'` | These terms skip lexical analysis. `Contoso*` can fail to match the token `contoso` | Lowercase the term in the pipeline |
| Stemming analyzer + wildcard | `terminat*` misses words that `en.lucene` stems to `termi` | Test the analyzer with the Analyze API first |
| A negation in `full` + `'any'` | A negation is always applied with AND, whatever the search mode | Expect AND behavior |
| `search.ismatch` inside a lambda: `vendors/any(v: search.ismatch(...))` | Rejected. The error is "The function `ismatch` has no parameters bound to the range variable" | Call `search.ismatch` at the top level of the filter |

**Escaping.** Three layers apply, from the inside out:

- The parser escapes its operators with `\`.
- OData doubles a single quote: `O''Brien`.
- JSON escapes each inner double quote: `"filterAddOn": "search.ismatch('\"schedule delay\"~10', 'body', 'full', 'any')"`.

## 5. Which filter to use

| Need | Use | Why |
|---|---|---|
| Exact value on a `filterable` field | `field eq 'value'` | "a filter succeeds only if the match is exact". No analysis, and case-sensitive |
| Exact value in one element of a string collection | `vendors/any(v: v eq 'Amazon Web Services')` | Tests each element on its own. Requires `vendors` to be `filterable`. We did not check that attribute |
| One field against many exact values (ACL, project IDs) | `search.in(field, 'a,b,c')` | "designed for speed" |
| Text in a `searchable` field (words, "contains", fuzzy, proximity) | `search.ismatch` | Full-text match, as a yes/no gate |
| A text match that also raises the rank | `search.ismatchscoring` | Adds to the score. **Untested on the Retrieval API** |

## 6. Scenarios

| Scenario | Expression | Use it when | Do not use it when |
|---|---|---|---|
| Official vendor tag, all words required | `search.ismatch('Amazon Web Services', 'vendors', 'simple', 'all')` | The question says "officially lists" | The question asks about any mention |
| Person in a role field | `search.ismatch('Yusoff', 'roles_project_sponsor,roles_work_lead')` | The question names a role | The name can also be in free text |
| Misspelled title | `search.ismatch('fronteer~1', 'title', 'full', 'any')` | The user spells a name wrong | The name is correct. Fuzzy adds false matches |
| Words near each other | `search.ismatch('"schedule delay"~10', 'body', 'full', 'any')` | The terms must be close | The idea can appear in other words |
| Exclude a term | `not search.ismatch('decommission', 'body')` | A hard exclusion is necessary | — |
| Required phrase | `search.ismatch('"lessons learned"', 'body')` | Precision matters more than recall | **Recall matters.** A lessons chunk that does not contain the exact phrase is excluded, even if the vector lane finds it |

**Collection fields (`vendors`).** `search.ismatch` cannot tie a match to one element of a collection. Microsoft: "it isn't possible to write filters over collections of objects that can correlate full-text search matches with strict filter matches on the same object." With `'all'`, the three words can match across different elements. For example, `["Amazon", "Web Services Ltd"]` can pass. We did not test this on `vendors`. For an exact tag, use `vendors/any(v: v eq '...')` from section 5.

## 7. How `search.ismatch` combines with each parameter outside it

| Combination | Effect on the result | Status |
|---|---|---|
| + `intents[].search`, same words | `search.ismatch` removes non-matching chunks. `intents[].search` ranks the chunks that are left | documented, both parts |
| + `intents[].search`, different words | Gates on one idea and ranks on a different idea. Example: gate `vendors` on Kinaxis, rank on "lessons learned" | documented, both parts |
| + `searchFields` on the knowledge source | No interaction. `searchFields` sets the BM25 fields. Argument 2 sets the gate fields | documented |
| + a `searchFields` list without `content_vector` | The vector lane is off ([F9](evidence.md#f9)). The gate then narrows only BM25 results | measured ([F21](evidence.md#f21) ran in this setup) |
| + vector lane on | Expected: the vector lane returns only chunks that pass the gate. The retrieve API does not document its `vectorFilterMode`. With `postFilter`, the lane can return fewer chunks than expected. [F8](evidence.md#f8) shows that the vector lane obeys a **plain** filter | **untested** for `search.ismatch` |
| + `resultsProcessing: "rerank"` | The reranker scores up to 50 of the chunks that passed, then cuts again | documented |
| + `resultsProcessing: "none"` | The chunks that passed keep their stage 1 order. References have no `rerankerScore` | documented |
| + `rerankerThreshold` | Cuts after the gate. With `"none"`, the request fails with HTTP 400 | documented |
| + `maxOutputDocuments`, `maxOutputSize` | No interaction. The caps still cut the chunks that passed the gate | documented |
| + a plain OData clause | Combines with `and`, `or` and `not`. Example: `search.ismatch(...) and gate_label eq 'Closeout'` | documented |
| + `baseFilter` | Always joined with AND. It can narrow, never widen | documented |
| + query hints | Not applied at `minimal` effort. At higher effort, a generated filter is also joined with AND | documented, not in our setup |
| `search.ismatchscoring` instead | Adds a BM25 score. With `"none"`, this can change the hybrid order. With `"rerank"`, the reranker sets the final order | **untested** on the Retrieval API |

## 8. Search API feature and its equivalent on the Retrieval API

| Search API | Retrieval API | Difference in the result |
|---|---|---|
| `searchFields` | `search.ismatch` argument 2 | The Search API **ranks** on those fields. `search.ismatch` **only filters** on them. Ranking still uses the `searchFields` list on the knowledge source |
| `searchMode: all` | argument 4 = `'all'` | Same match rule. It applies to the gate, not to ranking |
| `queryType: full` | argument 3 = `'full'` | Same parser. It applies to the gate string only. `intents[].search` stays `semantic` |
| `filter` | `filterAddOn` | Same OData grammar. It is always joined with AND to `baseFilter` |
| A fuzzy `search` string | `search.ismatch('term~1', …, 'full', …)` | On the Search API, a non-matching chunk can still come in through the vector lane. With `search.ismatch`, a non-matching chunk is excluded, if the gate applies to the vector lane (untested) |

## 9. Open tests

- **Gate on the vector lane.** Send `zqxjvwkbhf` to `ps-kb-allfields` with a `search.ismatch` gate. If every reference passes the gate, the gate applies to both lanes.
- **Answers match the Search API.** The prompts for this are in [O9](runbook.md#o9). The claim is [U13](staging-findings.md#u13).
- **`search.ismatchscoring` in `filterAddOn`.** Check that the service accepts it, and that it changes the order under `"none"`.
- **`'all'` across `vendors` elements.** Check whether a chunk with the words in different elements passes the gate.
- **`vendors` attribute.** Check whether `vendors` is `filterable`, because section 5 depends on it.

## 10. Sources

All ten pages were read on 2026-09-21. The date after each link is the date that the page shows.

| Need | Page | All parameters? | When-to-use guidance? | Real examples? | What it proves in this note |
|---|---|---|---|---|---|
| `search.ismatch` arguments | [OData full-text search functions](https://learn.microsoft.com/en-us/azure/search/search-query-odata-full-text-search-functions) (2025-07-10) | Yes, all 4, in a table | Only short notes: no lambdas, and `search.ismatch` against `search.ismatchscoring` | Yes, 6 worked examples with output | Yes/no gate with no effect on score. Argument defaults. Lucene operators override `searchMode`. Supported "only in filters in the Search API" |
| Operators, `simple` parser | [Simple query syntax](https://learn.microsoft.com/en-us/azure/search/query-simple-syntax) (2026-02-19) | Yes, every operator | Yes: the NOT operator with `any` or `all` | Yes | No fuzzy in `simple`. How a negation expands under `any` |
| Operators, `full` parser | [Lucene query syntax](https://learn.microsoft.com/en-us/azure/search/query-lucene-syntax) (2026-07-20) | Yes, every operator | Yes, including traps: the NOT table, wildcard case, no fuzzy on a phrase | Yes | Fuzzy 0 to 2 and 50 terms. Proximity. Fielded search. No lone negation. `\|` not supported |
| Which filter to use | [Text query filters](https://learn.microsoft.com/en-us/azure/search/search-filters) (2026-04-27), table "Approaches for filtering on text" | No | Yes: `search.in`, `search.ismatch` and `eq`, with when to use each | Yes | A filter runs before keyword ranking. `eq` is exact and case-sensitive |
| Filters on collections | [Troubleshooting collection filters](https://learn.microsoft.com/en-us/azure/search/search-query-troubleshoot-collection-filters) (2026-08-31) | Yes: the rules for each collection type, in a table | Yes: allowed and rejected forms | Yes | No `search.ismatch` in a lambda, with the error text. `eq` and `search.in` inside `any` on string collections |
| Filters on the vector lane | [Vector query filters](https://learn.microsoft.com/en-us/azure/search/vector-search-filters) (2026-04-27) | Yes, for `vectorFilterMode` | Yes: a comparison table of the 3 modes | Yes | Why the gate on the vector lane is untested. Filters apply to "filterable nonvector fields" |
| `baseFilter` and `filterAddOn` | [Create a search index knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index) (2026-08-14) | No | Yes: how the filters join, and query hints | Yes | `baseFilter AND filterAddOn`: "can only narrow" |
| Every Search API request parameter | [Documents - Search Post (2026-04-01)](https://learn.microsoft.com/en-us/rest/api/searchservice/documents/search-post?view=rest-searchservice-2026-04-01) | Yes: `search`, `filter`, `queryType`, `searchMode`, `searchFields`, `vectorQueries`, `vectorFilterMode`, `facets`, `semanticQuery` and the rest | No, it's generated reference | Yes, request and response samples | The Search API column in section 8 |
| Every retrieve request parameter | [Knowledge Retrieval - Retrieve (2026-08-01-preview)](https://learn.microsoft.com/en-us/rest/api/searchservice/knowledge-retrieval/retrieve?view=rest-searchservice-2026-08-01-preview) | Names all of them, including `filterAddOn`, `resultsProcessing`, `rerankerThreshold`, `maxOutputDocuments`, `neverQuerySource` and `queryHintOverrides` | No | 4 samples. The only `filterAddOn` value shown is `"foo eq bar"` | `filterAddOn` exists, but the page gives no description for it |
| How to use the retrieve parameters | [Query a knowledge base](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve) (2026-09-04) | Most of them, spread across sections | Yes, for `resultsProcessing` and `rerankerThreshold` | Yes | Implied `semantic` query type with no search mode. `"none"` skips the reranker. HTTP 400 with `rerankerThreshold` |

The OData page and the query-a-knowledge-base page carry the core of this note. The other pages each back one row.
