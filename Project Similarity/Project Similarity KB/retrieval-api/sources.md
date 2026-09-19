# Sources

## Microsoft documentation

Quotes that back one claim sit next to that claim in [ground-truth.md](ground-truth.md) and [search-ismatch-reference.md](search-ismatch-reference.md). The quotes below back the vector-query and index findings. All were checked on the current page on 2026-09-18.

**The vector query at `minimal` effort.**

- "If your index contains vector fields, the query plan includes these fields if they're `searchable` and have a `vectorizer` assignment." ([Create an index for agentic retrieval, Add a vectorizer](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index))
- "At query time, when vector fields are present in the index, the agentic retrieval engine executes a vector query in parallel to the text query." (same page, Example index definition)
- "There's nothing in the vectorizer definition that needs to be changed to work with agentic retrieval." (same page, Add a vectorizer)
- "The vectorizer must be the same embedding model used to create the vectors in the index." (same page, Example index definition)
- "If the index includes vector fields, you need a valid vectorizer definition so the agentic retrieval engine can vectorize query inputs. Otherwise, vector fields are ignored." ([Query a knowledge base, Search index behavior](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve))
- `minimal`: "Disables LLM-based query planning to deliver the lowest cost and latency for agentic retrieval. It issues direct text and vector searches across the knowledge sources listed in the knowledge base, and returns the best-matching passages." ([Set the retrieval reasoning effort](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-set-retrieval-reasoning-effort))
- The tutorial's model-free `minimal` knowledge base is "a knowledge base that performs hybrid retrieval from the knowledge source." ([Tutorial: Build an agentic retrieval solution, Understand the solution](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-pipeline))
- "You can reference multiple knowledge sources in a single knowledge base. The agentic retrieval engine queries all of them in a single request. Subqueries are generated for each knowledge source, and the top results are returned in the retrieval response." ([What is a knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-overview))

