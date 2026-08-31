# DBR/LDP Integration: retrieval index vs. SQL Agent

## Decision

Serve DBR and LDP through a dedicated SQL Agent service, or denormalize both into the existing project similarity index.

## Option A: denormalize into the retrieval index

DBR and LDP are project-scoped metadata, the same shape as WPM and PECT, which are already indexed. Retrieval is single hop.

A compound query like the following resolves in one search against one index:

> "Return all projects under Kinesis, then project the cost-benefit fields from their DBRs"

Storing the fields together in the same index also improves recall. A question mentioning a DBR or LDP term can now match a project through keyword search.

With a separate SQL Agent, the orchestrator has to do this in sequence:

1. Call Project Similarity to identify the relevant projects.
2. Wait for that result.
3. Extract the returned project IDs or other identifiers.
4. Call the SQL Agent to retrieve DBR/LDP information for those projects.
5. Combine the two results into one final answer.

**Tradeoff:** DBR and LDP fold into the project similarity service and stop being separately deployable or callable. A future product that needs DBR alone has to query similarity search and discard the ranking.

## Option B: SQL Agent

Querying the database directly removes staleness. There is no ingestion pipeline to build or refresh, so every query reads the current state of the source of truth.

### LDP sample runs

| # | Query | Result | Latency | Cost |
|---|---|---|---|---|
| 1 | Title and learning theme for all positive learnings | 2 cols, 5 rows | 46s | $0.14 |
| 2 | Which learning themes contain the most positive learnings? | All 5 tied at 1; 2 cols, 5 rows | 45s | $0.15 |
| 3 | Any learning themes with zero positive learnings? | 3 cols, 3 rows | 48s | $0.16 |
| 4 | Title, captured date, recommended actions where title matches "Pedro" | 3 cols, 3 rows | 46s | $0.15 |
| 5 | Row count of learnings | 10 rows in dbo.Learnings | 40s | $0.13 |
| 6 | Title, description, recommended actions where workId = 1011121 | 3 cols, 4 rows | 40s | $0.15 |

### Benchmarks

| Metric | Value |
|---|---|
| SQL Agent step | 15-20s (13s query generation, 1s execution) |
| End-to-end latency | ~40s, >50% attributable to LLM inference |

**Tradeoff:** Compound questions pay for two sequential LLM calls. Observed latency of 40 to 48 seconds already exceeds the 30 second target on a single call, before chaining anything, so a question like "find projects under Kinesis, then pull their DBR/LDP fields" lands around 90 seconds. DBR and LDP text also stays out of the search index, so project search can never match or rank on it.

## Side-by-side comparison

| Area | Project Similarity with DBR/LDP data | SQL Agent |
|---|---|---|
| Data access | Reads denormalized, indexed project records from Azure AI Search | Queries the database directly |
| Best fit | Project similarity questions that also need related project metadata | Exact lookup, joins, counts, grouping, and cross-table analysis |
| Parallel execution | One retrieval call for data stored in the index | Often not possible when the SQL query needs project IDs from similarity results |
| Response time, best case | ~35s. Retrieves projects and related metadata in one search path, avoiding a dependent second tool call | ~40s |
| Response time, worst case | ~90s on a large scan | ~90s+. Adds a sequential LLM and SQL step after similarity retrieval |
| Data freshness | Depends on ingestion and index refresh | Uses the latest database data |
| Coupling | Ties DBR and LDP retrieval more closely to Project Similarity | Keeps structured retrieval separate and easier to reuse elsewhere |
| Reuse outside project search | More limited if data is shaped mainly for project retrieval | Useful for many structured-data questions beyond project similarity |


---
#### Reference:

| Memory | Holds |
|---|---|
| dbr-ldp-integration-decision | Both options, the reasoning from your voice note, why the index is winning, the coupling cost you accepted |
| sql-agent-benchmarks | All measured numbers, the six LDP queries verbatim, the 13+1 vs 15-20s discrepancy, the three caveats |
| assistant-architecture-topology | OpenShift services, index contents (PSR, WPM, PECT, Impact), hybrid search with RRF, the 30 second target |
| dbr-ldp-writeup-status | The doc's structure, the format rule you settled on, the three open items, Greg and Bushra Chowdhury |
| sql-agent-terminology | SQL Agent, not Text2SQL or NL2SQL |
| project-doc-writing-preferences | Vocabulary you rejected (cardinality, colocating, SLO), what's fine, the fan-out trap |
