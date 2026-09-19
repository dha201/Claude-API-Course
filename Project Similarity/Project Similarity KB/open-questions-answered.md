# Open questions, answered

Short answers to the questions in [open_questions.md](open_questions.md), grouped by topic. Finding IDs (F1 to F23), open items (O1 to O9) and decisions (ADR 1 to ADR 4) are in [retrieval-api-findings.md](retrieval-api-findings.md), which holds the numbers, the commands and the Microsoft quotes.

| # | Topic | Status |
|---|---|---|
| 1 | Does the Retrieval API run vector search, and why was failure B thin? | Answered: it runs; the production `searchFields` list switched it off |
| 2 | Query parsing and `search.ismatch` | Answered; the end-to-end comparison is O9 |
| 3 | Capabilities the knowledge base abstracts away | Answered; grouping, count and sort need a redesign (O6) |
| 4 | Who plans the query | Decided: the decomposer (ADR 3) |
| 5 | Call path, REST or MCP | Decided: REST (ADR 4); one check left (O8) |

```
  open_questions.md                                         →  Topic
  ──────────────────────────────────────────────────────       ─────
  Failure B: what's the cause, if the index is hybrid?      →  1
  Steps to test the vector profile, then the KB with it     →  1
  Why the planner sets queryType to "full"                  →  2
  Every search.ismatch parameter                            →  2
  Prompts to compare full, simple and neither               →  2
  Features the knowledge base abstracts away                →  3
  Retrieval API method against Search API equivalent        →  3
  resultsProcessing "none", why not considered              →  3
  Isn't the decomposer the query planner?                   →  4
  API against MCP                                           →  5
```

## Topic 1. Does the Retrieval API run vector search?

**Failure B: what's the cause, if the index is hybrid?** You were right to expect hybrid. The Retrieval API runs BM25 and the vector query through the index vectorizer (F8). The production knowledge source's explicit `searchFields` list names no vector field, and that switches the vector query off, leaving 1 BM25 hit (F9). The reranker and the default token budget cut further (F11, F12). With the list removed, reranking bypassed and `maxOutputSize` 200,000, the knowledge base matches the Search API on all eight projects (F16).

**Steps to test the vector profile, then the knowledge base with it.** Done. The vectorizer works through the proxy from the Search API (F1), it uses the model that built the index (F2), and the gibberish-token test proves the knowledge base runs the vector query (F8). A model on the knowledge base isn't needed for vector search at `minimal` effort (ADR 1). The remaining step is O2 in the application repository.

## Topic 2. Query parsing and `search.ismatch`

**Why the planner sets `queryType` to "full".** It doesn't choose it. A generated boost such as `language:(ja\-JP)^2` needs the `full` parser, so emitting a boost forces it. At `minimal` effort no planner runs, so the query reaches the index unchanged. Findings: "Query hints, and why `queryType` shows `full`".

**Every `search.ismatch` parameter.** Four arguments: the query text, a comma-separated field list, the parser (`simple` or `full`) and the search mode (`any` or `all`); the last two come as a pair. Grammar, operators, escaping, silent traps and worked examples are in the findings under "Field scope, fuzzy and all-word matching". The service accepts the syntax inside `filterAddOn` (F21).

**Prompts to compare `full`, `simple` and neither.** The eight-project prompt can't test parsing, because it names every project and no text reaches a parser. Nine candidate prompts, P0 to P8, and the arms to run are in O9. Run P0, P1, P3 and P8 first, on a knowledge source with the vector query on.

## Topic 3. Capabilities the knowledge base abstracts away

**Features the knowledge base abstracts away.** `facets`, `count` and `orderby` have no parameter in the retrieve request, and they carry the gate list, project state, Source Priority, totals and "top N by" questions (F17, F23). Field scoping, fuzzy and all-word matching come back through `search.ismatch` (F21). Whether a workaround exists for the first three is open (O6).

**Retrieval API method against Search API equivalent.** Three tables in the findings under "Search API parameters against the Retrieval API": parameters with no retrieve equivalent, parameters kept or moved onto the knowledge source, and what only the Retrieval API has.

**`resultsProcessing: "none"`, why not considered.** It's now part of the working configuration. It skips the reranker, and it looked inert at first only because the default token budget capped references at 9. Raising `maxOutputSize` to 200,000 let all 50 through (F12). It drops `rerankerScore` from references and can't be sent with `rerankerThreshold` (see "How a retrieve runs").

## Topic 4. Who plans the query

**Isn't the decomposer the query planner?** Yes, at `minimal` effort the decomposer stands in for a planner that doesn't run. It does the planner's filter job with real enum sets and a deterministic demotion path, while filter hints are best effort, can't enumerate person-name fields, don't run at `minimal` and return HTTP 400 on `gpt-4o` when stored filters exist. So we keep the decomposer and store no `queryHints` (ADR 3). Sending several `intents[]` from the decomposer is untested for precision (staging U8).

## Topic 5. Call path, REST or MCP

**API against MCP.** Same knowledge base and the same retrieve action behind two front doors. REST takes the full retrieve body; the MCP endpoint exposes a `knowledge_base_retrieve` tool whose input schema Microsoft doesn't publish, and whose result shape differs from REST. We stay on REST because the `search.ismatch` workaround needs `filterAddOn` (ADR 4). One `tools/list` call settles whether MCP can carry it (O8).
