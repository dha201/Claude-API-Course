# Commands and raw results

Every command that produced a finding, [A1](#a1) to [A37](#a37), verbatim, with the raw result the user got on `workdeliverygpt-dev-srch`. Each heading names the finding it supports in [evidence.md](evidence.md). Commands still to run are in [runbook.md](runbook.md).

## Commands run 2026-09-17

Commands in the order they were run, with the result the user got. Numbers in the results come from the user's runs on `workdeliverygpt-dev-srch`.

The command text differs from what was typed in four ways, so that every line runs on its own:

- literal knowledge base and knowledge source names in place of `$prodKb` and `$prodKs`;
- [A1](#a1) and [A2](#a2) are reconstructed from a screenshot and put on one line each;
- [A4](#a4) and [A8](#a8) are folded into one line each;
- [A16](#a16) is hardened with `Add-Member -Force`.

All 19 were run under Constrained Language Mode against a local stub that fakes Azure responses. Each parses and runs, and the error paths in [A6](#a6) and [A13](#a13) fire. The stub checks syntax and readout, not service behavior.

<a id="a1"></a>

### A1. Vectorizer and profile on the index (F1)

```powershell
$r = Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $r.vectorSearch.vectorizers; $r.vectorSearch.profiles
```

Result: vectorizer `ps_text_3_small`, kind `azureOpenAI`, `resourceUri` an internal proxy host ending in `/wdgpt`, `deploymentId` `text-embedding-3-small`, key auth, `authIdentity` unset. Profile `content-vector-hnsw-profile`.

Reconstructed from the user's screenshot, where it ran as three lines.

<a id="a2"></a>

### A2. Vectorizer called by the service with `kind:"text"` (F1)

```powershell
$q = @{ select = "project_id,title"; vectorQueries = @( @{ kind = "text"; text = "SaaS project closeout duration"; fields = "content_vector"; k = 3; exhaustive = $true } ) } | ConvertTo-Json -Depth 6; Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json' | Select-Object -ExpandProperty value
```

Result: 3 results with no filter and `exhaustive: true`. 0.7561 and 0.7460 on project 1007355 "Project RED (EEDE Phase 1)", 0.7443 on project 1007122 "2022 - Gateway EAS Cloud Migration".

Proves the service reached the embedding endpoint through the proxy and got a usable vector. Reconstructed from the screenshot, where it ran as several lines.

<a id="a3"></a>

### A3. Discover the knowledge base and knowledge source names

```powershell
$prodKb = (((Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).value) | Where-Object { $_.name -notlike 'ps-kb-*' })[0].name; $prodKs = (((Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgesources?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).value) | Where-Object { $_.name -notlike 'ps-ks-*' })[0].name; "knowledge base:   $prodKb"; "knowledge source: $prodKs"
```

Result: `knowledgebase-1788979805148` and `knowledgesource-1788979786196`.

`[0]` picked the right source because of list order, not by design. Every later command uses the literal names.

<a id="a4"></a>

### A4. BM25 only, natural-language probe string (not a valid probe)

```powershell
$q = @{ search = "retrospective observations on what the delivery team would repeat"; filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 50; count = $true } | ConvertTo-Json -Depth 8; $r1 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; "BM25 count: " + $r1.'@odata.count'; $r1.value | Select-Object -First 5 '@search.score', project_id, title | Format-Table -AutoSize
```

Result: `BM25 count: 601`. The top 5 are all project 1009338, "MWS - SDWAN2023", scoring from 26.65 down to 17.99.

It failed as a probe because the default `searchMode` is `any`, so one shared word such as `team` or `delivery` is enough to match. A natural-language sentence cannot be lexically disjoint from project documents. As run, the count and the top-5 readout were two separate lines.

<a id="a5"></a>

### A5. Vector only, same probe string (not a valid probe)

```powershell
$q = @{ search = $null; vectorQueries = @( @{ kind = "text"; text = "retrospective observations on what the delivery team would repeat"; fields = "content_vector"; k = 50 } ); filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 50; count = $true } | ConvertTo-Json -Depth 8; $r2 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; "vector count: " + $r2.'@odata.count'; $r2.value | Select-Object -First 3 '@search.score', project_id, title | Format-Table -AutoSize
```

Result: `vector count: 50`. Scores 0.0824, 0.0821, 0.0620.

Proves nothing by itself, because a vector query returns `k` neighbours for any input. [A11](#a11) shows that the low scores come from the query text, not a broken vectorizer ([F2](evidence.md#f2)).

<a id="a6"></a>

### A6. Retrieve with `messages` (F5)

```powershell
$b = @{ messages = @( @{ role = "user"; content = @( @{ type = "text"; text = "retrospective observations on what the delivery team would repeat" } ) } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kb = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "references: " + @($kb.references).Count
```

Result: HTTP 400, `"Messages input not supported when 'minimal' reasoning effort is requested. Use intents input instead."` The line then printed `references: 1`. That is a false count: `$kb` was never assigned, and `@($null.references).Count` is 1.

Re-running it reproduces the error and nothing else.

<a id="a7"></a>

### A7. Retrieve with `intents` on the production knowledge base (F4)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbA = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "control references: " + @($kbA.references).Count; $kbA.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs, @{n='filter';e={$_.searchIndexArguments.filter}}
```

Result: `control references: 28`, from three `searchIndex` activities. Id 0 had count 1 and filter `project_id eq '1009338' and gate_label eq 'Closeout'`. Id 1 had count 50 and no filter. Id 2 had count 33 and no filter. elapsedMs was 0 on all three.

Proves the knowledge base queries all three knowledge sources, and `filterAddOn` applies only to the one it names.

<a id="a8"></a>

### A8. Full activity array for the same call (F9)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbA = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; $kbA.activity | ConvertTo-Json -Depth 8
```

Result: the `project_similarity_index` activity lists 28 `searchFields`, all text, with neither `body` nor `content_vector` among them. The `ldp_index` and `dbr_index` activities each carry their own field list.

As run, this was `$kbA.activity | ConvertTo-Json -Depth 8` in the same shell after [A7](#a7). Here it repeats the retrieve so the line runs on its own. The user's transcription of the output had some low-confidence field names. The stored list reads back as 29 fields ([A36](#a36)); the names are open ([O1](runbook.md#o1)).

<a id="a9"></a>

### A9. BM25 only, gibberish token (F8)

```powershell
$q = @{ search = "zqxjvwkbhf"; filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 50; count = $true } | ConvertTo-Json -Depth 8; $r3 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; "gibberish BM25 count: " + $r3.'@odata.count'
```

Result: `gibberish BM25 count: 0`.

<a id="a10"></a>

### A10. Retrieve with the gibberish token on the production knowledge base (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "zqxjvwkbhf" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbB = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "gibberish references: " + @($kbB.references).Count; $kbB.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object count, elapsedMs
```

Result: `gibberish references: 0`. Activity counts 0, 0 and 0, with elapsedMs 50, 50 and 67.

0 references because default reranking drops every vector neighbour of a gibberish token ([F8](evidence.md#f8)). On the `project_similarity_index` source the vector query is also off ([F9](evidence.md#f9)).

<a id="a11"></a>

### A11. Vector only, relevant text (F2)

```powershell
$q = @{ search = $null; vectorQueries = @( @{ kind = "text"; text = "lessons learned from this project closeout, what went well and what went wrong"; fields = "content_vector"; k = 10 } ); filter = "project_id eq '1009338' and gate_label eq 'Closeout'"; top = 10; count = $true } | ConvertTo-Json -Depth 8; $r4 = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index/docs/search?api-version=2024-07-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $q -ContentType 'application/json'; $r4.value | Select-Object -First 5 '@search.score', project_id, title | Format-Table -AutoSize
```

Result: 0.6461, 0.6465, 0.6411, 0.6377, 0.6313, all on project 1009338.

Eight times the 0.08 from [A5](#a5), so the embedding model matches the index.

<a id="a12"></a>

### A12. Knowledge sources on the knowledge base (F4)

```powershell
(Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).knowledgeSources | Select-Object name
```

Result: `knowledgesource-1788979786196`, `knowledgesource-1789660272864`, `knowledgesource-1789660431937`.

The first attempt wrote `$prodKb?api-version` and failed with `"Invalid or missing api-version query string parameter"`. `$($prodKb)?` fixed it, and the literal name here avoids the problem.

<a id="a13"></a>

### A13. `neverQuerySource` on the other two sources (failed)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }, @{ knowledgeSourceName = 'knowledgesource-1789660272084'; kind = "searchIndex"; neverQuerySource = $true }, @{ knowledgeSourceName = 'knowledgesource-1789660431937'; kind = "searchIndex"; neverQuerySource = $true } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbC = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "references: " + @($kbC.references).Count; $kbC.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count
```

Result: HTTP 400, `"Knowledge Source Params target Knowledge Source name must match a Knowledge Base Knowledge Source name."` The line also printed a false `references: 1`.

The cause is a typo in the command: it has `knowledgesource-1789660272084`, and the real name is `knowledgesource-1789660272864`. It was not retried, because a single-source knowledge base ([A14](#a14)) gives the same isolation without depending on `neverQuerySource`. Whether `neverQuerySource` works at `minimal` effort is open ([O7](runbook.md#o7)).

<a id="a14"></a>

### A14. Create `ps-kb-isolated` (F7)

```powershell
$kbb = @{ name = 'ps-kb-isolated'; description = 'Baseline: project_similarity knowledge source only.'; knowledgeSources = @( @{ name = 'knowledgesource-1788979786196' } ); outputMode = 'extractiveData'; retrievalReasoningEffort = @{ kind = 'minimal' } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-isolated?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $kbb -ContentType 'application/json'
```

Result: created, with one knowledge source, no models, and `minimal` effort.

<a id="a15"></a>

### A15. Retrieve `lessons learned` on `ps-kb-isolated` (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbD = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-isolated/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "references: " + @($kbD.references).Count; $kbD.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs
```

Result: `references: 1`, from one activity with id 0, count 1, elapsedMs 0.

This is the clean single-source baseline. It matches the filtered activity in [A7](#a7).

<a id="a16"></a>

### A16. Clone the production knowledge source with `searchFields` emptied (F7)

```powershell
$ks = Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/knowledgesource-1788979786196?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $c = ($ks | ConvertTo-Json -Depth 20 | ConvertFrom-Json) | Select-Object -Property * -ExcludeProperty '@odata.context','@odata.etag'; $c.name = 'ps-ks-allfields'; $c | Add-Member -NotePropertyName description -NotePropertyValue 'searchFields emptied' -Force; $c.searchIndexParameters.searchFields = @(); Invoke-RestMethod -Method Put -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body ($c | ConvertTo-Json -Depth 20) -ContentType 'application/json'
```

Result: created `ps-ks-allfields`. The echo showed `searchIndexName`, `sourceDataFields` and `searchFields`, and no `semanticConfigurationName`.

As run, the description was set with `$c.description = '...'`. That assignment throws when the source has no `description` property. The production source has one, so it worked. This command uses `Add-Member -Force`, which works either way.

<a id="a17"></a>

### A17. Create `ps-kb-allfields` (F7)

```powershell
$kbb = @{ name = 'ps-kb-allfields'; description = 'Sibling with searchFields emptied.'; knowledgeSources = @( @{ name = 'ps-ks-allfields' } ); outputMode = 'extractiveData'; retrievalReasoningEffort = @{ kind = 'minimal' } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $kbb -ContentType 'application/json'
```

Result: created, with one knowledge source, no models, and `minimal` effort.

<a id="a18"></a>

### A18. Retrieve the gibberish token on the sibling (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "zqxjvwkbhf" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbE = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "gibberish references: " + @($kbE.references).Count; $kbE.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs
```

Result: `gibberish references: 0`, from one activity with count 0.

0 references because default reranking drops every vector neighbour ([F8](evidence.md#f8)).

<a id="a19"></a>

### A19. Retrieve `lessons learned` on the sibling (F7)

```powershell
$b = @{ intents = @( @{ type = "semantic"; search = "lessons learned" } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = "searchIndex"; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $kbF = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY } -Body $b -ContentType 'application/json'; "real references: " + @($kbF.references).Count; $kbF.activity | Where-Object { $_.type -eq 'searchIndex' } | Select-Object id, count, elapsedMs
```

Result: 9 references, from one activity with count 9 and elapsedMs 0.

9 references against [A15](#a15)'s 1. The gain comes from the vector query, which the production list turns off ([F9](evidence.md#f9)). As run, the label read `gibberish references: 9` because the line was copied from [A18](#a18). It is relabeled here.

## Commands run 2026-09-18

Same service and conventions as the commands above. Commands [A24](#a24) and later were run against the local stub before the user ran them, except [A21](#a21), [A22](#a22) and [A23](#a23), which are read-only.

<a id="a20"></a>

### A20. Re-run of A2 and A1

Result: identical to [A2](#a2) (0.7561, 0.7460, 0.7443). [A1](#a1) now also printed `modelName` `text-embedding-3-small`, `authIdentity` blank and `customWebApiParameters` empty.

<a id="a21"></a>

### A21. Service settings with `az search service list` (failed)

```powershell
az search service list --query "[?name=='workdeliverygpt-dev-srch'].{name:name, resourceGroup:resourceGroup, sku:sku.name, computeType:computeType, semanticSearch:semanticSearch, knowledgeRetrieval:knowledgeRetrieval}" -o jsonc
```

Result: `the following arguments are required: --resource-group/-g`. This CLI build requires a resource group for `list`.

<a id="a22"></a>

### A22. Service settings (F3)

```powershell
$rg = az resource list --name workdeliverygpt-dev-srch --resource-type Microsoft.Search/searchServices --query "[0].resourceGroup" -o tsv; "resource group: $rg"; az resource show --resource-group $rg --name workdeliverygpt-dev-srch --resource-type Microsoft.Search/searchServices --api-version 2026-03-01-preview --query "{sku:sku.name, computeType:properties.computeType, semanticSearch:properties.semanticSearch, knowledgeRetrieval:properties.knowledgeRetrieval}" -o jsonc
```

Result: `resource group: workdeliverygpt-dev-rg`; `computeType` Default, `knowledgeRetrieval` standard, `semanticSearch` standard, `sku` standard.

<a id="a23"></a>

### A23. Index vector fields, algorithm and semantic default (F3)

```powershell
$ix = Invoke-RestMethod -Uri "$env:AZURE_SEARCH_ENDPOINT/indexes/project_similarity_index?api-version=2026-04-01" -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; '--- VECTOR FIELDS ---'; $ix.fields | Where-Object { $_.vectorSearchProfile } | Select-Object name, type, searchable, retrievable, stored, dimensions, vectorSearchProfile | Format-Table -AutoSize; '--- PROFILES ---'; $ix.vectorSearch.profiles | Select-Object name, algorithm, compression, vectorizer | Format-Table -AutoSize; '--- ALGORITHMS ---'; $ix.vectorSearch.algorithms | Select-Object name, kind | Format-Table -AutoSize; '--- SEMANTIC ---'; 'defaultConfiguration: ' + $ix.semantic.defaultConfiguration
```

Result: one vector field, `content_vector`, `Collection(Edm.Single)`, 1536 dimensions, `searchable`, `retrievable`, `stored` all True, profile `content-vector-hnsw-profile`. Profile: algorithm `content-vector-hnsw-config`, no compression, vectorizer `ps_text_3_small`. Algorithm kind `hnsw`. `defaultConfiguration:` blank.

<a id="a24"></a>

### A24. `searchFields` variants in place on `ps-ks-allfields` (F10)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ks = Invoke-RestMethod -Uri "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers $h; $sdf = @($ks.searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $cfgs = @((Invoke-RestMethod -Uri "$ep/indexes/project_similarity_index?api-version=2026-04-01" -Headers $h).semantic.configurations | ForEach-Object { $_.name }); 'semantic configurations: ' + ($cfgs -join ', ') + '   sourceDataFields kept: ' + $sdf.Count; $variants = @( @{ label = 'absent'; p = @{} }, @{ label = 'absent + sc'; p = @{ semanticConfigurationName = $cfgs[0] } }, @{ label = 'star'; p = @{ searchFields = @( @{ name = '*' } ) } }, @{ label = 'vector named'; p = @{ searchFields = @( @{ name = 'content_vector' } ) } }, @{ label = 'restore []'; p = @{ searchFields = @() } } ); foreach ($v in $variants) { $p = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf }; foreach ($k in $v.p.Keys) { $p[$k] = $v.p[$k] }; try { $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = $p } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers $h -Body $body -ContentType 'application/json' | Out-Null; $sp = (Invoke-RestMethod -Uri "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview" -Headers $h).searchIndexParameters; $state = if (-not ($sp.PSObject.Properties.Name -contains 'searchFields')) { 'ABSENT' } elseif (@($sp.searchFields).Count -eq 0) { 'EMPTY []' } else { 'SET ' + (ConvertTo-Json -InputObject @($sp.searchFields) -Compress) }; '{0,-13} stored searchFields = {1}   semanticConfigurationName = {2}' -f $v.label, $state, $sp.semanticConfigurationName; if ($v.label -eq 'restore []') { continue }; foreach ($t in 'zqxjvwkbhf','lessons learned') { try { $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview" -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '    {0,-16} refs={1,-4} count={2,-4} ms={3}' -f $t, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '    {0,-16} ERROR {1}' -f $t, $m } } } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-13} REJECTED  {1}' -f $v.label, $m } }
```

Result: `semantic configurations: default   sourceDataFields kept: 94`. Then, as `zqxjvwkbhf` / `lessons learned` refs and count, all `ms=0`:

```
absent          stored ABSENT                     0/0    9/9
absent + sc     stored ABSENT, sc = default       0/0    9/9
star            stored SET [{"name":"*"}]         0/0    9/9
vector named    stored SET [{"name":"content_vector"}]   0/0    0/0
restore []      stored EMPTY []
```

The `vector named` 0/0 for `lessons learned` did not repeat in [A26](#a26) or [A28](#a28), which waited or ran later; treat it as a propagation delay right after the PUT.

<a id="a25"></a>

### A25. Result filters off, first attempt (failed)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $variants = @( @{ label = 'threshold 0'; k = 'rerankerThreshold'; v = 0.0 }, @{ label = 'processing none'; k = 'resultsProcessing'; v = 'none' }, @{ label = 'failOnError'; k = 'failOnError'; v = $true } ); foreach ($p in @( @{ kb = 'ps-kb-allfields'; ks = 'ps-ks-allfields' } )) { foreach ($v in $variants) { try { $ksp = @{ knowledgeSourceName = $p.ks; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }; $ksp[$v.k] = $v.v; $b = @{ intents = @( @{ type = 'semantic'; search = 'zqxjvwkbhf' } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/$($p.kb)/retrieve?api-version=2026-08-01-preview" -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} {1,-16} refs={2,-4} count={3,-4} ms={4}' -f $p.kb, $v.label, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} {1,-16} ERROR {2}' -f $p.kb, $v.label, $m } } }
```

Result: three rows of `ERROR The remote name could not be resolved: 'urihttps'`. The terminal paste joined `-Uri` to the URL. Later commands build each URL into a variable first.

<a id="a26"></a>

### A26. Vector-only `searchFields` with filters off, `lessons learned` (F11)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $vec = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = @( @{ name = 'content_vector' } ) } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $vec -ContentType 'application/json' | Out-Null; 'set searchFields = content_vector only'; foreach ($v in @( @{ label = 'plain' }, @{ label = 'processing none'; k = 'resultsProcessing'; v = 'none' }, @{ label = 'threshold 0'; k = 'rerankerThreshold'; v = 0.0 }, @{ label = 'failOnError'; k = 'failOnError'; v = $true } )) { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }; if ($v.k) { $ksp[$v.k] = $v.v }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} refs={1,-4} count={2,-4} ms={3}' -f $v.label, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} ERROR {1}' -f $v.label, $m } }; $rst = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = @() } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $rst -ContentType 'application/json' | Out-Null; 'restored searchFields = []'
```

Result:

```
plain            refs=9    count=9    ms=0
processing none  refs=9    count=50   ms=447
threshold 0      refs=13   count=13   ms=0
failOnError      refs=9    count=9    ms=0
restored searchFields = []
```

<a id="a27"></a>

### A27. Gibberish with reranking bypassed, `maxOutputDocuments` 49 (failed)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $put = { param($sf, $label) $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null; Start-Sleep -Seconds 15; "--- searchFields = $label (after 15 s wait) ---" }; $probe = { foreach ($t in 'zqxjvwkbhf','lessons learned') { foreach ($mode in 'rerank','none') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 49; resultsProcessing = $mode }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} {1,-7} refs={2,-4} count={3,-4} ms={4}' -f $t, $mode, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} {1,-7} ERROR {2}' -f $t, $mode, $m } } } }; & $put @() '[]'; & $probe; & $put @( @{ name = 'content_vector' } ) 'content_vector'; & $probe; & $put @() '[] (restored)'
```

Result: every retrieve returned `Value for MaxOutputDocuments must be between 50 and 200.` The PUTs and waits ran, and `searchFields` ended restored to `[]`.

<a id="a28"></a>

### A28. Gibberish with reranking bypassed, `maxOutputDocuments` 51 (F8)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $put = { param($sf, $label) $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null; Start-Sleep -Seconds 15; "--- searchFields = $label (after 15 s wait) ---" }; $probe = { foreach ($t in 'zqxjvwkbhf','lessons learned') { foreach ($mode in 'rerank','none') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 51; resultsProcessing = $mode }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} {1,-7} refs={2,-4} count={3,-4} ms={4}' -f $t, $mode, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} {1,-7} ERROR {2}' -f $t, $mode, $m } } } }; & $put @() '[]'; & $probe; & $put @( @{ name = 'content_vector' } ) 'content_vector'; & $probe; & $put @() '[] (restored)'
```

Result:

```
--- searchFields = [] ---
zqxjvwkbhf       rerank  refs=0    count=0    ms=0
zqxjvwkbhf       none    refs=7    count=51   ms=477
lessons learned  rerank  refs=10   count=10   ms=0
lessons learned  none    refs=9    count=51   ms=643
--- searchFields = content_vector ---
zqxjvwkbhf       rerank  refs=0    count=0    ms=0
zqxjvwkbhf       none    refs=7    count=51   ms=513
lessons learned  rerank  refs=10   count=10   ms=0
lessons learned  none    refs=9    count=51   ms=451
--- searchFields = [] (restored) ---
```

<a id="a29"></a>

### A29. Gibberish candidates against Search API vector neighbours (F8)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; $key = @((Invoke-RestMethod -Uri "$ep/indexes/project_similarity_index?api-version=2026-04-01" -Headers $h).fields | Where-Object { $_.key })[0].name; 'index key field: ' + $key; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $q = @{ select = $key; filter = $f; top = 51; vectorQueries = @( @{ kind = 'text'; text = 'zqxjvwkbhf'; fields = 'content_vector'; k = 51 } ) } | ConvertTo-Json -Depth 8; $vk = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body $q -ContentType 'application/json').value | ForEach-Object { [string]$_.$key }); $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $b = @{ intents = @( @{ type = 'semantic'; search = 'zqxjvwkbhf' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 51; resultsProcessing = 'none' } ); includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $kk = @($r.references | Where-Object { $_ } | ForEach-Object { if ($_.sourceData.$key) { [string]$_.sourceData.$key } else { [string]$_.docKey } }); $hit = @($kk | Where-Object { $vk -contains $_ }); 'Search API vector-only neighbours: ' + $vk.Count; 'KB gibberish references (none):   ' + $kk.Count; 'KB references found among the Search API vector neighbours: ' + $hit.Count + ' of ' + $kk.Count; 'first KB keys: ' + (($kk | Select-Object -First 3) -join ', ')
```

Result: `index key field: psr_row_id`; Search API vector-only neighbours 51; KB gibberish references (none) 7; 7 of 7 found among the Search API neighbours. First keys: `1009338_1009338-1009338-g3-itcash-sdwan-2023-closeout-86f644863c06ccb2_chunk_435`, `..._chunk_252`, `..._chunk_207`.

<a id="a30"></a>

### A30. `lessons learned` with request-level `maxOutputDocuments` 50 (F11)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; foreach ($v in @( @{ label = 'rerank default' }, @{ label = 'threshold 0'; k = 'rerankerThreshold'; v = 0.0 }, @{ label = 'processing none'; k = 'resultsProcessing'; v = 'none' } )) { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50 }; if ($v.k) { $ksp[$v.k] = $v.v }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $refs = @($r.references | Where-Object { $_ }); $les = @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' }); $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} refs={1,-4} count={2,-4} body mentions lesson={3,-4} ms={4}' -f $v.label, $refs.Count, $a.count, $les.Count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} ERROR {1}' -f $v.label, $m } }
```

Result:

```
rerank default   refs=9    count=9    body mentions lesson=2    ms=0
threshold 0      refs=13   count=50   body mentions lesson=2    ms=0
processing none  refs=9    count=50   body mentions lesson=2    ms=571
```

<a id="a31"></a>

### A31. A32 and A33, first attempt (failed)

Both commands in a new shell without `. .\src\api\env.ps1`. Every call returned `Object reference not set to an instance of an object`, which `Invoke-RestMethod` throws when a header value is null. Nothing reached the service. Load the environment file in each new shell.

<a id="a32"></a>

### A32. Knowledge base definition and `maxOutputSize` (F12)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $kb = Invoke-RestMethod -Uri "$ep/knowledgebases/ps-kb-allfields?api-version=2026-08-01-preview" -Headers $h; '--- KNOWLEDGE BASE ---'; $kb | Select-Object -Property * -ExcludeProperty '@odata.context','@odata.etag','knowledgeSources' | ConvertTo-Json -Depth 8; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; '--- RETRIEVE, none, maxOutputDocuments 50 + maxOutputSize ---'; foreach ($sz in 50000, 200000) { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; maxOutputSize = $sz; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $refs = @($r.references | Where-Object { $_ }); $les = @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' }); $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; 'maxOutputSize={0,-7} refs={1,-4} count={2,-4} body mentions lesson={3}' -f $sz, $refs.Count, $a.count, $les.Count } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'maxOutputSize={0,-7} ERROR {1}' -f $sz, $m } }
```

Result: the knowledge base definition shows `retrieveDefaults: null`, `models: []`, `outputMode: extractiveData`, `retrievalReasoningEffort: minimal`, and `retrievalInstructions` and `answerInstructions` null.

```
maxOutputSize=50000   refs=38   count=50   body mentions lesson=2
maxOutputSize=200000  refs=50   count=50   body mentions lesson=2
```

<a id="a33"></a>

### A33. Search API baseline (F14)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; foreach ($m in @( @{ label = 'BM25 only'; q = @{ search = 'lessons learned' } }, @{ label = 'vector only'; q = @{ vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ) } }, @{ label = 'hybrid'; q = @{ search = 'lessons learned'; vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ) } }, @{ label = 'hybrid+semantic'; q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ) } } )) { try { $q = $m.q; $q['filter'] = $f; $q['top'] = 50; $q['select'] = 'body'; $r = Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body ($q | ConvertTo-Json -Depth 8) -ContentType 'application/json'; $v = @($r.value); $les = @($v | Where-Object { [string]$_.body -match 'lesson' }); '{0,-16} results={1,-4} body mentions lesson={2}' -f $m.label, $v.Count, $les.Count } catch { $e = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} ERROR {1}' -f $m.label, $e } }
```

Result:

```
BM25 only        results=1    body mentions lesson=1
vector only      results=50   body mentions lesson=2
hybrid           results=50   body mentions lesson=2
hybrid+semantic  results=50   body mentions lesson=2
```

<a id="a34"></a>

### A34. Eight-project comparison (F16)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; '{0,-8} {1,-22} {2,-22} {3,-22}' -f 'project', 'Search API hyb+sem', 'KB rerank', 'KB none'; foreach ($p in '1009338','1009392','1010069','1011517','1011718','1011742','1012268','1012329') { $f = "project_id eq '$p' and gate_label eq 'Closeout'"; $out = @(); try { $q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); filter = $f; top = 50; select = 'body' } | ConvertTo-Json -Depth 8; $v = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body $q -ContentType 'application/json').value); $out += ('{0} res, {1} lesson' -f $v.Count, @($v | Where-Object { [string]$_.body -match 'lesson' }).Count) } catch { $out += 'ERROR' }; foreach ($mode in 'rerank','none') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = $mode }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $refs = @($r.references | Where-Object { $_ }); $out += ('{0} refs, {1} lesson' -f $refs.Count, @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' }).Count) } catch { $out += 'ERROR' } }; '{0,-8} {1,-22} {2,-22} {3,-22}' -f $p, $out[0], $out[1], $out[2] }
```

Result:

```
project  Search API hyb+sem     KB rerank              KB none
1009338  50 res, 2 lesson       9 refs, 2 lesson       50 refs, 2 lesson
1009392  50 res, 2 lesson       4 refs, 1 lesson       50 refs, 2 lesson
1010069  11 res, 1 lesson       11 refs, 1 lesson      11 refs, 1 lesson
1011517  50 res, 2 lesson       25 refs, 2 lesson      50 refs, 2 lesson
1011718  50 res, 1 lesson       8 refs, 1 lesson       50 refs, 1 lesson
1011742  50 res, 2 lesson       13 refs, 2 lesson      50 refs, 2 lesson
1012268  50 res, 2 lesson       8 refs, 1 lesson       50 refs, 2 lesson
1012329  50 res, 2 lesson       5 refs, 2 lesson       50 refs, 2 lesson
```

<a id="a35"></a>

### A35. Production `searchFields` list and candidate count (F9)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; foreach ($c in @( @{ kb = 'ps-kb-isolated'; ks = 'knowledgesource-1788979786196'; mod = 50 }, @{ kb = 'ps-kb-allfields'; ks = 'ps-ks-allfields'; mod = 50 }, @{ kb = 'ps-kb-allfields'; ks = 'ps-ks-allfields'; mod = 200 } )) { $rtu = "$ep/knowledgebases/$($c.kb)/retrieve?api-version=2026-08-01-preview"; foreach ($t in 'zqxjvwkbhf','lessons learned') { try { $ksp = @{ knowledgeSourceName = $c.ks; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = $c.mod; resultsProcessing = 'none' }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = $c.mod; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '{0,-16} max={1,-4} {2,-16} refs={3,-4} count={4,-4} ms={5}' -f $c.kb, $c.mod, $t, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-16} max={1,-4} {2,-16} ERROR {3}' -f $c.kb, $c.mod, $t, $m } } }
```

Result:

```
ps-kb-isolated   max=50   zqxjvwkbhf       refs=0    count=0    ms=59
ps-kb-isolated   max=50   lessons learned  refs=1    count=1    ms=16
ps-kb-allfields  max=50   zqxjvwkbhf       refs=50   count=50   ms=1135
ps-kb-allfields  max=50   lessons learned  refs=50   count=50   ms=545
ps-kb-allfields  max=200  zqxjvwkbhf       refs=159  count=200  ms=612
ps-kb-allfields  max=200  lessons learned  refs=143  count=200  ms=447
```

<a id="a36"></a>

### A36. `searchFields` lists that include `content_vector` (F10)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $ksu = "$ep/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); $prod = @((Invoke-RestMethod -Uri "$ep/knowledgesources/knowledgesource-1788979786196?api-version=2026-08-01-preview" -Headers $h).searchIndexParameters.searchFields | ForEach-Object { $_.name }); 'production list: ' + $prod.Count + ' fields'; $variants = @( @{ label = 'prod list + content_vector'; names = @($prod + 'content_vector') }, @{ label = 'body + content_vector'; names = @('body', 'content_vector') }, @{ label = 'restore []'; names = @() } ); foreach ($v in $variants) { $sf = @($v.names | ForEach-Object { @{ name = $_ } }); $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; try { Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; "--- $($v.label): PUT REJECTED $m"; continue }; if ($v.label -eq 'restore []') { '--- restored searchFields = []'; break }; Start-Sleep -Seconds 15; "--- $($v.label) ($($sf.Count) fields, after 15 s wait) ---"; foreach ($t in 'zqxjvwkbhf','lessons learned') { try { $ksp = @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50; resultsProcessing = 'none' }; $b = @{ intents = @( @{ type = 'semantic'; search = $t } ); knowledgeSourceParams = @( $ksp ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $a = @($r.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; '    {0,-16} refs={1,-4} count={2,-4} ms={3}' -f $t, @($r.references | Where-Object { $_ }).Count, $a.count, $a.elapsedMs } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '    {0,-16} ERROR {1}' -f $t, $m } } }
```

Result: `production list: 29 fields`. Production list plus `content_vector` (30 fields): `zqxjvwkbhf` refs 50, count 50, 1,108 ms; `lessons learned` refs 50, count 50. `body` plus `content_vector`: `zqxjvwkbhf` refs 50, count 50, 530 ms; `lessons learned` refs 50, count 50. Restored to `[]`. An earlier attempt in a shell without `. .\src\api\env.ps1` failed the same way as [A31](#a31) and sent nothing.

<a id="a37"></a>

### A37. Same-chunks check, `lessons learned` (F15)

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $key = @((Invoke-RestMethod -Uri "$ep/indexes/project_similarity_index?api-version=2026-04-01" -Headers $h).fields | Where-Object { $_.key })[0].name; $vq = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); $sets = @{}; foreach ($m in @( @{ label = 'hybrid'; q = @{ search = 'lessons learned'; vectorQueries = $vq } }, @{ label = 'hybrid+semantic'; q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = $vq } } )) { $q = $m.q; $q['filter'] = $f; $q['top'] = 50; $q['select'] = "$key,body"; $v = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body ($q | ConvertTo-Json -Depth 8) -ContentType 'application/json').value); $sets[$m.label] = @{ keys = @($v | ForEach-Object { [string]$_.$key }); les = @($v | Where-Object { [string]$_.body -match 'lesson' } | ForEach-Object { [string]$_.$key }) } }; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $refs = @((Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json').references | Where-Object { $_ }); $kk = @($refs | ForEach-Object { if ($_.sourceData.$key) { [string]$_.sourceData.$key } else { [string]$_.docKey } }); $kl = @($refs | Where-Object { [string]$_.sourceData.body -match 'lesson' } | ForEach-Object { [string]$_.sourceData.$key }); 'key field: ' + $key + '   KB references: ' + $kk.Count + '   KB lesson chunks: ' + $kl.Count; foreach ($n in 'hybrid','hybrid+semantic') { $s = $sets[$n]; '{0,-16} results={1,-3} overlap with KB={2,-3} lesson chunks={3}, of which in KB={4}' -f $n, $s.keys.Count, @($kk | Where-Object { $s.keys -contains $_ }).Count, $s.les.Count, @($s.les | Where-Object { $kk -contains $_ }).Count }; 'first KB keys: ' + (($kk | Select-Object -First 2) -join ', ')
```

Result:

```
key field: psr_row_id   KB references: 50   KB lesson chunks: 2
hybrid           results=50  overlap with KB=50  lesson chunks=2, of which in KB=2
hybrid+semantic  results=50  overlap with KB=50  lesson chunks=2, of which in KB=2
```
