# Dependency SQL Agent: open decisions for SME and stakeholder sign-off

Source: the "Needs confirmation" block at the foot of each of the twenty walkthroughs in
section 2.3 of the EDA and data mapping working doc, plus the "Still open" list under each
one. Compiled 2026-09-02.

## What the twenty walkthroughs say

All twenty answer **yes** to "Needs confirmation". Not one closes clean. F03.1 comes
closest: it is the only walkthrough with `Functional: None`, and both of its open items are
non-functional.

Ninety-odd raw bullets collapse into 16 functional and 7 non-functional decisions. Most
bullets are the same decision restated against a different prompt, which is the useful
signal here. The count in the "cases" column is how many of the twenty walkthroughs hit
that decision, and it is a fair priority order: the top three functional items decide the
answer for more than a third of the tested prompts each.

Two decisions are worth taking first, because everything downstream inherits them.
Deciding what the word "dependency" covers (F2) changes the answer set in 11 of 20 cases.
Deciding how a repeated work item number resolves (F1) changes which item the agent answers
about in 8 of 20. Neither is a data question. Both are business definitions the data cannot
settle.

## Functional decisions

| # | Decision | Cases | Decide with | Decision taken |
|---|---|---|---|---|
| F1 | Which item to answer for when a number names items in several orgs | 8 | Product owner | |
| F2 | Which link types the word "dependency" covers | 11 | Product owner | |
| F3 | Which field a prompt term gets searched in | 4 | Data SME | |
| F4 | Whether recall may depend on the user's exact wording | 5 | Product owner | |
| F5 | Which candidate to answer from when a search returns several | 3 | Product owner | |
| F6 | Whether removed, archived and "do not use" rows stay in scope | 4 | Data SME | |
| F7 | Which date pattern counts as a delay or a risk | 5 | Product owner | |
| F8 | Which area level names the team the answer quotes | 2 | Data SME | |
| F9 | What the agent does with a prompt term the data never records | 3 | Product owner | |
| F10 | What evidence establishes "the right contact" | 2 | Product owner | |
| F11 | What an aggregate answer returns, and how complete it must be | 4 | Product owner | |
| F12 | Which date fields define "start" and "complete" | 2 | Data SME | |
| F13 | Whether the link graph is the whole dependency truth | 4 | Data SME | |
| F14 | Whether a present-tense prompt is bounded to open work | 2 | Product owner | |
| F15 | How many prompt terms the agent combines before it stops | 2 | Engineering | |
| F16 | Whether results get filtered to the prompt's own naming | 2 | Product owner | |

### Finding the right work item

#### F1. Which item does the agent answer for when a number names items in several orgs?

Raised by F01.1, F01.2, F02.1, F06.2, F07.1, F07.2, F08.1 and F08.2. The product owner
decides.

A work item number is not unique. 382 of the 46,566 numbers that carry any dependency link
carry them in two orgs, and no number reaches three. Every tested case resolved by luck of
the data rather than by rule: only one org's item carried a dependency link, so the unscoped
walk returned one row. F06.2 and F08.1 resolve the same three-way collision two different
ways, and both land on the same item, which hides the fact that the agent has no rule.

Options the walkthroughs put on the table:

- Ask the user for the org before answering.
- Answer once per org and let the user pick.
- Walk the links unscoped and answer from whichever item carries dependency links (F06.2).
- Match the prompt's own qualifier against the area path (F08.1's "Trading IT / Allegro").

Nobody has measured how often several same-number items each hold dependency links, which
is the number that decides whether this needs a disambiguation step at all. F07.2, F08.1 and
F08.2 each resolved their collision through the prompt's team qualifier, and all three note
the same gap: a qualifier that matches two candidates' paths leaves the number ambiguous
again.

Left open, the agent can answer confidently about the wrong company's work item.

#### F5. Which candidate does the agent answer from when a search returns several?

Raised by F02.2, F04.1 and F04.2. The product owner decides.

Three shapes of the same problem. F02.2's prompt says "in SAP" without naming the sub-track
or the PI wave, and four candidates match. F04.1's walk returns two successors, `1850341`
under Rail Data and Analytics and `1828281` under Rail Optimization, and nothing in the data
labels which one owns the write-back dependency. F04.2 returns two items with byte-identical
titles and no other distinguishing text.

