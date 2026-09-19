1. So for failure B on KB, what exactly is the cause then? You realized that the vector profile is setup on the index and we are expecting that the RETRIEVAL API is using hybrid (BM25 + Vector comparison --> RRF) as the default based on MS doc right? or atleast I thought it was but doesn't seem to be the case here? Are we missing something here?

2. We should focus on this: "Get the KB to run vector search        The index vectorizer exists and is correctly configured. Worth investigating whether source config or a KB model unlocks it — retrievalReasoningEffort > minimal requires a KB model and is untested." - we need to test if the vector profile works first then see if we can get the KB to run vector search with it. Can you get me steps on how to do this?

 

 

 

 

 

 

 

 

 

 

 

From the following, can you explain why the RETRIEVAL's query planner decides to use QueryType: "full" to run it instead of semantic or simple?

 

"""

3. Query hints, with the examples that were missing

What it does, concretely. Say the index has a language field and users ask in mixed languages. You store this once on the knowledge source:

```

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

 

User asks "Find Japanese service guidance for Model-X200." The planner reads boostInstructions, sees "Japanese," and rewrites the query:

 

```

user text     "Find Japanese service guidance for Model-X200"

                          │

              planner LLM reads boostInstructions

                          │

generated     language:(ja\-JP)^2        ← Lucene boost, weight 2.0

                          │

              queryType flips to "full" to run it

                          │

result        Japanese docs rank higher. English docs still returned.

```

A boost lifts rank. It never excludes.

 

-----------------------

 

 

 

 

Also for "3. Query hints, with the examples that were missing" , you said:

"

When it's worth using: you have a small closed vocabulary, you want ranking nudged toward it, and a miss is survivable. Language preference. Product family names. Domain phrases like "deferred tax" that mean nothing as separate words.

 

When it isn't: you need a guarantee, an exact count, or a value set too large to enumerate.

"

 

Isn't this what the decomposer LLM in chat_similarity is already doing since it the decomposer is what the RETRIEVAL's Query Planner LLM is right or at least it is designed/intended to perform what the Query Planner does/function?

 

 

---------------------------

TIED to the above,

 

Given the following, we need to go through all of the features that KB abstracts away that our chat_similarity supports.

 

```

4. filterInstructions vs our code. Your instinct is right.

Compared against sources.py:847-870 and field_policy.py:55-80.

 

"find all key roles for project X"

 

OURS                                    queryHints filter hint

────                                    ────────────────────────

decomposer LLM emits a filter           planner LLM may emit a filter

      │                                       │

guard validates against                 must pre-list every allowed

ENUM_FIELD_VALUES; free_text            value, exhaustively, 5 hints

fields get demoted to search text       max, 2048 chars total

      │                                       │

_facet_member_ids:                      no facet exists

  searchMode=all, queryType=simple            │

  top=0, facets=project_id              returns narrowed chunks,

      │                                 still ranked, still capped at 50

exact project ID list + exact count

 

So a filter hint lines up with our filter building, not our facet. Two reasons it can't substitute even there:

 

roles_work_lead holds thousands of person names. Filter hints need the complete allowed list, capped at 2048 characters across all hints. You can enumerate project_solution. You can't enumerate people.

Our guard is deterministic. Invalid enum value, it demotes to search text. A planner hint is best-effort with no fallback.

And a filter narrows rows. Our facet groups them. "Find all key roles" needs one bucket per project, which no hint produces.

 

Worth noting: our decomposer already does what the hint planner does, grounded in real enum sets, with a demotion path. Adding queryHints would be a weaker second copy of logic we own.

```

 

 

 

 

 

 

 

 

 

 

 

 

 

 

 

 

 

1. So based on this:

"

RETRIEVE REQUEST

│

├─ intents[].search  "lessons learned"   ← main search text

│     parsed and ranked by: queryType SEMANTIC, locked, no parameter

│

└─ filterAddOn  "search.ismatch('Fronteer~1','title','full','any')"

      parsed by: queryType FULL  ← we pass this, third argument

"

--> We care about the result, not the method, as long as we can get the same result but using different methods is fine. Given that, the question here is that how can we compare the result between using `.ismatch()` with full vs simple vs without either and just intents[].search - how does the result differ? We need to actually run this to see, but before that, we need to find the best fitting prompt that would require the pipeline to search using the different querytype with simple, full and semantic. We know that this prompt is good but it doesn't cover everything that we need to test our hypothesis: "Extract all lessons learned for these eight project IDs: 1009338, 1009392, 1010069, 1011517, 1011718, 1011742, 1012268, 1012329. Structure the result by project number and name, brief description, and interpret whether each lesson learned is positive or negative impact and categorize the theme of the learning (if you cannot interpret the impact category, just show the exact lesson learned)." So the first step here is to find the best candidate prompts that we can use to test with. Can you show find them and map them + reasoning why?

 

2.  I also see this:

"Disable reranking for a knowledge source (preview)

Starting with the 2026-08-01-preview API version, set "resultsProcessing": "none" on a knowledgeSourceParams entry to bypass reranking for a specific knowledge source and preserve its underlying result order. You can also store resultsProcessing on the knowledge source as its default. All knowledge source kinds support this property.

" from https://learn.microsoft.com/en-us/azure/search/agentic-retrieval-how-to-retrieve?tabs=2026-08-01-preview%2Ccitation-2026-08-01-preview&pivots=csharp#limitations:~:text=Disable%20reranking%20for%20a%20knowledge%20source%20(preview). Why are not considering this?

 

From (1) we need to compare RETRIEVAL method against what SEARCH equivalent. List all of them out so we know what to test for and how they differ.

 

3.  What is the differences between the API vs MCP for KB RETRIEVAL?

 

Can you show what are all of the param that can go inside of filterAddOn === search.ismatch()? Make sure to search MS and cite it as inline. Make sure to break down each param and what they can hold like a tutorial.