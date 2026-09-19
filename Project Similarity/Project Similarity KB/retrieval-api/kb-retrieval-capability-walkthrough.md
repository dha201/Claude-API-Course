# Can the Knowledge Retrieval API replace the Search API in chat_similarity?

**Short answer: not as a drop-in replacement.** Configuration brings the evidence fetch to parity with the Search API ([F16](evidence.md#f16)). Grouping, counting and sorting have no parameter in the retrieve contract, and they break project state, Source Priority and every "how many" or "top N by" question ([F17](evidence.md#f17), [F23](evidence.md#f23)).

Both APIs hit the same index, the same chunks and the same vectors. So the remaining gap isn't ranking quality. It's which operations the request can ask for.

Findings ([F1](evidence.md#f1) to [F23](evidence.md#f23)), open items ([O1](runbook.md#o1) to [O9](runbook.md#o9)) and decisions ([ADR 1](decisions.md#adr-1) to [ADR 7](decisions.md#adr-7)) link to the finding, open item or decision. [README.md](README.md) maps the documents.

## The toy index

To make the mechanics concrete, imagine the whole index is these 10 chunks. The real index works the same way.

```
chunk  project  vendors      roles_work_lead  gate_label   title
  1      P1     Kinaxis      Yusoff           Closeout     MITAS Platform
  2      P1     Kinaxis      Yusoff           Gate 1       MITAS Platform
  3      P1     Kinaxis      Yusoff           Gate 2       MITAS Platform
  4      P2     Kinaxis      Ray              Closeout     FronTier Upgrade
  5      P3     Microsoft    Yusoff           Closeout     Learnings Management
  6      P4     Kinaxis      Sara             Gate 3       Quito Decommission
  7      P4     Kinaxis      Sara             Closeout     Quito Decommission
  8      P5     SAP          Yusoff           Closeout     SDWAN2023
  9      P5     SAP          Yusoff           Gate 1       SDWAN2023
 10      P6     AMAZON       Tom              Closeout     Apex
```

## The 4 operations discovery needs

chat_similarity's discovery stage runs 4 operations. The Retrieval API does the first directly and the fourth through a filter function.

```
                    Search API       Retrieval API
1.  Rank chunks     ✓                ✓
2.  Group by field  ✓ facets         ✗ no parameter
3.  Count, sort     ✓ count/orderby  ✗ no parameter
4.  Pick the field  ✓ searchFields   ✓ via search.ismatch in filterAddOn
```

## Operation 1: ranking, and how a retrieve cuts results

Ranking works on both APIs once the knowledge source and the request are set up right. A retrieve runs three stages per knowledge source, and each one can cut results:

```
  601 Closeout chunks (project 1009338)
        │
        ▼
  1. retrieval    BM25 over searchFields + vector query ──► candidates
        │         an explicit searchFields list without content_vector
        │         switches the vector query off (F9)
        ▼
  2. reranker     semantic ranker drops candidates below rerankerThreshold
        │         resultsProcessing "none" skips it (F11)
        ▼
  3. output       token budget (maxOutputSize) caps the references (F12)
        │
        ▼
  references
```

The production knowledge source loses at all three: its field list turns the vector query off, the reranker drops candidates, and the default token budget caps what's left. Remove the list, bypass the reranker and raise the budget, and the knowledge base returns the same 50 chunks as the Search API on project 1009338 ([F15](evidence.md#f15)) and the same counts on all eight test projects ([F16](evidence.md#f16)). The settings are in [Configuration that works](ground-truth.md#configuration-that-works).

## Operation 2: grouping. Count, project state and Source Priority break the most

The question "which projects carry Kinaxis" needs one answer per project. A facet is exactly that: group and count.

```
filter: vendors contains Kinaxis   →  rows 1,2,3,4,6,7

facet on project_id collapses them:

   P1 (3)   P4 (2)   P2 (1)

   bucket names  → which projects: P1, P2, P4
   bucket count  → how many:       3
```

The Retrieval API has no facet. It ranks chunks and returns the top-ranked ones. On the toy data, P1 is document-heavy, so it takes the slots and P2 and P4 never appear.

```
   Retrieval API, top chunks:

   rank 1: chunk 1 (P1)
   rank 2: chunk 2 (P1)     ← P1 crowds the rest out

   P2 and P4 are invisible.
```

On the real index the same question got 3 tagged projects from the Search API and 1 project from the Retrieval API ([F23](evidence.md#f23), row 3).

A facet and `searchFields` answer different questions:

- `searchFields` decides where the text search looks.
- A facet decides how the matched chunks distribute across a field's values.

For a schedule question, `searchFields` finds the chunks whose text mentions schedule, then a facet on `project_id` groups them.

### This is also the Source Priority failure

Source Priority is the business rule for when two source systems disagree. WPM, PECT and PSR often record the same fact differently, so the pipeline ranks the sources and takes the most authoritative one. That rule depends on grouping in two steps.

First, the pipeline fetches the authoritative source for the topic, keyed by the project's state: Closed, Active-past-G3 or Unknown. For lessons:

```
lessons + Closed  →  [Closeout doc, lessons_learned_log]
lessons + Unknown →  []   (empty: nothing is fetched)
```

State comes from the record row's `work_status` first and the `gate_label` facet second. With no facet, a project without a record row reads Unknown, and at Unknown the lessons rule fetches nothing. That's what happened to project 1012329 in the eight-project run ([F17](evidence.md#f17)).

Second, when two fetched sources still disagree, the answering model takes the lower priority number. That part survives either API. It fails upstream on the Retrieval API: with no state, nothing authoritative is fetched, so the conflicting pair never reaches the model.

## Operation 3: count and sort

**Count.** "How many SAP projects" should answer 47, one number, independent of what was retrieved. The retrieve request has no count, so the Retrieval API can only count what it happened to retrieve, and it gave no total ([F23](evidence.md#f23), row 6). A wrong answer, not a smaller one.

**Sort.** "Top 10 Hardware Deploy by spend" must order by the stored actuals number. The retrieve request has no `orderby`, so it returns the chunks with the highest relevance. ZEST 1012929, sixth by spend, was missing from the Retrieval API answer ([F23](evidence.md#f23), row 12).

## Operation 4: pick the field. Where the workaround lives

The Search API lets the question say "look only in roles_work_lead." The retrieve request has no such parameter, so every question searches the `searchFields` list stored on the knowledge source.

The filter language has a function, `search.ismatch(...)`, and both APIs speak the filter language:

```
                 ┌─────────────────────────────────────┐
 Search API      │ filter:     search.ismatch(...)     │  ──► same parser
 Retrieval API   │ filterAddOn: search.ismatch(...)    │  ──► same parser
                 └─────────────────────────────────────┘
```

Its four slots restore what the Retrieval API hides:

```
search.ismatch(
    'Yusoff',                                 ← find this
    'roles_project_sponsor,roles_work_lead',  ← in these fields  (field scoping)
    'full',                                   ← Lucene language   (fuzzy/prefix)
    'all'                                     ← every word        (all-word match)
)
```

The `'full'` here is the filter's own parser, not the request's. `search.ismatch` parses its own search string, so it takes the same `queryType` and `searchMode` arguments the Search API request takes. The request-level query type stays locked to semantic. Two strings, two parsers.

The service accepts these filters and returns documents, and the misspelled "Fronteer" matched with `'Fronteer~1'` and `'full'` where it matched nothing without the filter ([F21](evidence.md#f21)). The full argument reference is in [search-ismatch-reference.md](search-ismatch-reference.md#field-scope-fuzzy-and-all-word-matching-through-searchismatch).

### The catch

`search.ismatch` is a gate, not a ranker. It decides which documents qualify and adds nothing to how they're ordered.

```
   all chunks ──► [ qualify? vendors has all of "Amazon Web Services" ] ──► some pass
                                                                          │
   ordering still comes from the knowledge base's hybrid search, untouched ◄┘
```

Two hard limits:

- It can't run inside a lambda, so `vendors/any(v: search.ismatch(...))` is rejected. Top level is fine.
- The scoring variant, `search.ismatchscoring`, feeds the score, so it can move a document up the ranking. It's still a gate first.

## How the four operations run: parallel lanes, two merges

The four operations aren't sequential. They read the same fixed inputs and return independent results, so discovery fires all four at once.

```
                    question + filter
                          |
        +---------+-------+---------+
        |         |       |         |
    1. content  2. facet 3. sort  4. facet
       search    member-  by a     count
       (hybrid)  ship     number
        |         |       |         |
        +---------+---+---+---------+
                      |
              merge at project grain
```

There are two merges at different grains. The chunk merge sits inside the content search: the precision filter (every clause) and the recall filter (strict clause dropped) run as two searches, and their chunks merge and deduplicate. The project merge sits outside: the sorted IDs, the member IDs and the content search's ranked IDs combine at project grain, sorted and members first, so a confirmed member the text search ranked out still survives the final top-k cut.

Facet results and hybrid results never mix chunk by chunk. They merge as project ID lists.

## The full table

```
                    what the question needs     Search API   Retrieval API
1.  Rank chunks     documents that read alike      ✓             ✓ with the settings in F16
2.  Group           one bucket per project         ✓ facet       ✗ no parameter
3a. Count           the exact total                ✓ count       ✗ no parameter
3b. Sort            order by a stored number       ✓ orderby     ✗ no parameter
4a. Scope the field look only in the roles field   ✓             ✓ via ismatch
4b. Fuzzy match     survive a misspelling          ✓             ✓ via ismatch
4c. All words       every word of the vendor name  ✓             ✓ via ismatch
```

The 16-prompt evaluation ran on the production knowledge source, where the vector query was off ([F23](evidence.md#f23)). Its 12 worse answers mix rows 2 and 3 with the evidence-fetch loss that row 1's settings now fix, so it needs a rerun ([O2](runbook.md#o2)).

## The verdict

The Retrieval API can't replace the Search API for chat_similarity as it stands. Ranking reaches parity with configuration. The blocking gap is grouping, because counting, project state and Source Priority all hang off the facet. Field scoping, fuzzy matching and all-word matching have a path through `search.ismatch` in `filterAddOn`.

"No parameter" describes the retrieve contract. Whether a workaround exists is open: an MCP server knowledge source could return counts and groups computed by our own code ([O6](runbook.md#o6)). Whether `search.ismatch` fixes the failing prompts end to end is also open ([O9](runbook.md#o9)).

## Query hints: the remaining knob, and why it doesn't help chat_similarity

`queryHints` (stored on the knowledge source) and `queryHintOverrides` (per request, replaces the stored object whole) are natural-language instructions to the query-planning model. There are three kinds: filter hints, `fieldValue` boosts and one `multiWordExpression` boost. `boostInstructions` is free text telling the planner when to apply a boost.

A concrete example. Say the index has a `language` field and users ask in mixed languages. Store this once on the knowledge source:

```json
"queryHints": {
  "boosts": [{
    "kind": "fieldValue",
    "field": "language",
    "fieldValues": ["en-US", "ja-JP"],
    "boost": 2.0,
    "boostInstructions": "Prefer the language requested by the user."
  }]
}
```

A user asks "Find Japanese service guidance for Model-X200." The planner reads `boostInstructions`, sees "Japanese," and rewrites the query:

```
user text     "Find Japanese service guidance for Model-X200"
                          |
              planner LLM reads boostInstructions
                          |
generated     language:(ja\-JP)^2        ← Lucene boost, weight 2.0
                          |
              queryType flips to "full" to run it
                          |
result        Japanese docs rank higher. English docs still returned.
```

A boost lifts rank. It never excludes. It fits a small closed vocabulary where a miss is survivable: language preference, product family names, domain phrases like "deferred tax" that mean nothing as separate words. It doesn't fit a guarantee, an exact count, or a value set too large to enumerate.

### Why it doesn't map to our filters

```
"find all key roles for project X"

OURS                                    queryHints filter hint
────                                    ────────────────────────
decomposer LLM emits a filter           planner LLM may emit a filter
      |                                       |
guard validates against                 must pre-list every allowed
ENUM_FIELD_VALUES; free_text            value, exhaustively, 5 hints
fields get demoted to search text       max, 2,048 chars per hint
      |                                       |
_facet_member_ids:                      no facet exists
  searchMode=all, queryType=simple            |
  top=0, facets=project_id              returns narrowed chunks,
      |                                 still ranked
exact project ID list + exact count
```

A filter hint lines up with our filter building, not our facet. It can't substitute even there: `roles_work_lead` holds thousands of person names that no hint can enumerate, and our guard is deterministic where a hint is best effort. The decomposer already does what the hint planner does, grounded in real enum sets, with a demotion path. The documented blockers are in [search-ismatch-reference.md](search-ismatch-reference.md#query-hints-and-why-querytype-shows-full), and the decision is [ADR 3](decisions.md#adr-3).

## Why "key roles" works on the knowledge base and "lessons" didn't

Same question shape, opposite outcomes, because the two answers live in different places.

Roles are metadata. The `roles_*` fields are project metadata stamped onto every chunk of the project, and the knowledge source returns them in `sourceData` on every reference. Any sample of the project's chunks carries the full answer, so even one reference is enough.

Lessons are content. They sit in a handful of Closeout chunks, and those chunks have to be retrieved. On the production knowledge source the vector query was off and BM25 found 1 to 4 results per project, so the flow reported "no lessons found" for projects whose lessons are on file ([F17](evidence.md#f17)). With the vector query on, the reranker bypassed and the budget raised, every project returns the same lesson-mentioning chunks as the Search API ([F16](evidence.md#f16)).