Every tested case survived the ambiguity because the candidates converged on the same
answer. F04.2 says it plainly: the tied pair differs on `CLOSED_DATE` (2025-11-19 against
2026-01-29), but picking the newer one is a choice, not a rule the schema states. The
non-converging case has never been tested.

Left open, the agent picks arbitrarily and the answer looks as confident as any other.

#### F15. How many prompt terms does the agent combine before it stops narrowing?

Raised by F04.1 and F04.2. Engineering decides, with a rule the SME can sanity check.

F04.1's three terms intersect to exactly one row. Drop one and "write-back to SCDH" returns
9. The schema states no rule for when to stop adding terms. F04.2 raises the mirror case:
`981562`, the item that holds the answer, matches `%GITHUB%RUNNER%` directly and sits in the
613 rows the IDEAS filter excludes, so a different term combination would have found the
answer without walking any links at all.

Left open, recall swings on an implementation detail nobody has agreed.

#### F3. Which field does a prompt term get searched in?

Raised by F03.2, F05.2, F09.1 and F09.2. The data SME decides.

The schema states no rule, and the field choice changes what the agent finds rather than
just how much. "Process mining" returns 214 unrelated rows in `TITLE` and does not include
the requester, but resolves correctly against the area path. "SAP PO" is useless in `TITLE`
(5,016 rows across 273 teams) and works in the area path. The squad names `Bengals` and
`Ravens` sit in both fields with very different coverage: 677 items by title against 17,951
by area. "Brazil Tax Reform" resolves to no usable set in any field checked.

The distinction the doc draws is worth keeping: a title says what one work item does, an
area path says what type of work a team does. That is close to a rule, and it is what I
would put in front of the SME to confirm or reject.

Left open, the same prompt succeeds or fails depending on which field the generated SQL
happens to hit.

#### F4. Can recall depend on the user's exact wording?

Raised by F02.2, F03.2, F05.1, F05.2 and F09.2. The product owner decides.

Five separate walkthroughs found real work that the prompt's own wording cannot reach.

- F02.2: the initiative is spelled "Brazil Tax Reform" in the prompt and "Brazilian TAX
  Reform" by the linked teams. Widening to `%BRAZIL%TAX%` returns 32 rows against the
  prompt's 10, and two of the extras are the items the initiative already links to.
- F03.2 and F09.2: Celonis is the process mining product, and 331 of its 477 items sit under
  paths with no "mining" in them, invisible to the `%MINING%` search.
- F05.1: the subject terms as spelled catch 111 items. "NF-e" with a hyphen and "e-billing"
  are not counted.
- F05.2: the prompt's two tokens cover 8 of the 12 Bengals-to-Ravens links. The other 4 are
  the same dependency worded as "Refresh ACC tables from Mike's List".

None of these changed a verdict, which is exactly why it is easy to sign off without
noticing. The decision is whether the agent is allowed to answer from a wording-sensitive
search with no signal to the user, or whether it owes a synonym pass or a coverage caveat.

#### F9. What does the agent do with a prompt term the data never records?

Raised by F03.2, F09.1 and F09.2. The product owner decides.

"SAP" appears in no field on F03.2's target item across both databases, and reaches 13 of
the 579 items F09.2 returns, none of them the four verified ones. The tables are SAP tables.
The data never says so. F09.1's "Brazil Tax Reform" behaves the same way: 503 rows across 76
teams, and its 44 dependency links never reach the `SAP PO-CI` group the answer names.

Both walkthroughs answered correctly on the remaining terms, so the failure is silent. F09.2
states it flatly: the answer rests on two terms out of three, and a prompt naming a
different source system would narrow no further.

Left open, the user believes their third term did work it never did.

### What counts as a dependency

#### F2. Which link types does the word "dependency" cover?

Raised by F01.1, F01.2, F02.1, F02.2, F07.1, F07.2, F08.1, F08.2, F09.1, F10.1 and F10.2.
The product owner decides. This is the one to settle first.

Rule 4 keeps `Predecessor` and `Consumes From` and drops everything else. That exclusion is
counted in every walkthrough and read in none. The volumes:

