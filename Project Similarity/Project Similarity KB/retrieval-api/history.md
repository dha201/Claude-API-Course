# History of the Retrieval API investigation

This is the one document in this folder that records how the investigation got here. Every other document describes the current state only. Nothing here is current guidance: when this file and [ground-truth.md](ground-truth.md) disagree, ground-truth.md wins.

## Timeline

| Date | What ran | What it showed |
|---|---|---|
| 2026-09-15 | Single-project sweep on project 1012173, production knowledge base ([F18](evidence.md#f18)) | `lessons learned` returned 4 of 88 chunks; `*` returned 50 |
| 2026-09-16 | The eight-project prompt through the deployed DEV pod ([F17](evidence.md#f17)) | 10 references from 4,259 Closeout chunks; 1012329 got no evidence call |
| 2026-09-17 | Probes on the production knowledge source and single-source baselines ([A1](commands.md#a1) to [A19](commands.md#a19)); six research sweeps of Microsoft Learn, GitHub, blogs and forums | The working belief became "the Retrieval API runs keyword search only" |
| 2026-09-18 | Service and index settings ([A22](commands.md#a22), [A23](commands.md#a23)), `searchFields` variants ([A24](commands.md#a24)), reranker bypass ([A26](commands.md#a26) to [A30](commands.md#a30)) | The vector query runs; the reranker hid it ([F8](evidence.md#f8)) |
| 2026-09-18 | Token budget ([A32](commands.md#a32)), Search API baseline ([A33](commands.md#a33)), eight-project parity ([A34](commands.md#a34)) | The default budget capped references at 9; parity on all eight projects ([F12](evidence.md#f12), [F16](evidence.md#f16)) |
| 2026-09-18 | Production list against empty list ([A35](commands.md#a35)), lists with `content_vector` ([A36](commands.md#a36)), same-chunks check ([A37](commands.md#a37)) | The production `searchFields` list turns the vector query off ([F9](evidence.md#f9)) |
| 2026-09-18 | The six working documents and the investigation handoff merged, then split into this folder | |

## Claims that turned out wrong

Each row is a claim that one or more earlier documents stated as fact. Don't reintroduce any of them.

| Earlier claim | Why it looked true | What replaced it |
|---|---|---|
| The Retrieval API runs keyword search only, with no vector query | The gibberish token returned 0 references and count 0 on the production knowledge base ([A10](commands.md#a10)) and on the copy with `searchFields` emptied ([A18](commands.md#a18)) | Activity `count` is taken after the reranker. With the reranker bypassed, the same token finds 51 candidates, all vector neighbours ([F8](evidence.md#f8)) |
| The production `searchFields` list "starves the keyword lane" because it omits `body`, and emptying it gave "a 9x keyword recall gain" | 1 reference with the list, 9 without it ([F7](evidence.md#f7)) | BM25 over every field finds only 1 result for `lessons learned` ([F14](evidence.md#f14)). The gain came from the vector query, which the list turns off ([F9](evidence.md#f9)) |
| `rerankerThreshold` is inert | 1.0, 0.0, 2.0 and 3.0 all gave count 1 on the production knowledge source | The one survivor scored 3.846, above every tested value. With 50 candidates the threshold cuts: 9 at the default, 13 at 0 ([F11](evidence.md#f11)) |
| `maxOutputDocuments` 1 and 10 return count 1 | The command printed `count 1` | The service rejects values below 50. A failed call printed a false count of 1 ([F6](evidence.md#f6)) |
| References cap at 9 to 13 for an unknown reason (stored `retrieveDefaults`, deduplication and others were listed as suspects) | Neither the threshold nor the reranker bypass lifted references past 13 | The default output token budget capped them. `maxOutputSize` 200,000 lifts them to 50 ([F12](evidence.md#f12)) |
| Candidates are capped at 50 per subquery, a fixed limit | Source retrieved stayed at 50 on project 1012173 whatever the settings ([F18](evidence.md#f18)) | 50 is the semantic ranker's window. With the reranker bypassed, candidates follow `maxOutputDocuments`: 200 at 200 ([F13](evidence.md#f13)) |
| `resultsProcessing: "none"` doesn't help | It still returned 9 references ([F11](evidence.md#f11)) | The token budget was the cap. With `maxOutputSize` 200,000 it returns 50 ([F12](evidence.md#f12)) |
| Two gates decide whether the vector field takes part: the vectorizer, and query execution scope. Open forks: `searchFields` absent against empty, and vectorizer authentication through the proxy | Microsoft names both conditions | The vectorizer works through the proxy ([F1](evidence.md#f1), [F8](evidence.md#f8)). Absent, `[]` and `*` behave alike ([F10](evidence.md#f10)). The list only matters when it's explicit and omits `content_vector` ([F9](evidence.md#f9)) |
| The production list holds 28 fields and omits `body` | A hand transcription of the activity array ([A8](commands.md#a8)) | The stored list reads back as 29 fields ([A36](commands.md#a36)). Whether `body` is among them is open ([O1](runbook.md#o1)) |
| 11 of 16 prompts fail | A count in the walkthrough | The evaluation sheet grades 12 worse, 2 same, 1 both declined, 1 mixed ([F23](evidence.md#f23)) |
| The eight-project run returned 9 references, 0.21% | A hand total | The per-project rows sum to 10, 0.23% ([F17](evidence.md#f17)) |
| The model-match test is still open | It was listed as a planned test | Relevant text scores 0.64 against 0.08 for irrelevant text on the same vectorizer ([F2](evidence.md#f2)) |
| "Longer search text" is a fix | 45 references for the full question against 1 | Only 2 of the 45 carry lessons prose, and the run was on the production knowledge source with the vector query off ([F20](evidence.md#f20)) |

## Why the misreadings happened

Four readings sent the investigation after a missing vector query that was never missing:

- **The gibberish probe.** 0 references and count 0 for `zqxjvwkbhf` were read as "no vector query ran". Count is taken after the reranker, which scored every vector neighbour irrelevant and dropped it.
- **The threshold sweep.** Its single survivor scored above every tested threshold, so the sweep couldn't show a cut.
- **The gap from 1 to 50.** It was blamed on a missing vector lane in general. The losses sit in three stages: the field list turned the vector query off, the reranker dropped candidates, and the token budget capped the rest.
- **`resultsProcessing: "none"` looked inert.** It still returned 9, because the token budget was the next cap. Limits mask each other.

Nothing in the index, the vectorizer or the knowledge source's vector handling changed to make it work. Removing the field list and two request settings made the retrieved results visible and let them through. The lessons are in the pitfalls list in [runbook.md](runbook.md).

The belief that the reranker couldn't be bypassed was true until `2026-08-01-preview`, which added `resultsProcessing`. Older sources describe the semantic ranker as mandatory for agentic retrieval.

## Research-agent errors

Research agents summarised sources during 2026-09-17. Some summaries were wrong, and each was caught by opening the source:

- They misreported the state of GitHub issues.
- They quoted sentences that aren't on the current pages. The list is under "Don't cite" in [sources.md](sources.md).
- One quoted a Microsoft Q&A staff answer with wording that isn't on the page.

## Earlier labels

Before this folder existed, the investigation handoff and the staging document numbered the same facts differently. Use this table to resolve an old reference.

| Handoff label | Finding | | Staging label | Finding |
|---|---|---|---|---|
| V1 | [F1](evidence.md#f1) | | V1 | [F1](evidence.md#f1) |
| V2 | [F2](evidence.md#f2) | | V2 | [F2](evidence.md#f2) |
| V3 | [F7](evidence.md#f7), [F8](evidence.md#f8) | | V3 | [F8](evidence.md#f8) |
| V4 | [F4](evidence.md#f4) | | V4 | [F4](evidence.md#f4) |
| V5 | [F5](evidence.md#f5) | | V5 | [F5](evidence.md#f5) |
| V6 | [F9](evidence.md#f9) | | V6 | [F9](evidence.md#f9) |
| V7 | [F7](evidence.md#f7) | | V7 | [F7](evidence.md#f7) |
| V8 | [F3](evidence.md#f3) | | V8 | [F11](evidence.md#f11), [F12](evidence.md#f12) |
| V9 | [F10](evidence.md#f10) | | V9 | [F11](evidence.md#f11) |
| V10 | [F11](evidence.md#f11) | | V10 | [F6](evidence.md#f6) |
| V11 | [F8](evidence.md#f8) | | V11 | [F10](evidence.md#f10) |
| V12 | [F8](evidence.md#f8), [F11](evidence.md#f11) | | V12 | [F3](evidence.md#f3) |
| V13 | [F12](evidence.md#f12), [F14](evidence.md#f14) | | | |
| V14 | [F16](evidence.md#f16) | | | |
| V15 | [F9](evidence.md#f9), [F13](evidence.md#f13) | | | |
| V16 | [F10](evidence.md#f10), [F15](evidence.md#f15) | | | |

Handoff commands N3, N4 and N8 are now the second [O4](runbook.md#o4) command, [O1](runbook.md#o1), and the evidence capture in [runbook.md](runbook.md). Handoff N6 is [O2](runbook.md#o2). The earlier single findings document, `retrieval-api-findings.md`, was split into this folder: its Appendix is [commands.md](commands.md), its findings are [evidence.md](evidence.md), and its open items are [runbook.md](runbook.md).
