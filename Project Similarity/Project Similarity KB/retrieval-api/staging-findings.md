# Staging: findings not yet proven

Promotion rule: a finding moves from this file only with a command that ran on `workdeliverygpt-dev-srch`, the number it produced, and a date. Then the command goes to [commands.md](commands.md), the result table to [evidence.md](evidence.md) as a new finding, and the claim to [ground-truth.md](ground-truth.md). The flow is drawn in [README.md](README.md#how-the-documents-cite-each-other). A documentation quote alone isn't enough, because Microsoft pages change: the create-index page still lists scoring profiles, while the retrieve page says retrieve doesn't apply them ([U6](#u6)).

Azure AI Search agentic retrieval, API version `2026-08-01-preview`, index `project_similarity_index`. Microsoft quotes were checked on the current page on 2026-09-18. Finding IDs ([F1](evidence.md#f1) to [F23](evidence.md#f23)) link to [evidence.md](evidence.md) and open items ([O1](runbook.md#o1) to [O10](runbook.md#o10)) to [runbook.md](runbook.md).

| # | Claim | Status | Matters for |
|---|---|---|---|
| [U2](#u2) | A synonym map widens keyword recall with no reindex | untested | keyword recall on prose queries |
| [U3](#u3) | A reranker score floor of 2.5 sits below `rerankerThreshold` | untested; the number has no source sentence | default reranking |
| [U4](#u4) | `neverQuerySource` excludes a source at `minimal` effort | untested; the command is [O7](runbook.md#o7) | using the production knowledge base for the evidence fetch |
| [U5](#u5) | `alwaysQuery` on a knowledge source definition | untested | source selection |
| [U6](#u6) | Retrieve doesn't apply index scoring profiles | documented, not measured | ranking levers |
| [U7](#u7) | `prioritizedContentFields` decides what the reranker scores | unread | default reranking quality |
| [U8](#u8) | Several `intents[]` widen recall on failing prompts | partly measured ([F22](evidence.md#f22)) | recall with reranking on |
| [U9](#u9) | With the reranker bypassed, retrieve returns every row that matches `filterAddOn`, up to `maxOutputDocuments` | untested; the test is [O10](runbook.md#o10) | the full migration of discovery Lanes 2 to 4 |

<a id="u2"></a>

## U2. Synonym maps widen keyword recall with no reindex

**Claim.** A synonym map assigned to content fields widens BM25 recall on `intents[].search` with no reindex, and the Retrieval API can't block it, because it lives in the index, not the request.

**Doc basis**, all from [Add synonyms to expand queries](https://learn.microsoft.com/en-us/azure/search/search-synonyms):

- "If the synonym map exists on the search service, it's used on the next query, with no reindexing or rebuild required."
- "Synonyms apply to free-form text queries only and aren't supported for filters, facets, autocomplete, or suggestions." `intents[].search` is free-form text.
- "Internally, the synonyms feature rewrites the original query with synonyms by using the OR operator."
- "Synonym expansions don't apply to wildcard search terms; prefix, fuzzy, and regex terms aren't expanded." So a synonym map and `search.ismatch('Fronteer~1', ...)` can't be stacked on one term.
- "You can define up to 5,000 rules per synonym map in a free service and 20,000 rules per map in other tiers. Each rule can have up to 20 expansions, or items in a rule." One map per field, `solr` format only, `Edm.String` or `Collection(Edm.String)` fields.

The overview lists synonym maps among the tools for queries that "benefit from rewriting, using synonym maps and LLM-generated paraphrasing to expand coverage across your content" ([Agentic retrieval overview](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview)), and the create-index criteria table has "Synonym maps / Optional / Expands queries with terminology or jargon." ([Create an index for agentic retrieval](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-create-index)).

**Test.** Build a map on a test name (for example `lessons` to `learnings, takeaways, retrospective, "what went well", "what went wrong"`) and assign it to `body` and `title`. Run the Search API BM25-only query from [A33](commands.md#a33) before and after, then the knowledge base retrieve on `ps-kb-allfields` with `resultsProcessing: "none"`. Count the returned chunks that carry lessons prose, not only the result count: OR expansion costs precision, and [F20](evidence.md#f20) shows 45 references with 2 carrying lessons prose.

**Reversible.** Removing a field's map assignment restores the previous behavior on the next query. Unassign before deleting a map: deleting a map that a field still references makes every query on that field fail with HTTP 404.

With the vector query on, BM25 is one of two lanes, so the gain may be small: on 1009338, BM25 finds 1 result for `lessons learned` and the vector query supplies the rest ([F14](evidence.md#f14)).

<a id="u3"></a>

## U3. A reranker score floor of 2.5

**Claim.** References scoring below 2.5 are dropped whatever `rerankerThreshold` says.

The number came from a documentation summary, not a sentence on a Microsoft page. The threshold itself cuts: 9 references at the default and 13 at 0 ([F11](evidence.md#f11)). A floor would sit under it.

**Test.** On `ps-kb-allfields`, run `lessons learned` with `rerankerThreshold` 0, `maxOutputDocuments` 50 on the request and the source, and `maxOutputSize` 200,000, and list `rerankerScore` across the references, lowest first. No score below 2.5 across 13 references supports the floor. Any score below 2.5 kills it.

<a id="u4"></a>

## U4. `neverQuerySource` at `minimal` effort

**Claim.** `neverQuerySource: true` on a `knowledgeSourceParams` entry keeps that source out of one request at `minimal` effort.

**Doc basis.** The [retrieve REST reference](https://learn.microsoft.com/en-us/rest/api/searchservice/knowledge-retrieval/retrieve?view=rest-searchservice-2026-08-01-preview) describes `neverQuerySource`: "Indicates that this knowledge source should be excluded from the request's candidate set and never queried at retrieval time. The exclusion is request-local and does not modify knowledge base membership. Cannot be combined with alwaysQuerySource on the same knowledge source."

**Why it's open.** The reasoning-effort page says of `minimal`: "Because all knowledge sources in the knowledge base are always searched and no query expansion is performed, behavior is predictable and easy to control. It also means the `alwaysQueryKnowledgeSource` property on a retrieve request is ignored." ([Set the retrieval reasoning effort](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-set-retrieval-reasoning-effort)). It names only the always-query property as ignored, and it says every source is always searched. [A13](commands.md#a13) failed on a typo. The corrected command is [O7](runbook.md#o7).

<a id="u5"></a>

## U5. `alwaysQuery` on a knowledge source definition

> "Set `alwaysQuery` to `true` on a knowledge source definition to include it in every query, regardless of the retrieval reasoning effort."
> [What is a knowledge source](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-overview)

This is a property of the stored knowledge source, separate from the request-level always-query property in [U4](#u4). Untested and off the critical path, because `minimal` effort searches every source anyway.

<a id="u6"></a>

## U6. Retrieve doesn't apply index scoring profiles

**Doc basis.** "It doesn't apply the underlying index's scoring profiles, including `defaultScoringProfile`." ([Query a knowledge base, Limitations](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)). "Agentic retrieval doesn't make retrieve requests honor the underlying index's scoring profiles, including defaultScoringProfile." ([Create a search index knowledge source, Limitations](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-search-index)). The create-index criteria table still has a "Scoring profile" row; [sources.md](sources.md) lists it under "Don't cite".

**Test.** Add a `defaultScoringProfile` that weights `body` and `title` heavily, then compare reference order from the same retrieve with and without it, with `resultsProcessing: "none"` so the reranker doesn't reorder. Unchanged order confirms the documentation.

<a id="u7"></a>

## U7. `prioritizedContentFields` in the semantic configuration

The reranker reads the knowledge source's semantic configuration: "For search index knowledge sources, when you enable reranking, retrieve uses the knowledge source's semantic configuration." ([Query a knowledge base, Limitations](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve)). The index has one semantic configuration, `default` ([F3](evidence.md#f3)). Its `prioritizedContentFields` haven't been read, so whether the reranker scores `body` or metadata columns is unknown. It matters only while default reranking is used; `resultsProcessing: "none"` skips the reranker.

**Test.** Read `semantic.configurations[0].prioritizedFields` from the index definition ([A23](commands.md#a23)'s command, extended) and compare it with the 13 content fields `chat_similarity` searches on the Search API.

<a id="u8"></a>

## U8. Several `intents[]` widen recall on failing prompts

**Doc basis.** "Each subquery reranks up to 50 chunks." ([Agentic retrieval overview](https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-overview)).

**Measured.** 4 intents in one request returned 57 references, per-intent counts 4, 21, 50 and 13, on the production knowledge base ([F22](evidence.md#f22)).

**Not measured.** Whether per-intent windows keep their own precision, whether references from separate intents deduplicate, and whether several intents recover the failing prompts. The decomposer emits one `search_text` today and could emit several:

```
  intents[0]  "lessons learned"
  intents[1]  "what went well on this project"
  intents[2]  "what went wrong, issues and challenges encountered"
  intents[3]  "recommendations for future projects"
  intents[4]  "key takeaways and drivers of success"
```

**Test.** Send these five on `ps-kb-allfields` for 1009338, once with default reranking and once with `resultsProcessing: "none"`, and record references per intent, duplicate `psr_row_id` values across intents, and chunks carrying lessons prose. With `resultsProcessing: "none"` and `maxOutputSize` 200,000 one intent already reaches parity ([F16](evidence.md#f16)), so this matters only if default reranking is kept. Test it separately from [U2](#u2), or a gain can't be attributed.

<a id="u9"></a>

## U9. Retrieve returns every matching row with the reranker bypassed

**Claim.** With `resultsProcessing: "none"`, `maxOutputDocuments` 200 and `maxOutputSize` 200,000, a retrieve returns every row that matches `filterAddOn`, up to 200. The distinct `project_id` values in the references then equal the Search API's facet on `project_id` for the same filter.

**Why it's plausible.** With the reranker bypassed, candidates follow `maxOutputDocuments`: 200 at 200 ([F13](evidence.md#f13)).

**Why it's open.** On project 1012173, `*` with `resultsProcessing: "none"` and 200 documents returned 50 of 88 chunks, unexplained ([F18](evidence.md#f18)). No run has compared a retrieve against a facet on the same filter.

**Test.** [O10](runbook.md#o10). It decides whether discovery Lanes 2 to 4 have a route on the Retrieval API ([search-api-parity.md](search-api-parity.md#complete-project-enumeration)).
