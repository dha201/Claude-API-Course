# Runbook

What to know before running anything, the open items with their commands, and operating notes. Results feed [staging-findings.md](staging-findings.md) first, then [evidence.md](evidence.md) and [ground-truth.md](ground-truth.md) once they have a command, a number and a date.

## Pitfalls for future agents

- Activity `count` is taken after the reranker threshold. Zero doesn't mean nothing was retrieved. Test with `resultsProcessing: "none"`.
- A threshold sweep whose only survivor scores above every threshold tested proves nothing about the threshold ([F20](evidence.md#f20)).
- Limits mask each other. `resultsProcessing: "none"` looked inert because the token budget capped references near 9 ([F12](evidence.md#f12)). Change one limit at a time and read count and references together.
- Before crediting a gain to the keyword lane, run BM25 alone. BM25 over every field gave 1 for `lessons learned` ([F14](evidence.md#f14)), so the gain from 1 to 9 was never keyword.
- An explicit `searchFields` list without `content_vector` silently turns the vector query off ([F9](evidence.md#f9)). Microsoft's Python sample uses such a list.
- A failed call leaves the result variable null, and `@($null.references).Count` prints 1. Wrap every call in try/catch and print ERROR.
- `maxOutputDocuments` accepts only 50 to 200 ([F6](evidence.md#f6)).
- A pasted `-Uri "$env:..."` can lose its space ([A25](commands.md#a25)). Build URLs into variables first.
- Load `env.ps1` in each new shell. Otherwise every call fails with `Object reference not set to an instance of an object` ([A31](commands.md#a31)).
- Wait about 15 seconds after a knowledge source PUT before probing it ([F10](evidence.md#f10)).
- `elapsedMs` 0 on reranked rows is a reporting quirk, not a cache ([F8](evidence.md#f8)).
- Research-agent summaries misreported GitHub issue state and quoted sentences that aren't on current pages. Open the source before recording anything.
- Don't cite "if the only searchable field is a vector field, then only pure vector search is used". Microsoft deleted it on 2026-06-12, commit `3832581a` of `MicrosoftDocs/azure-ai-docs`.
- The semantic reranker can be bypassed from `2026-08-01-preview` on. Older sources describe it as mandatory for agentic retrieval.
- "No workaround exists" is an opinion until a test proves it.
- Runs on the production knowledge source ([F17](evidence.md#f17), [F18](evidence.md#f18), [F20](evidence.md#f20) to [F23](evidence.md#f23)) had the vector query off. Don't read them as evidence about hybrid retrieval.

## Open items

Load `. .\src\api\env.ps1` from the root of the application repository in each new PowerShell shell before running these ([A31](commands.md#a31)). Every command below was run under Constrained Language Mode against a local stub that fakes Azure responses, on both the success path and a failure path. The stub checks syntax, request shape and readout, not service behavior. Unproven claims about synonym maps, a reranker score floor, `alwaysQuery`, scoring profiles, `prioritizedContentFields` and several intents have their tests in [staging-findings.md](staging-findings.md).

<a id="o1"></a>

### O1. The 29 stored field names, and whether `body` is among them

Read-only.

```powershell
$u = "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/knowledgesource-1788979786196?api-version=2026-08-01-preview"; try { $sf = @((Invoke-RestMethod -Uri $u -Headers @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }).searchIndexParameters.searchFields | Where-Object { $_ } | ForEach-Object { $_.name }); 'searchFields count: ' + $sf.Count; 'body in list: ' + ($sf -contains 'body'); 'content_vector in list: ' + ($sf -contains 'content_vector'); $sf -join ', ' } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `searchFields count: 29` and `content_vector in list: False` confirm [A36](commands.md#a36) and [F9](evidence.md#f9).
- `body in list` settles the field list recorded in [F9](evidence.md#f9). It doesn't change the cause of 1 against 9, which is the vector query being off.
- The names settle the disputed spellings in the hand transcription, for example `accountable_portfolio` or `accountable_portfolio_id`, and `vendor` or `vendors`.
- `ERROR`: nothing was read. Load the environment file and rerun.

<a id="o2"></a>

### O2. Apply the configuration in `chat_similarity` and rerun the prompts

Runs in the application repository, not here. Apply [Configuration that works](ground-truth.md#configuration-that-works) to the knowledge source and the evidence-fetch retrieve request, using [implementation.md](implementation.md) as the reference.

- Expect lessons for 7 of 8 projects on the eight-project prompt. 1012329 still gets no evidence call until [O6](#o6) is fixed.
- Rerun the 16-prompt evaluation ([F23](evidence.md#f23)). It ran with the vector query off, so every Retrieval API row may change.
- Check anything downstream that sorts or filters on `rerankerScore`.

<a id="o3"></a>

### O3. Same chunks on the other seven projects

[F16](evidence.md#f16) compared counts; [F15](evidence.md#f15) compared chunk identity on 1009338 only. `ps-ks-allfields` must still store `searchFields: []`.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $vq = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); '{0,-8} {1,-7} {2,-7} {3,-8} {4}' -f 'project', 'search', 'KB', 'overlap', 'search lesson chunks found in KB'; foreach ($p in '1009338','1009392','1010069','1011517','1011718','1011742','1012268','1012329') { $f = "project_id eq '$p' and gate_label eq 'Closeout'"; try { $q = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = $vq; filter = $f; top = 50; select = 'psr_row_id,body' } | ConvertTo-Json -Depth 8; $v = @((Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body $q -ContentType 'application/json').value); $sk = @($v | ForEach-Object { [string]$_.psr_row_id }); $sl = @($v | Where-Object { [string]$_.body -match 'lesson' } | ForEach-Object { [string]$_.psr_row_id }); $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $kk = @((Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json').references | Where-Object { $_ } | ForEach-Object { [string]$_.sourceData.psr_row_id }); '{0,-8} {1,-7} {2,-7} {3,-8} {4} of {5}' -f $p, $sk.Count, $kk.Count, @($kk | Where-Object { $sk -contains $_ }).Count, @($sl | Where-Object { $kk -contains $_ }).Count, $sl.Count } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-8} ERROR {1}' -f $p, $m } }
```

Read it for:

- The 1009338 row should read `50 50 50 2 of 2`, matching [A37](commands.md#a37). If it doesn't, stop: the setup changed.
- `overlap` equal to both counts on a row: the same chunks on that project.
- `overlap` below the counts: the two APIs return different chunks. The last column then says whether the lesson-mentioning chunks survived anyway.
- `ERROR` on a row: that project wasn't measured. Its row proves nothing.

<a id="o4"></a>

### O4. Precision, tokens and latency of `none` against default reranking

Size and time per project. It runs 16 retrieves one after another.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $rtu = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; '{0,-8} {1,-7} {2,-5} {3,-10} {4,-10} {5}' -f 'project', 'mode', 'refs', 'ref chars', 'body chars', 'wall ms'; foreach ($p in '1009338','1009392','1010069','1011517','1011718','1011742','1012268','1012329') { foreach ($mode in 'rerank','none') { try { $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '$p' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = $mode } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $t0 = Get-Date; $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $ms = [int]((Get-Date) - $t0).TotalMilliseconds; $refs = @($r.references | Where-Object { $_ }); $rc = if ($refs.Count) { (ConvertTo-Json -InputObject $refs -Depth 8 -Compress).Length } else { 0 }; $bc = 0; foreach ($x in $refs) { $bc += ([string]$x.sourceData.body).Length }; '{0,-8} {1,-7} {2,-5} {3,-10} {4,-10} {5}' -f $p, $mode, $refs.Count, $rc, $bc, $ms } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-8} {1,-7} ERROR {2}' -f $p, $mode, $m } } }
```

Read it for:

- `refs` should match [F16](evidence.md#f16). A mismatch means the setup changed.
- `ref chars` is the size of the references as JSON, all `sourceData` fields included. Divide by 4 for a rough token count per project, which is what the answer step receives if it passes references through whole.
- `body chars` is the chunk text alone, the floor if the answer step passes only `body`.
- `wall ms` is round-trip time from this machine, one call at a time. Compare the `none` rows against the `rerank` rows, and the sum against the 30-second target, keeping in mind that the pipeline may run projects in parallel.

Precision needs a reader. The command below prints the text of each default-reranked reference on 1009338 and the activity arguments. Count how many carry lessons prose, then compare with the 50 from `none` (saved by the optional capture command in Operating notes).

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $rtu = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50 } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; try { $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; '--- ACTIVITY ARGUMENTS ---'; $r.activity | Where-Object { $_.type -eq 'searchIndex' } | ForEach-Object { $_.searchIndexArguments | Select-Object queryType, semanticConfigurationName, searchConfigurationName, @{n='searchFieldsCount';e={@($_.searchFields | Where-Object { $_ }).Count}} } | Format-List; '--- REFERENCES ---'; @($r.references | Where-Object { $_ }) | ForEach-Object { $t = ([string]$_.sourceData.body) -replace '\s+', ' '; if ($t.Length -gt 120) { $t = $t.Substring(0, 120) }; '{0,-6} doc={1}' -f $_.rerankerScore, $_.sourceData.citation_doc_name; '       ' + $t } } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- How many of the roughly 9 references carry lessons prose. If most do, default reranking is precise but incomplete; [F16](evidence.md#f16) shows what it loses.
- `queryType` in the activity arguments. The spec changelog records it being added there, and [A8](commands.md#a8)'s dump didn't show it.
- Which of `semanticConfigurationName` and `searchConfigurationName` the service fills. An earlier dump showed `searchConfigurationName: "default"`, which isn't in the documented activity arguments.

<a id="o5"></a>

### O5. Lists that name `content_vector`: stored as sent, and keyword scope

The stored-list half:

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ksu = "$env:AZURE_SEARCH_ENDPOINT/knowledgesources/ps-ks-allfields?api-version=2026-08-01-preview"; try { $sdf = @((Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters.sourceDataFields | ForEach-Object { @{ name = $_.name } }); foreach ($v in @( @{ label = 'body + content_vector'; names = @('body', 'content_vector') }, @{ label = 'restore []'; names = @() } )) { $sf = @($v.names | ForEach-Object { @{ name = $_ } }); $body = @{ name = 'ps-ks-allfields'; kind = 'searchIndex'; description = 'searchFields emptied.'; searchIndexParameters = @{ searchIndexName = 'project_similarity_index'; sourceDataFields = $sdf; searchFields = $sf } } | ConvertTo-Json -Depth 12; Invoke-RestMethod -Method Put -Uri $ksu -Headers $h -Body $body -ContentType 'application/json' | Out-Null; $sp = (Invoke-RestMethod -Uri $ksu -Headers $h).searchIndexParameters; $state = if (-not ($sp.PSObject.Properties.Name -contains 'searchFields')) { 'ABSENT' } else { ConvertTo-Json -InputObject @($sp.searchFields) -Compress }; '{0,-22} sent {1,-2} fields   stored = {2}' -f $v.label, $sf.Count, $state } } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `stored = [{"name":"body"},{"name":"content_vector"}]`: the service stores the list as sent.
- Any other stored value: the service rewrites the list, and option B in [implementation.md](implementation.md) needs a read-back after every PUT.
- The last line must read `restore []` with `stored = []`. If the command stops with `ERROR` between the two PUTs, `ps-ks-allfields` may be left holding the narrow list; rerun it.

The keyword-scope half has no count-based test. The vector query fills every candidate slot ([F13](evidence.md#f13)), so the count reads the same whether BM25 searches one field or all of them. Option A in [implementation.md](implementation.md) (no list) doesn't depend on it.

<a id="o6"></a>

### O6. Discovery design: gate coverage and ranking signal

Design work, no command. Two choices, both laid out in [search-api-parity.md](search-api-parity.md):

- **Gate coverage.** Pick one of the three ways out under [Gate coverage](search-api-parity.md#gate-coverage). Stamping coverage at ingest keeps today's behavior and needs an index change.
- **Ranking signal.** Pick how `rank_projects` orders projects and runs the narrow-down gate without `rerankerScore`, from the options under [Ranking signal](search-api-parity.md#ranking-signal).

Counting and sorting are [O10](#o10).

<a id="o7"></a>

### O7. `neverQuerySource` at `minimal` effort

[A13](commands.md#a13) failed on a typo in a knowledge source name. This is the corrected request.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $rtu = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/retrieve?api-version=2026-08-01-preview"; $b = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'knowledgesource-1788979786196'; kind = 'searchIndex'; filterAddOn = "project_id eq '1009338' and gate_label eq 'Closeout'"; includeReferences = $true; maxOutputDocuments = 50 }, @{ knowledgeSourceName = 'knowledgesource-1789660272864'; kind = 'searchIndex'; neverQuerySource = $true }, @{ knowledgeSourceName = 'knowledgesource-1789660431937'; kind = 'searchIndex'; neverQuerySource = $true } ); includeActivity = $true } | ConvertTo-Json -Depth 12; try { $r = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $acts = @($r.activity | Where-Object { $_.type -eq 'searchIndex' }); 'references: ' + @($r.references | Where-Object { $_ }).Count + '   searchIndex activities: ' + $acts.Count; $acts | Select-Object id, count, @{n='filter';e={$_.searchIndexArguments.filter}} | Format-Table -AutoSize } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `searchIndex activities: 1`, with the Closeout filter: `neverQuerySource` works at `minimal`, and the production knowledge base can serve the evidence fetch without a single-source copy.
- `searchIndex activities: 3`: the flag is ignored at `minimal`. Use a single-source knowledge base.
- `ERROR` with HTTP 400: the service rejects the flag here. Read the message.

<a id="o8"></a>

### O8. The MCP tool's input schema

Needs `az` signed in with a role that can query the knowledge base (Entra token, audience `https://search.azure.com`).

```powershell
$tok = az account get-access-token --resource https://search.azure.com --query accessToken -o tsv; $u = "$env:AZURE_SEARCH_ENDPOINT/knowledgebases/knowledgebase-1788979805148/mcp?api-version=2026-08-01-preview"; $b = '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'; try { $r = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $u -Headers @{ Authorization = "Bearer $tok"; Accept = 'application/json, text/event-stream' } -Body $b -ContentType 'application/json'; 'HTTP ' + $r.StatusCode; 'filterAddOn in schema: ' + ($r.Content -match 'filterAddOn'); 'knowledgeSourceParams in schema: ' + ($r.Content -match 'knowledgeSourceParams'); $r.Content } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'ERROR ' + $m }
```

Read it for:

- `filterAddOn in schema: True`: MCP can carry the `search.ismatch` workaround. Revisit [ADR 4](decisions.md#adr-4).
- `False`: MCP can't carry it. That result is the citable reason for [ADR 4](decisions.md#adr-4).
- `ERROR` with 401 or 403: the token or role is missing. An error asking for `initialize` means the server wants the MCP handshake first.

<a id="o9"></a>

### O9. `search.ismatch` end to end on the failing prompts

No command yet. [F21](evidence.md#f21) proves the syntax parses. Whether it fixes an answer needs prompts where the parser matters. The eight-project prompt can't test it: it names every project, so the filter is a `project_id` equality and no text reaches a parser.

| # | Prompt | Construct | Arms that must differ |
|---|---|---|---|
| P0 | "List the lessons learned for project 1009338." | none | none; the control |
| P1 | "Which projects used Amazon Web Services as a vendor?" | all words required | `simple/all`, `simple/any`, no filter |
| P2 | "What lessons came from the Fronteer upgrade?" (misspelling kept) | fuzzy | `full/any` with `Fronteer~1`, `simple`, no filter |
| P3 | "Show projects where Yusoff was sponsor or work lead." | field scoping | `search.ismatch('Yusoff','roles_project_sponsor,roles_work_lead')`, no filter |
| P4 | "Find projects about decommissioning legacy infrastructure." | concept, no exact term | no filter against every arm; the negative control |
| P5 | "Which projects mention schedule and delay close together in the closeout narrative?" | proximity | `full` with `"schedule delay"~10`, `simple`, no filter |
| P6 | "Find projects in the decommission family: decommission, decommissioning, decommissioned." | prefix against regex | `simple` with `decommission*`, `full` with `/decommission.*/`, no filter |
| P7 | "Which SAP projects had lessons learned but were not Hardware Deploy?" | negation | `simple/all` with `SAP -Hardware`, `full` with `SAP NOT Hardware`, no filter |
| P8 | "Give me lessons learned from closed projects in the Kinaxis portfolio." | phrase boost | `search.ismatchscoring('"lessons learned"^3','body,title','full','any')`, `search.ismatch` with the same arguments, no filter |

Run P0, P1, P3 and P8 first. Hold the filter scope and `maxOutputDocuments` fixed and vary only the `search.ismatch` call. Record per arm: references, activity count, the golden project IDs recovered, and how many returned chunks carry the target content. The last column decides. Run the arms on a knowledge source with the vector query on ([F9](evidence.md#f9)), or the result measures the missing vector query instead of the filter.

<a id="o10"></a>

### O10. Complete project enumeration on the Retrieval API

Tests the route for Lanes 2, 3 and 4 under [Complete project enumeration](search-api-parity.md#complete-project-enumeration), and staging claim [U9](staging-findings.md#u9). The filter is the Hardware Deploy prompt from [F23](evidence.md#f23) row 12. The Search API side facets `project_id`. The Retrieval API side retrieves up to 200 rows with the reranker bypassed, collects `project_id` in code, and sorts by `pect_total_actuals` in code. `ps-ks-allfields` must still store `searchFields: []`.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $f = "project_solution eq 'Hardware Deploy (Infrastructure Hardware)'"; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $sp = @(); $kp = @(); try { $q = @{ search = '*'; filter = $f; facets = @('project_id,count:1000'); top = 0; count = $true } | ConvertTo-Json -Depth 6; $r = Invoke-RestMethod -Method Post -Uri $su -Headers $h -Body $q -ContentType 'application/json'; $sp = @($r.'@search.facets'.project_id | Where-Object { $_ } | ForEach-Object { [string]$_.value }); 'Search API     matching rows = ' + $r.'@odata.count' + '   distinct projects (facet) = ' + $sp.Count } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'Search API     ERROR ' + $m }; try { $b = @{ intents = @( @{ type = 'semantic'; search = '*' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 200; resultsProcessing = 'none' } ); maxOutputDocuments = 200; maxOutputSize = 200000; includeActivity = $true } | ConvertTo-Json -Depth 12; $r2 = Invoke-RestMethod -Method Post -Uri $rtu -Headers $h -Body $b -ContentType 'application/json'; $refs = @($r2.references | Where-Object { $_ }); $a = @($r2.activity | Where-Object { $_.type -eq 'searchIndex' })[0]; $kp = @($refs | ForEach-Object { [string]$_.sourceData.project_id } | Where-Object { $_ } | Sort-Object -Unique); 'Retrieval API  references = ' + $refs.Count + '   candidates = ' + $a.count + '   distinct projects = ' + $kp.Count + '   references without project_id = ' + @($refs | Where-Object { -not $_.sourceData.project_id }).Count; $best = @{}; foreach ($x in $refs) { $p = [string]$x.sourceData.project_id; $v = $x.sourceData.pect_total_actuals; if ($p -and ($null -ne $v)) { if ((-not $best.ContainsKey($p)) -or ([double]$v -gt $best[$p])) { $best[$p] = [double]$v } } }; 'top 10 by pect_total_actuals, sorted in code from Retrieval API references:'; $i = 0; foreach ($e in @($best.GetEnumerator() | Sort-Object Value -Descending | Select-Object -First 10)) { $i++; '  {0,2}. {1,-10} {2:N0}' -f $i, $e.Key, $e.Value }; if ($i -eq 0) { '  (no reference carries pect_total_actuals)' } } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; 'Retrieval API  ERROR ' + $m }; if ($sp.Count -and $kp.Count) { $miss = @($sp | Where-Object { $kp -notcontains $_ }); 'in the facet but missing from the Retrieval API: ' + $miss.Count + '   ' + (($miss | Select-Object -First 10) -join ', ') } else { 'comparison skipped: one side returned no projects' }
```

Read it for:

- `matching rows` 200 or fewer, and `missing from the Retrieval API: 0`: retrieve returned every matching project. Lanes 2 and 4 have a route for filters this size, and U9 can be promoted.
- `missing` above 0 while `matching rows` is 200 or fewer: retrieve drops rows even with the reranker bypassed, the same pattern as [F18](evidence.md#f18). The route fails as built; the next try filters to record rows only.
- `matching rows` above 200: the 200-row cap binds. The project count can still match if chunks crowd into few projects; if it doesn't, the filter needs splitting.
- `references without project_id` above 0: `project_id` isn't in `sourceDataFields` on `ps-ks-allfields`, so the distinct count is too low.
- The top 10: ZEST 1012929 should be sixth, as in the Search API answer ([F23](evidence.md#f23) row 12). `(no reference carries pect_total_actuals)` means the field isn't in `sourceDataFields` or sits only on rows that didn't come back.
- `ERROR` on either side: that side proves nothing, and the comparison is skipped.

## Operating notes

- **Environment.** In each new PowerShell shell, run `. .\src\api\env.ps1` from the root of the application repository. It sets `AZURE_SEARCH_ENDPOINT` and `AZURE_SEARCH_API_KEY`.
- **API versions.** Search API queries use `2024-07-01`, index reads use `2026-04-01`, and knowledge sources, knowledge bases and retrieve use `2026-08-01-preview`.
- **Test objects.** `ps-kb-isolated` (over the production knowledge source), `ps-kb-allfields` and `ps-ks-allfields` (`searchFields: []` after [A36](commands.md#a36)). [ADR 2](decisions.md#adr-2) says why they exist.
- **Knowledge base LLM.** If a model is ever attached, it must be a native endpoint. The Microsoft staff answer on [Q&A 5955030](https://learn.microsoft.com/en-us/answers/questions/5955030/apim-not-supported-for-knowledge-base-llm-in-agent), 2026-08-01: "These calls expect a native Azure OpenAI/Foundry endpoint and a supported auth model, not an APIM proxy."
- **PowerShell.** The traps are in `CLAUDE.md` at the repository root. This machine runs Constrained Language Mode. Piping a multi-line script into `powershell.exe -Command -` prints nothing; stub tests run with `powershell.exe -NoProfile -NonInteractive -Command "Get-Content -Raw -Path '.\file.ps1' | Invoke-Expression"`. The current stub is `temp\handoff-check\stub17.ps1`, with the runner `run17.sh`.
- **Capture raw evidence (optional).** Reruns the three [A37](commands.md#a37) calls and writes each request and response to `.\same-chunks-evidence\`. Expect `HTTP 200 items=50` three times and `overlap with KB = 50` twice. The response files hold full chunk `body` text.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; $f = "project_id eq '1009338' and gate_label eq 'Closeout'"; $su = "$ep/indexes/project_similarity_index/docs/search?api-version=2024-07-01"; $rtu = "$ep/knowledgebases/ps-kb-allfields/retrieve?api-version=2026-08-01-preview"; $dir = Join-Path (Get-Location) 'same-chunks-evidence'; New-Item -ItemType Directory -Force -Path $dir | Out-Null; $vq = @( @{ kind = 'text'; text = 'lessons learned'; fields = 'content_vector'; k = 50 } ); $calls = @( @{ name = '1-search-hybrid'; uri = $su; body = @{ search = 'lessons learned'; vectorQueries = $vq; filter = $f; top = 50; select = 'psr_row_id,body' } }, @{ name = '2-search-hybrid-semantic'; uri = $su; body = @{ search = 'lessons learned'; queryType = 'semantic'; semanticConfiguration = 'default'; vectorQueries = $vq; filter = $f; top = 50; select = 'psr_row_id,body' } }, @{ name = '3-kb-retrieve'; uri = $rtu; body = @{ intents = @( @{ type = 'semantic'; search = 'lessons learned' } ); knowledgeSourceParams = @( @{ knowledgeSourceName = 'ps-ks-allfields'; kind = 'searchIndex'; filterAddOn = $f; includeReferences = $true; includeReferenceSourceData = $true; maxOutputDocuments = 50; resultsProcessing = 'none' } ); maxOutputDocuments = 50; maxOutputSize = 200000; includeActivity = $true } } ); $keys = @{}; $failed = $false; foreach ($c in $calls) { $req = $c.body | ConvertTo-Json -Depth 12; Set-Content -Path (Join-Path $dir "$($c.name).request.json") -Value $req -Encoding UTF8; try { $resp = Invoke-WebRequest -UseBasicParsing -Method Post -Uri $c.uri -Headers $h -Body $req -ContentType 'application/json'; Set-Content -Path (Join-Path $dir "$($c.name).response.json") -Value $resp.Content -Encoding UTF8; $j = $resp.Content | ConvertFrom-Json; $keys[$c.name] = if ($c.name -like '3*') { @($j.references | Where-Object { $_ } | ForEach-Object { [string]$_.sourceData.psr_row_id }) } else { @($j.value | ForEach-Object { [string]$_.psr_row_id }) }; '{0,-26} HTTP {1}  items={2}' -f $c.name, $resp.StatusCode, $keys[$c.name].Count } catch { $failed = $true; $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; '{0,-26} ERROR {1}' -f $c.name, $m } }; if ($failed) { 'overlap not computed: a call failed' } else { $kb = $keys['3-kb-retrieve']; foreach ($n in '1-search-hybrid','2-search-hybrid-semantic') { '{0,-26} overlap with KB = {1}' -f $n, @($keys[$n] | Where-Object { $kb -contains $_ }).Count } }; 'files written to ' + $dir
```

- **Cleanup, when testing is finished.** Deletes every `ps-` test object. The production knowledge source is deliberately absent from the list: `ps-kb-isolated` only references it. Knowledge bases go first, because the service refuses to delete a knowledge source that a knowledge base references. Each line reads `deleted` or `skipped` with the reason.

```powershell
$h = @{ 'api-key' = $env:AZURE_SEARCH_API_KEY }; $ep = $env:AZURE_SEARCH_ENDPOINT; foreach ($kb in 'ps-kb-allfields','ps-kb-isolated') { $u = "$ep/knowledgebases/$($kb)?api-version=2026-08-01-preview"; try { Invoke-RestMethod -Method Delete -Uri $u -Headers $h | Out-Null; "deleted $kb" } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; "skipped $($kb): $m" } }; foreach ($ks in 'ps-ks-allfields') { $u = "$ep/knowledgesources/$($ks)?api-version=2026-08-01-preview"; try { Invoke-RestMethod -Method Delete -Uri $u -Headers $h | Out-Null; "deleted $ks" } catch { $m = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }; "skipped $($ks): $m" } }
```