| Case | Kept | Excluded and never read |
|---|---|---|
| F01.1 | 1 link | 70 active (62 `Related`, 4 `Child`, 4 `Parent`) |
| F01.2 | 1 link | 87 active (71 `Related`, 12 `Child`, 4 `Parent`) |
| F02.1 | 1 `Predecessor` | 12 (8 `Related`, 4 `Parent`) |
| F02.2 | 6 link targets | 25 on item `1627170` |
| F07.1 | 1 link | 69 on the four same-numbered items |
| F07.2 | 2 of 20 active links | 18 (12 `Child`, 5 `Related`, 1 `Parent`) |
| F08.1 | 7 predecessors | 18 (17 `Related`, 1 `Parent`), 12 in the same deadlock cluster |
| F08.2 | 2 predecessors | 7 (6 `Related`, 1 `Parent`), same-team earlier table work |

Every one of those rows carries the same sentence: a reading of "depends on" that includes
the parent epic's team would change the answer, and nothing in the data rules that reading
out. F07.2 is the sharpest version, because the prompt literally says "linked dependencies"
and the agent returns 2 of the item's 20 links.

The second half of this decision is the two dependency mechanisms. `Predecessor` is 100%
same-org, `Consumes From` is 100% cross-org. F10.1 counts 10,972 out-of-sequence
`Predecessor` links and leaves the 150 `Consumes From` ones outside the number. F10.2 does
the same. F09.1's aggregate does not split the 192 `Predecessor` links from the 19
`Consumes From` ones, so whether late delivery clusters in one mechanism is untested.

Options: dependency types only, dependency types plus `Related`, or the full link list with
the type shown so the user judges.

Left open, every answer in the corpus is provisional, because the set it is drawn from is
provisional.

#### F6. Do removed, archived and "do not use" rows stay in scope?

Raised by F02.1, F05.1, F05.2 and F06.1. The data SME decides.

Four different exclusions, none of them settled:

- A `Removed`-state item still carries active links. F05.1 has 4 of 30 links pointing at
  `Removed` predecessors, F05.2 has 1 of 10. Item `1773259` has `STATE = Removed` and
  `IS_ACTIVE = TRUE` on its link.
- 3 of F05.1's 30 links point at items under `OTC FnL (Do not use)`. The area code excludes
  itself by name and live items consume from it anyway.
- 4,426 of the 25,469 Snowflake-titled items in F06.1 sit under `zArchive`, `zRetired` or
  `To-be Retired`. Excluding them changes every count in the ranking, though not the top
  team. Whether the `z` prefix means retired is itself unconfirmed.
- F02.1 notes that `IS_ACTIVE` and `IS_CURRENT` are applied in every query and counted in
  none, so how many deleted or superseded links sit behind those filters is unknown.

Left open, two engineers write the same query and get different totals.

#### F13. Is the link graph the whole dependency truth?

Raised by F02.1, F02.2, F04.1 and F05.1. The data SME decides.

Three other places record the same relationship, and no walkthrough reads any of them.
`CUSTOM_DEPENDENCY_CONTACT` and `CUSTOM_DEPENDENCY_TYPE` are purpose-built fields on the
item table. Azure SQL carries `DependencyRequestInfo` and `DependencyType`. F04.1 found a
hand-written `#1828281` pointer in a description, and checked one case: that pointer was
also in the link graph. One case is not a measurement.

F05.1 adds the other side of it. 101 of its 111 subject items carry no active dependency
link at all, counted and never read. If teams do dependent work without recording a link,
the graph is a floor, not a census.

Left open, nobody knows whether the agent's route is the short one or the lossy one.

#### F14. Is a present-tense prompt bounded to open work?

Raised by F02.1 and F02.2. The product owner decides.

F02.1's prompt is present tense and its only link target closed on 2026-02-03. Every one of
F02.2's link targets is `Closed`, `Done` or `Removed`, and the prompt asks who to coordinate
with on work starting now. The widened search surfaced `1997392` in state `Planning`, which
no step walks.

Left open, "who do I need to coordinate with" gets answered from finished work.

### Naming the team or the contact

#### F8. Which area level names the team the answer quotes?

Raised by F02.1 and F09.1. The data SME decides.