**Index and service rulings ([F3](evidence.md#f3)).**

- "To minimize space requirements, we recommend setting retrievable and stored to false." A recommendation, not a requirement. ([Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index))
- "You can use an existing index that meets the criteria, even if it was created with an earlier API version" (same page).
- "Confidential computing disables or restricts certain features, including agentic retrieval, semantic ranker, query rewrite, and skillset execution." ([Region support](https://learn.microsoft.com/en-us/azure/search/search-region-support))
- `knowledgeRetrieval`: "The default value is free. To enable paid usage, set knowledgeRetrieval to standard." ([Migrate agentic retrieval code](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-migrate))

**What no page says.** No page says that an explicit `searchFields` list without the vector field turns the vector query off ([F9](evidence.md#f9), [F10](evidence.md#f10)). The nearest sentences:

- "By default, all `searchable` fields are included in query execution, and all `retrievable` fields are returned in results. You can choose which fields to use for each action in the search index knowledge source definition." ([Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index))
- `searchFields`: "Used to restrict which fields to search on the search index." Its examples write all fields as `[{ "name": "*" }]`. ([Knowledge Sources - Create or Update, 2026-08-01-preview](https://learn.microsoft.com/en-us/rest/api/searchservice/knowledge-sources/create-or-update?view=rest-searchservice-2026-08-01-preview))
- The Python samples on [Create a search index knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index) set `search_fields = [SearchIndexFieldReference(name="id")]`, a text-only list, which by [F9](evidence.md#f9) turns the vector query off.

**Don't cite.**

| Sentence | Why |
|---|---|
| "if the only searchable field is a vector field, then only pure vector search is used" | deleted on 2026-06-12, commit `3832581a`; absent from the current create-index page |
| portal objects "still use the 2025-08-01-preview schema" | absent from the overview page. The current wording: "Objects created in either portal might use preview schemas and require migration when you move to the generally available REST API version" |
| "Facets, sorting, document count pagination, and orderby are not available." | absent from the current retrieve page. Cite the retrieve contract (the parameter tables in [search-ismatch-reference.md](search-ismatch-reference.md)) instead |
| The create-index criteria row "Scoring profile / Optional / Boosts relevance for specific fields. Set defaultScoringProfile to apply automatically." | present, but the retrieve page says retrieve doesn't apply index scoring profiles |
| `alwaysQuerySource` on the reasoning-effort page | that page now names the property `alwaysQueryKnowledgeSource`; the retrieve page still says `alwaysQuerySource` |
| "expect to call a native Azure OpenAI or Foundry endpoint directly" (Q&A 5955030) | not on the page; the staff answer's wording is in [runbook.md, Operating notes](runbook.md#operating-notes) |

## Outside evidence

- [Foundry IQ benchmark post](https://techcommunity.microsoft.com/blog/azure-ai-foundry-blog/foundry-iq-improve-recall-by-up-to-54-with-knowledge-bases/4524852), Azure AI Search team, 2026-06-02: defines hybrid as BM25 plus vector, reports single-call evidence recall (BM25 57.5, hybrid 67.1, knowledge base `minimal` 72.1) and a retrained reranker. No row matches our hybrid-plus-semantic baseline. Not re-checked; the page didn't load on 2026-09-18.
- [`chatreadretrieveread.py`](https://github.com/Azure-Samples/azure-search-openai-demo/blob/main/app/backend/approaches/chatreadretrieveread.py) in Microsoft's reference app: the agentic path passes no vector query, no `top` and no query type.
- [Spec CHANGELOG](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/search/data-plane/Search/CHANGELOG.md): `queryType` added to the search-index activity arguments; every vector entry applies to the Search API.
- [TypeSpec, models-knowledgebase.tsp](https://github.com/Azure/azure-rest-api-specs/blob/main/specification/search/data-plane/Search/models-knowledgebase.tsp): the activity arguments have no vector property, and `2026-08-01-preview` adds `citationUrl`, "A Search-owned URL that points at the backing document for this reference, usable as a citation target." Whether it can carry our `citation_url` values is untested.
- [Stack Overflow 79891856](https://stackoverflow.com/questions/79891856) with [Microsoft Q&A 5780377](https://learn.microsoft.com/en-us/answers/questions/5780377/semantic-ranker-is-a-documented-limitation-with-ve), 2026-02-18: one engineer measured the semantic ranker lowering Hit@1 on vector-dominated hybrid results across 8,068 queries. It predates the retrained ranker and uses a different corpus.
- [azure-sdk-for-python #42299](https://github.com/Azure/azure-sdk-for-python/issues/42299): `doc_key` doesn't keep the exact index value; `include_reference_source_data` does (REST `includeReferenceSourceData`, used in [A29](commands.md#a29) and later).
- [azure-search-openai-demo #2569](https://github.com/Azure-Samples/azure-search-openai-demo/issues/2569): references once returned only semantic configuration fields; closed 2026-07-18 as resolved.
- [Jannik Reinhard, Foundry IQ Deep Dive](https://jannikreinhard.com/foundry-iq-knowledge-bases/): the one hands-on independent write-up; repeats "keyword, vector or hybrid" without testing it.
- [Pankaj Pandey on Medium](https://medium.com/@pankaj_pandey/azures-agentic-retrieval-an-llm-in-front-of-the-search-engine-and-a-second-bill-on-every-query-6d7d0cbb0045), 2026-04-18: conceptual cost critique, no measurements.
- Microsoft Q&A threads on empty agentic results ([5924441](https://learn.microsoft.com/en-us/answers/questions/5924441/unable-to-get-the-response-with-agentic-retrieval), [5627268](https://learn.microsoft.com/en-us/answers/questions/5627268/ai-foundry-agents-stopped-searching-the-knowledge), [2278561](https://learn.microsoft.com/en-us/answers/questions/2278561/issues-with-empty-response-in-azure-ai-search-agen), [2283142](https://learn.microsoft.com/en-us/answers/questions/2283142/issue-while-implementing-knowledge-agents-retrieve)): causes named are MCP 403s, identity, RBAC, index names, region or an index without vectors. None names a vector-query cause.

No public source compares agentic retrieval against the Search API on one index or analyzes the activity array.

Not reached: Reddit (blocked, JSON API included), the Microsoft Q&A search API, direct Medium (read through `r.jina.ai`), the markaicode latency benchmark (HTTP 403), LinkedIn, and the Microsoft Ignite sessions BRK142 and BRK193 (no transcripts).
