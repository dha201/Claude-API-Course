# Ground truth

The Azure AI Search Retrieval API cannot replace the Search API with a direct request translation. The APIs retrieve from the same index, but their contracts expose different controls.

The evidence-fetch path has a proven configuration that matches the Search API on eight projects ([F16](evidence.md#f16)). The rest of `chat_similarity` needs harness changes, data changes, and tests before a full migration can proceed.

This document defines that work. It explains why the migration needs more than a new API client, which changes affect the harness, and which tests must pass before the Search API can be removed.

## Migration boundary

`chat_similarity` currently uses Search API calls for more than document retrieval. The harness also finds projects, groups project data, counts matching projects, sorts projects by stored values, selects authoritative sources, ranks candidates, and applies access rules.

The Retrieval API does not expose all of those operations in its request contract. A direct replacement therefore loses behavior, even when the API returns documents.

The first 16-prompt comparison showed this gap: 12 answers were worse, 2 were the same, 1 declined on both paths, and 1 was mixed ([F23](evidence.md#f23)). That run used a configuration that disabled vector retrieval, so it is a pre-fix baseline rather than a final migration result.

## Why the harness must change

The Search API lets the harness ask the service to group, count, sort, scope fields, use a separate rerank query, and return ranking scores. The Retrieval API abstracts those controls and uses different request and response shapes.

This changes where the work happens. The Search API performs some operations inside the service. The Retrieval API requires the `chat_similarity` harness to perform those operations after retrieval.

Today, the temporary translation path drops Search API inputs that the Retrieval API does not accept ([retrieval-api-migration-spec.md](retrieval-api-migration-spec.md#3-retrieval-layer)). That behavior prevents an accurate migration because dropped inputs can silently change an answer.

The new retrieval layer must state the business operation each caller needs. It must create the correct Retrieval API request or requests, then apply the required grouping, counting, sorting, and validation in the harness.

## Work required

| Workstream | Harness change | Why this work is needed | Status |
|---|---|---|---|
| Retrieval layer | Replace Search API request builders with one Retrieval API interface. | Each current call uses Search API-only controls. The new interface must reject unsupported behavior rather than drop it. | Design |
| Project discovery | Split discovery into relevance retrieval, structured-field matching, sorting, and count paths. | The Retrieval API has no direct group, count, or sort request. | Design |
| Project enumeration | Retrieve matching record rows, then group, count, and sort project IDs in code. | Exact project lists, totals, and ranked lists depend on complete enumeration. | Design |
| Project state | Add gate coverage to indexed document data and read it during project profiling. | A missing gate list can cause the harness to skip evidence for a project. | Design |
| Evidence fetch | Use the proven Retrieval API configuration for each named project. | The direct configuration returned too few documents. | Proven for eight projects |
| Ranking and narrow-down | Replace the Search API ranking score used for project order and user clarification. | The evidence configuration does not return the same ranking score. | Design |
| Field scope and fuzzy match | Build text-match filters for field-specific, all-word, and fuzzy requests. | The Retrieval API does not accept the Search API field-scope request control. | Syntax only |
| Access control | Apply source-specific access rules on every retrieve request and inspect returned citations. | The same data boundary must remain after the API switch. | Design |
| Trace and regression tests | Record each operation and compare answers against the Search API baseline. | The migration needs proof that one change does not break another path. | Design |

## Proven result: evidence fetch

The Retrieval API can return the same evidence chunks as the Search API. On project `1009338`, the working configuration returned the same 50 chunks as the Search API ([F15](evidence.md#f15)). It also matched result and lesson counts on all eight test projects ([F16](evidence.md#f16)).

This result proves only the document-evidence path. It does not prove project discovery, exact counts, sort order, access control, or the final answer behavior.

The implementation work includes applying this configuration to `chat_similarity`, isolating the evidence source where needed, and rerunning the project and prompt tests ([O2](runbook.md#o2), [O7](runbook.md#o7)).

## Changes to the `chat_similarity` harness

### 1. Replace request translation with operation-based retrieval

The harness must stop translating Search API payloads field by field. Each caller must instead state the result it needs: ranked documents, matching project IDs, an exact count, a stored-value order, or field-specific text matching.

The retrieval layer then selects a tested Retrieval API route. A request with no route must fail in the trace. It must not return a partial answer that appears complete.

### 2. Rebuild project lists, counts, and sort order

The Search API returns grouped project IDs and exact totals. The Retrieval API returns retrieved rows and does not provide the same group, count, sort, or pagination controls.

The harness must retrieve record rows, remove duplicate project IDs, count the project IDs, and sort records by their stored values. The design still needs a completeness test, especially when more than 200 rows match ([O10](runbook.md#o10)).

### 3. Preserve project state and source priority

The harness uses project state to decide which source is authoritative for each topic. The current state logic reads a gate list from a Search API grouping result.

The Retrieval API has no equivalent group result. The ingestion path must stamp gate coverage onto each document chunk so the harness can read state from retrieved data ([O6](runbook.md#o6)).

### 4. Replace the ranking and clarification rule

The Search API gives the harness a ranking score. The current harness uses it to order projects and decide when the user must narrow a request.

The evidence configuration prioritizes complete evidence and does not return that score. The harness needs a different ranking signal or a separate ranking request. Both options need tests ([U15](staging-findings.md#u15)).

### 5. Preserve field-specific search behavior

The Search API lets the harness search named fields and require all words. It also supports fuzzy title matching through its request contract.

The Retrieval API moves this behavior into a text-match filter. The service accepted the filter syntax, but the harness still needs end-to-end answer tests ([F21](evidence.md#f21), [O9](runbook.md#o9)).

### 6. Preserve access control and observability

Every Retrieval API request must apply the same source-specific access rules as the Search API. The harness must compare returned project IDs, document references, and citations against the current path.

The trace must record the requested operation, filters, project IDs, result counts, and references. This makes each answer reproducible and shows whether a route has incomplete data.

## Delivery sequence

| Stage | Deliverable | Depends on | Proof of completion |
|---|---|---|---|
| 1 | Retrieval layer | Nothing | Unsupported operations fail visibly. |
| 2 | Evidence-fetch configuration | Nothing | Eight-project evidence test matches the Search API. |
| 3 | Gate coverage data change | Ingestion change | Projects without record rows still receive evidence. |
| 4 | Discovery and enumeration | Retrieval layer and record data | Project lists, counts, and sort order match the Search API. |
| 5 | Field scope and ranking | Retrieval layer | Target prompts return the expected projects and answers. |
| 6 | Access control and trace | Retrieval layer | Authorized data matches the Search API and all results have a trace. |
| 7 | Regression suite | Stages 2 through 6 | Eight-project and 16-prompt tests pass. |

Stages 1, 2, and 3 can start now. Stages 4 through 7 depend on the new retrieval layer and the data change.

## Tests and acceptance criteria

The migration must pass these tests before the Search API path is removed:

1. The evidence-fetch configuration returns the same chunks as the Search API on the eight-project test.
2. The 16-prompt evaluation reruns with vector retrieval active.
3. Project enumeration returns the same project set, exact count, and required stored-value order.
4. A project without a record row still receives evidence when its indexed documents show gate coverage.
5. Field-specific, all-word, and fuzzy queries return the expected projects.
6. Access-control tests return the same permitted projects, documents, and citations as the Search API.
7. The ranking and narrow-down rule has measured behavior for the full prompt set.
8. The trace reproduces each answer from its requested operation, filters, project IDs, and references.
9. Token use and wall-clock time remain within the 30-second target.

## Effort and risk drivers

The main effort is not the API client. The main effort is rebuilding Search API behavior in the harness where the Retrieval API contract does not provide it.

The highest-risk work is complete project enumeration, project-state preservation, ranking replacement, and access-control parity. Each one changes answer correctness, not only request syntax.

The evidence-fetch result gives a proven starting point. Full migration remains a system change that needs application work, data work, and regression proof.

## Evidence index

| Topic | Source |
|---|---|
| Current factual state and proven configuration | [ground-truth.md](ground-truth.md) |
| Capability route and status | [search-api-parity.md](search-api-parity.md) |
| Work items and dependencies | [retrieval-api-migration-spec.md](retrieval-api-migration-spec.md) |
| Measurements | [evidence.md](evidence.md) |
| Open tests | [runbook.md](runbook.md) |
| Decisions | [decisions.md](decisions.md) |