No area level has a fixed meaning. F02.1's level 3 reads `Enabling Services and Advisors`,
level 4 reads `EnablingServices`, and the expected answer says "Enabling Services". F09.1 is
the expensive version: the expected answer names the level-4 group `SAP PO-CI` (3,548
items), while 5 of its 7 verified predecessors resolve to the level-5 subteam
`SAP PO-CPI - West`. The reported worst-case gap moves with the choice, +113 days for the
group against +56 for the subteam.

F09.1 also excludes the sibling path `EIS / SAP PO-CPI` (1,587 items) by name. If the
business reads that as part of the same SAP PO family, the aggregate changes.

Options: fix a level, quote the full path, or resolve the level per query from `DEPTH`.

Left open, the same team gets three different names across three answers, and a gap figure
moves by 57 days depending on which one.

#### F10. What evidence establishes "the right contact"?

Raised by F03.2 and F06.1. The product owner decides.

F06.1 ranks teams three ways and gets three answers. `Operations Snowflake` is 17th by item
titles, 4th once tags count, and first if you accept that a team named for the platform owns
the platform. No route puts it first on the evidence. There is also a second split: the
teams that do Snowflake work and the teams that supply Snowflake data are different lists,
and the expected answer reads as the supplier side.

F03.2 names the deeper problem. `CDH Foundation West` leads the ranking 16 to 1, which is a
wide gap, but the query returns a count of past links. It does not say the team is currently
the right contact, only that it has been on prior table work. The agent is reporting history
and the user will read it as a recommendation.

Left open, the agent recommends a contact on evidence nobody agreed counts as ownership.

#### F16. Do results get filtered to the prompt's own naming?

Raised by F05.1 and F05.2. The product owner decides.

F05.1's walk returns `NASA` as a top external supplier with 10 links, and the Golden
Dataset's answer includes `NASA` items, but no field ties that name to the prompt's "OTC".
Only 1 of those 10 links is the golden pair. If "OTC" was meant narrowly, the other 9 leave
the answer. F05.2 has the same shape: a "who does Bengals depend on" prompt picks up the
`Avatar` branch, 2 of the 14 external links, which this prompt never asked about.

Options: present every team the walk returns, or only teams whose names match the prompt's
term.

### Dates and risk

#### F7. Which date pattern counts as a delay or a risk?

Raised by F01.2, F08.1, F08.2, F10.1 and F10.2. The product owner decides.

Four different date shapes, and the walkthroughs report them inconsistently:

- F08.2 reports a predecessor closing 116 days before its successor and another closing 1
  day after, and calls neither one out as the risky shape. The two are not the same failure.
- F01.2 reports a +1 gap as "no delay", while noting the same pair is an inverted close
  order, one of the 10,968 F10.1 counts corpus-wide.
- F08.1 returns predecessor `1929157`, still `New` while its successor is `Closed`. The
  Golden Dataset omits it. Nobody has said whether that is mis-sequenced by definition.
- F10.1 offers three causes for out-of-sequence links (a data-quality issue, a reversed
  direction, a link added after the work finished) and no field distinguishes them.
  `FCT_ADO_WORKITEM_LINKS_HISTORY` records when a link was created, which separates the
  third cause from the first two, and no step reads it.
- F10.2 notes that a null close date on an item in state `Analyze` means work in progress
  and on a `Removed` item means something else. The count treats both the same.

F10.1 flags the blind spot underneath all of it: a link with a missing close date on either
end is excluded from the count, and an out-of-sequence dependency whose predecessor is still
open cannot be detected by comparing dates at all. That is 19,208 links with no successor
close date and 13,251 with no predecessor close date.

Left open, "dependency risk" means whatever the query author decided that day.

#### F12. Which date fields define "start" and "complete"?

Raised by F08.1 and F10.2. The data SME decides.

`START_DATE` is populated on 5% of items and is empty on F08.1's item, so the walkthrough
reads `CREATED_DATE` as the start. If the business means the planned start, that substitution
is wrong and silent. F10.2 has the same problem at the other end: the prompt says "missing or
incomplete", the walkthrough tests only `CLOSED_DATE IS NULL`, and the future-planned target
date the expected answer mentions sits in a field no step reads. `COMPLETED_DATE` and
`CLOSED_DATE` are also not yet distinguished from each other.

