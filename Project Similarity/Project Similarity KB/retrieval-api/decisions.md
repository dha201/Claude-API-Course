# Decisions

Each decision had a real alternative that was rejected for a stated reason.

<a id="adr-1"></a>

## ADR 1: No model on the knowledge base

- **Decision.** Keep `models` empty and `retrievalReasoningEffort: minimal`.
- **Rejected alternative.** Attach a model to reach `low` or `medium` effort and the query planner.
- **Why.** The vector query already runs at `minimal` ([F8](evidence.md#f8)), and Microsoft defines `minimal` as issuing "direct text and vector searches" ([sources.md](sources.md)). A model adds Azure OpenAI tokens and a planning stage against the 30-second target, and the decomposer already plans the query.
- **Revisit when.** `outputMode: answerSynthesis` or model query planning is wanted. A knowledge base LLM must be a native Azure OpenAI or Foundry endpoint, not an APIM proxy ([runbook.md, Operating notes](runbook.md#operating-notes)).

<a id="adr-2"></a>

## ADR 2: Test on sibling objects, never on the production knowledge source

- **Decision.** Test with `ps-ks-allfields`, `ps-kb-allfields` and `ps-kb-isolated`.
- **Rejected alternative.** Edit `knowledgesource-1788979786196` in place.
- **Why.** `searchFields` is fixed on the knowledge source, and the DEV pipeline queries the production one. A sibling keeps DEV working and gives an A/B pair over identical index content.
- **Revisit when.** [O2](runbook.md#o2) moves the working configuration onto the objects `chat_similarity` uses.

<a id="adr-3"></a>

## ADR 3: Don't store `queryHints`

- **Decision.** Keep filter generation in the decomposer.
- **Rejected alternative.** Filter hints and boosts on the knowledge source.
- **Why.** The blockers table in [search-api-parity.md](search-api-parity.md#query-hints-and-why-querytype-shows-full).
- **Revisit when.** The pipeline moves above `minimal` and off `gpt-4o`, and a `multiWordExpression` boost for phrases such as "lessons learned" is wanted. That hint kind duplicates nothing the decomposer does.

<a id="adr-4"></a>

## ADR 4: Call the Retrieval API over REST, not MCP

- **Decision.** Keep `POST /knowledgebases/{kb}/retrieve`.
- **Rejected alternative.** The knowledge base MCP endpoint, `/knowledgebases/{kb}/mcp`, with the `knowledge_base_retrieve` tool.
- **Why.** `search.ismatch` lives in `knowledgeSourceParams.filterAddOn`, and Microsoft doesn't publish the MCP tool's input schema. `KB_TRACE` reads `activity` in the REST shape, and the retrieve page says the MCP tool result differs from the REST response shape.
- **Revisit when.** [O8](runbook.md#o8) shows `filterAddOn` in the MCP input schema and a Foundry-hosted agent needs to call the knowledge base directly.

<a id="adr-5"></a>

## ADR 5: Bypass the reranker and raise the output budget for the evidence fetch

- **Status.** Proposed. Confirmed or rejected by [O2](runbook.md#o2).
- **Decision.** On each evidence retrieve, send `resultsProcessing: "none"`, `maxOutputDocuments` 50 on the request and the source, and `maxOutputSize` 200,000. Send no `rerankerThreshold`.
- **Rejected alternatives.** Default reranking returns 4 to 25 references and drops a "lesson" chunk on 2 of 8 projects ([F16](evidence.md#f16)). `rerankerThreshold` 0 keeps 13 of 50 on 1009338, and the default budget still caps what's left ([F11](evidence.md#f11), [F12](evidence.md#f12)).
- **Why.** These settings match the Search API on all eight projects ([F16](evidence.md#f16)) and return the same 50 chunks on 1009338 ([F15](evidence.md#f15)).
- **Cost.** References carry no `rerankerScore`, so the narrow-down gate in spec work item 8 needs another signal. Fifty chunks per project cost more tokens than 4 to 25 ([O4](runbook.md#o4)).
- **Revisit when.** [O4](runbook.md#o4) shows the token or latency cost breaks the 30-second target, or the 50 chunks carry too little lessons prose.

<a id="adr-6"></a>

## ADR 6: Remove `searchFields` from the evidence knowledge source

- **Status.** Proposed. Confirmed or rejected by [O2](runbook.md#o2).
- **Decision.** Omit `searchFields` on the knowledge source the evidence fetch uses, so every searchable field is in scope, `content_vector` included.
- **Rejected alternatives.** Keeping the production 29-field list turns the vector query off ([F9](evidence.md#f9)). A narrow list that names `content_vector` keeps the vector query on ([F10](evidence.md#f10)), but whether the keyword lane stays limited to the listed fields and whether the service stores the list as sent are unproven ([O5](runbook.md#o5)).
- **Why.** Omitting the list depends on nothing unproven and gave the parity result ([F16](evidence.md#f16)).
- **Revisit when.** [O5](runbook.md#o5) passes and a narrower keyword scope is measured to improve precision.

<a id="adr-7"></a>

## ADR 7: Migrate fully to the Retrieval API

- **Status.** Accepted as the goal. The routes for discovery Lanes 2 to 4 are unproven ([O10](runbook.md#o10)).
- **Decision.** Every retrieval call in `chat_similarity` goes through the knowledge base retrieve request, and no Search API call remains. [search-api-parity.md](search-api-parity.md) maps every call site to its route.
- **Rejected alternative.** A hybrid that keeps facets, counts, field-value lookups and sorts on the Search API behind a retrieval boundary, with ranking and document fetch on the Retrieval API.
- **Why.** The migration target is one retrieval path, through the knowledge base.
- **Cost.** The retrieve request has no `facets`, `count`, `orderby` or `skip`. Lanes 2 to 4 depend on enumerating matching projects in code, at most 200 rows per call ([F6](evidence.md#f6)), with completeness unproven ([U9](staging-findings.md#u9)). The MCP server fallback rules out `minimal` effort: "The minimal retrieval reasoning effort isn't supported. Use low or medium instead." ([MCP server knowledge source, Limitations and considerations](https://learn.microsoft.com/en-us/azure/search/agentic-knowledge-source-how-to-mcp-server)).
- **Revisit when.** [O10](runbook.md#o10) fails and no other route inside the Retrieval API is found.
