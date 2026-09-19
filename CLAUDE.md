# CLAUDE.md

This repo is a writing and research space, not the repo where the application code runs. There is no access to Azure resources or to the application code from here. Everything you produce is something the user reads, or a step they port over and run by hand.

## Deliver in chat by default

- Answer in chat. Create a file only when the user asks for one directly.
- Put scratch work in `temp/`: throwaway scripts, syntax checks, intermediate output. The user never has to look there.
- Edit an existing document only when the user asks for that edit. New findings go to chat first.

## Evidence standard

- Treat a claim as confirmed only when a test on the user's service produced a number that proves it.
- "The parameter is absent from the contract" is a finding. "No workaround exists" is an opinion until tested. Say which one you have.
- Before asserting how a Microsoft service behaves, read the current Microsoft documentation and quote it inline with the URL.
- Check that a quoted sentence still exists on the current page. Microsoft retires sentences, and a quote from a pulled page is not evidence.

## Commands the user runs

The user pastes every command into Windows PowerShell 5.1. Their terminal collapses newlines on paste.

- Make every command self-contained: inline `$env:AZURE_SEARCH_ENDPOINT` and `$env:AZURE_SEARCH_API_KEY` in each one, so it runs with no edits.
- Write each command as one physical line. Separate hashtable entries with `;`.
- Run the non-network part in `temp/` first to prove it parses and the JSON body has the right shape.
- After each command, say what to look for and what each possible result means.
- Walk through results one step at a time: read what came back, say what it proves, then give the next command.

PowerShell traps already hit here:

- `$obj.PSObject.Properties.Remove()` throws under Constrained Language Mode. Use `Select-Object -Property * -ExcludeProperty ...` instead.
- `Select-Object -Property *` is a shallow copy. Round-trip through `ConvertTo-Json -Depth 20 | ConvertFrom-Json` before mutating a nested property.
- A `?` directly after a variable inside a string breaks the URL. Write `$($var)?api-version=...`.
- `@($undefinedVar.prop).Count` returns 1, not 0. After a failed call, a count line prints a false result.
- `ConvertTo-Json` escapes `'` as `'`. That is valid JSON and Azure parses it.
- Execution policy on this machine blocks running a `.ps1` directly. To test one in `temp/`, pipe it: `cat file.ps1 | powershell.exe -NoProfile -NonInteractive -Command -`.

## Documents

- Documents describe the current state and the ground truth. Leave out how we got there: no "previously", no "correction", no change history.
- Unproven findings go to a staging document first. A finding moves to the main document only with the command, the number it produced, and a date.
- Inline comments and docstrings cover business logic and whatever the code cannot explain by itself.
- Write an ADR when a decision had a real alternative that was rejected for a stated reason.
- Prefer visuals. Use ASCII diagrams and tables wherever they carry the point faster than prose.

## Writing rules

Content:

- Name the literal term and the actual field: `searchFields` on the knowledge source, not "the field settings".
- Resolve every ambiguous noun. "Items" must say rows, requests or results.
- State the mechanism. Replace a feeling, such as "a relevance guess", with what the system does.
- Every claim carries its number and where the number came from.
- Give one line of why after the concrete what.
- Replace a comparative with its reason: "the two systems the prompt names" instead of "the sharpest term".
- Make every sentence stand alone. A reader with no chat history must be able to follow it.
- Use the system's own name for each thing, pick one name, and repeat it. Keep the label the data already uses.
- Keep each fact in one place. Cut any summary that restates the sections above it.
- Leave out ticket numbers, internal task labels, and references to files the reader cannot open.

Form:

- Use a colon, comma or period where an em dash would go. No em dashes.
- Make it scannable: bullets grouped by category. Verbatim data first, then one summary sentence.
- Delete on sight: "Verified live", "Checked live", "real" as an intensifier, "Note that", "It is worth noting", "Importantly".
- Use the fewest words that stay clear, in plain language a reader gets on the first pass.

Voice:

- Plain verbs: "we want to deploy", "it takes long", "can you review".
- One short sentence stating the thing, then the reason in the next.
- Contractions and casual connectors are fine: "it's", "we need to", "this is because", "so that we can".
- Walk cause to effect in flowing sentences, without label scaffolding such as "The difference." or "The consequence."
- Name the concrete thing. Example: "The Search API can use `select` to focus on specific fields, which cuts noise. The Retrieval API can't, so it searches every field, and on questions about X that noise makes the answer worse."

## Project Similarity

Working documents live in `Project Similarity/Project Similarity KB/`. The staging document for unproven findings is `staging-findings.md` in that folder, and its promotion rule is at the top of the file.