### What the answer contains

#### F11. What does an aggregate answer return, and how complete must it be?

Raised by F02.2, F09.1, F10.1 and F10.2. The product owner decides.

F10.1's prompt says "find dependency records", which reads as a list, and the condition
matches 10,972 of them. Nobody has said whether the answer is a count, a sample or a ranked
list, or what it ranks by. F10.2 asks the narrower version: a link with a missing close date
is partially analyzable, so does the agent drop it, report it separately, or answer with a
caveat.

Completeness has the same gap on the single-item side. F02.2 skips 2 of its 6 link targets,
the `Tax_BA` pair, so what the item waits on them for goes unstated. F09.1 leaves 124 of 132
rows unexamined; they span 21 teams, and a second Sonda/Comply pattern with a different
dependency team would be missed.

Left open, the answer is as complete as the query author felt like being.

## Non-functional decisions

| # | Decision | Cases | Decide with | Decision taken |
|---|---|---|---|---|
| N1 | The end-to-end response time budget | 20 | Stakeholder | |
| N2 | Cost per question, and whether full scans are acceptable | 8 | Stakeholder | |
| N3 | How much result data reaches the model, and where the cutoff sits | 9 | Engineering | |
| N4 | What the agent says when Azure SQL free text is missing | 8 | Product owner | |
| N5 | What the agent says when it finds nothing | 5 | Product owner | |
| N6 | Timeout handling and the mandatory org filter | 6 | Engineering | |
| N7 | Whether answers carry an as-of date | 2 | Product owner | |

### N1. What is the end-to-end response time budget?

Every one of the twenty walkthroughs raises this, and every one records the same absence:
no limit has been agreed.

The measured parts. A keyed lookup on `WORKITEM_ID_SOURCE` runs about 2 seconds. A `LIKE`
scan of the 6.4M-row item table also runs about 2 seconds. A corpus-wide count joining the
25.3M-row link table to the item table twice runs 3.1 to 5.0 seconds. An org-scoped Azure
SQL lookup takes about 13 seconds, and an unscoped one times out.

The step counts run from 2 queries (F06.2, F08.2) to 6 (F09.1, F09.2). F09.1 is the worst
case on paper: 6 Snowflake queries at 2 to 5 seconds each, plus Azure SQL lookups at about
13 seconds.

F09.2 names the architectural fork that decides the real number. A single-shot generator
pays the round-trip cost once. An agent that plans between steps pays it per step. That is
the difference between roughly 25 seconds and something well past a minute, and it should be
decided against a stated target rather than discovered.

### N2. What does a question cost, and are full table scans acceptable?

Raised by F02.2, F03.2, F04.2, F05.1, F06.1, F06.2, F09.1 and F09.2, all with the same
sentence: warehouse credits per question have not been measured or budgeted.

Every text search is a full scan of 6.4M rows with no field that could skip rows. F05.1 and
F06.1 run four of them per question. F09.2 runs six. F09.1's step 6 joins the 6.4M-row item
table to the 25.3M-row link table with no index.

This one needs a number before the pilot, not after.

### N3. How much result data reaches the model, and where does the cutoff sit?

Raised by F02.2, F03.2, F06.1, F06.2, F08.1, F08.2, F09.1, F09.2 and F10.1.

Intermediate result sets range from 3 rows to 10,972 records. F03.2 and F09.2 both return
5,329 items at step 2 and 579 at step 3. F09.1 carries 132 rows and aggregates 195 links.
F10.1's 10,972 records do not fit a model context at all.

F06.1 shows why the cutoff is a correctness question and not just a cost one. Its step 1
returns 1,040 teams, and one of the two expected teams ranks 123rd. Truncate at any
reasonable cutoff and the expected answer disappears.

### N4. What does the agent say when Azure SQL free text is missing?

Raised by F02.2, F03.1, F04.1, F04.2, F05.1, F06.1, F09.1 and F09.2. Today the agent says
nothing, which is the part to fix.

Azure SQL `dbo.WorkItems` holds 1,167,138 rows, about 18% of the Snowflake corpus, and it is
the only source of `Description` and `AcceptanceCriteria`. The gaps found in testing: F03.1
asked for 2 items and got 1, F09.2 asked for 24 and got 14, F05.1 got 26 of 29 and the 3
missing include a Golden Dataset successor, F02.2 lost one item's text, and F06.1 got
nothing at all and returned a Snowflake-only answer without saying so.

