# Implementation

Reference code for applying the configuration in [ground-truth.md](ground-truth.md#configuration-that-works) to `chat_similarity`. The decisions behind it are [ADR 5](decisions.md#adr-5) and [ADR 6](decisions.md#adr-6).

For the implementation agent working in the `chat_similarity` repository. It encodes [F9](evidence.md#f9) to [F16](evidence.md#f16). It was not run; the request bodies match the ones that ran in [A32](commands.md#a32) to [A37](commands.md#a37). It uses plain REST because `resultsProcessing` exists only from `2026-08-01-preview` (and `maxOutputSize` from `2026-05-01-preview`), and whether the `azure-search-documents` Python SDK exposes them is unchecked.

```python
import os
import requests

ENDPOINT = os.environ["AZURE_SEARCH_ENDPOINT"]
HEADERS = {"api-key": os.environ["AZURE_SEARCH_API_KEY"], "Content-Type": "application/json"}
API = "2026-08-01-preview"

KS = "knowledgesource-1788979786196"   # production knowledge source
KB = "knowledgebase-1788979805148"     # production knowledge base

# 1. Knowledge source: keep vector search on.
#    Either omit searchFields entirely, or list content_vector with the text fields.
#    A PUT replaces the whole definition, so read it first and keep everything else.
ks_url = f"{ENDPOINT}/knowledgesources/{KS}?api-version={API}"
ks = requests.get(ks_url, headers=HEADERS).json()
ks.pop("@odata.context", None)
ks.pop("@odata.etag", None)

params = ks["searchIndexParameters"]
params.pop("searchFields", None)                                   # option A: no list
# params["searchFields"] = [{"name": "body"}, {"name": "content_vector"}]  # option B: narrow list

requests.put(ks_url, headers=HEADERS, json=ks).raise_for_status()

# 2. Retrieve: reranker off, 50 candidates, token budget large enough for 50 references.
def fetch_evidence(project_id: str, query: str) -> list[dict]:
    body = {
        "intents": [{"type": "semantic", "search": query}],
        "knowledgeSourceParams": [
            {
                "knowledgeSourceName": KS,
                "kind": "searchIndex",
                "filterAddOn": f"project_id eq '{project_id}' and gate_label eq 'Closeout'",
                "includeReferences": True,
                "includeReferenceSourceData": True,   # index values in sourceData
                "resultsProcessing": "none",          # skip the L2 reranker
                "maxOutputDocuments": 50,             # 50 to 200; sets the candidate count
            }
        ],
        "maxOutputDocuments": 50,
        "maxOutputSize": 200000,                      # default budget caps references near 9
        "includeActivity": True,
        # Do NOT send rerankerThreshold with resultsProcessing "none": HTTP 400.
    }
    url = f"{ENDPOINT}/knowledgebases/{KB}/retrieve?api-version={API}"
    r = requests.post(url, headers=HEADERS, json=body)
    r.raise_for_status()
    return [ref["sourceData"] for ref in r.json().get("references", []) if ref]

chunks = fetch_evidence("1009338", "lessons learned")
print(len(chunks))  # expect 50
```

Before porting:

- The production knowledge base holds three knowledge sources ([F4](evidence.md#f4)). `knowledgeSourceParams` configures a source, it doesn't select one, so `ldp_index` and `dbr_index` are queried too. Use a single-source knowledge base for the evidence fetch, or `neverQuerySource: true` on the other two, which is untested at `minimal` effort ([O7](runbook.md#o7)).
- Changing the production knowledge source affects every caller. Try the change on `ps-ks-allfields` and `ps-kb-allfields`, or a new single-source pair, first.
- References under `none` carry no `rerankerScore`. Code that sorts or filters on it must change.
- In PowerShell, load `. .\src\api\env.ps1` (or the application's equivalent) first: a missing key makes every call fail with `Object reference not set to an instance of an object` ([A31](commands.md#a31)).