How often current Snowflake items are absent from Azure SQL, and why, is unmeasured. That
measurement is worth scheduling regardless of which behaviour wins.

Options: answer from what came back, declare the answer partial, retry, or drop Azure SQL
and answer from Snowflake alone.

### N5. What does the agent say when it finds nothing?

Raised by F01.1, F01.2, F02.1, F06.2 and F07.2. There is no stated rule for any of it.

The three shapes: a number that names no item, a number whose items carry no dependency
link, and a prompt qualifier that matches no candidate's area path (F07.2, where a team name
spelled differently than the area path spells it returns zero rows). F06.2 states the
requirement most usefully: the agent must say the item cannot be resolved rather than guess
an org.

### N6. How are timeouts handled, and is the org filter mandatory?

Raised by F02.2, F04.1, F04.2, F05.2, F06.1 and F09.2.

An Azure SQL lookup with no org filter times out, so the org from the Snowflake step has to
carry into the Azure SQL step. That is a hard constraint on query construction, not a
preference. F06.1's Azure SQL attempt times out at 20 to 45 seconds and returns nothing, so
trying it costs the wait for no rows. F05.2 is the sharpest case: a `LIKE` scan for a
nickname in Azure SQL free text times out past 120 seconds with or without an org filter,
and if Snowflake had not resolved the term, the agent would have had no working text search
left. It has to report that rather than hang.

### N7. Do answers carry an as-of date?

Raised by F10.1 and F10.2. Corpus-wide figures move daily.

Measured over one day, 2026-08-28 to 2026-08-29: out-of-sequence links went from 10,968 to
10,972, total `Predecessor` links from 77,786 to 77,879, links with no successor close date
from 19,161 to 19,208, and links with no predecessor close date from 13,217 to 13,251.

Any figure the agent quotes is a snapshot of that day. Whether it says so is the decision.

## Which decisions each walkthrough raises

| Case | Functional | Non-functional |
|---|---|---|
| F01.1 | F1, F2 | N1, N5 |
| F01.2 | F1, F2, F7 | N1, N5 |
| F02.1 | F1, F2, F6, F8, F13, F14 | N1, N5 |
| F02.2 | F2, F4, F5, F11, F13, F14 | N1, N2, N3, N4, N6 |
| F03.1 | none | N1, N4 |
| F03.2 | F3, F4, F9, F10 | N1, N2, N3 |
| F04.1 | F5, F13, F15 | N1, N4, N6 |
| F04.2 | F5, F15 | N1, N2, N4, N6 |
| F05.1 | F4, F6, F13, F16 | N1, N2, N4 |
| F05.2 | F3, F4, F6, F16 | N1, N6 |
| F06.1 | F6, F10 | N1, N2, N3, N4, N6 |
| F06.2 | F1 | N1, N2, N3, N5 |
| F07.1 | F1, F2 | N1 |
| F07.2 | F1, F2 | N1, N5 |
| F08.1 | F1, F2, F7, F12 | N1, N3 |
| F08.2 | F1, F2, F7 | N1, N3 |
| F09.1 | F2, F3, F8, F9, F11 | N1, N2, N3, N4 |
| F09.2 | F3, F4, F9 | N1, N2, N3, N4, N6 |
| F10.1 | F2, F7, F11 | N1, N3, N7 |
| F10.2 | F2, F7, F11, F12 | N1, N7 |

## Notes on running the session

Split the room. F3, F6, F8, F12 and F13 are data questions the SME can answer from the
schema and a few queries. The rest are business definitions, and asking a data SME to rule
on what "dependency risk" means will produce an answer nobody is bound by.

Take F2 first. Eleven of the twenty walkthroughs change if the answer to "which link types
count" changes, and several other decisions read differently once it is settled.

Three items need a measurement before anyone can decide, so they are worth commissioning
today rather than debating in the room: how often several same-number items each carry
dependency links (F1), how often current Snowflake items are missing from Azure SQL (N4),
and what a question costs in warehouse credits (N2).
