# Claude Certified Architect – Professional Prep Course · Path Index

> Path: `claude-certified-architect-professional` on anthropic-partners.skilljar.com
> **Path goal:** Learn to design, integrate, and govern production-grade Claude systems end
> to end, and to defend those design decisions to the stakeholders who fund and approve them.

## Modules (extraction checklist)

| # | Module | Slug | Status |
|---|---|---|---|
| M1 | Claude Platform & Solution Design | `claude-platform-solution-design` | ☑ **done** → `Module-1-Claude-Platform-Solution-Design.md` (34 screens · 12 sections · 11 checkpoints) |
| M2 | Enterprise Integration & Production | `enterprise-integration-production` | ☑ **done** → `Module-2-Enterprise-Integration-Production.md` (20 screens · 5 sections · 6 checkpoints) |
| M3 | Responsible AI, Safety & Risk for Architects | `responsible-ai-safety-risk-for-architects` | ☐ **not extracted** — need deck URL + cookies |
| M4 | Stakeholder Engagement, Lifecycle & GTM | `stakeholder-engagement-lifecycle-gtm` | ☑ **done** → `Module-4-Stakeholder-Engagement-Lifecycle-GTM.md` (19 screens · 6 sections · 6 checkpoints) |
| M5 | Team Enablement & Operational Productivity | `developer-productivity-enablement` | ☑ **done** → `Module-5-Team-Enablement-Operational-Productivity.md` (9 screens · 4 sections · 3 checkpoints) |

*(M1–M3 titles were previewed in the M4 deck footer as "Claude Platform & Solution Design",
"Enterprise Integration & Production", and "Responsible AI, Safety & Risk". M5 is the "next
module" M4 pointed to: team enablement / developer workflows / operational health.)*

## Content blueprint (exam domains referenced in M4)

M4 tagged one outcome-document field as on-blueprint **6.4**, which implies the exam is
organized by numbered domains. Worth confirming against the published exam-guide PDF when we
have it — it's the source of truth for what's testable and weightings.

## How each remaining module gets extracted

Each module is delivered as an external, CloudFront-signed SCORM deck (as M4 was:
`Architect_M4_vF2.html` on the `/content/wp/<id>/<id>/` host). To pull one I need **two
artifacts per module**, captured from the browser with the module open:

1. **The deck's content URL** — DevTools → Network → **Doc** filter → the
   `Architect_M#_…html` request → Copy link address.
2. **Fresh CloudFront cookies for that module** — the `cookie:` header on that same request
   (`CloudFront-Key-Pair-Id`, `CloudFront-Policy`, `CloudFront-Signature`, `auth_content_wp`,
   plus `sj_sessionid`).

**Important:** the CloudFront signature is **scoped to one module's `/content/wp/<id>/<id>/`
path and time-limited** (the M4 set expires ~Aug 4 2026), so each module hands out its own
cookie set — they can't be reused across modules or after expiry.

Deliverable per module = a study-notes markdown file in this folder, same shape as the M4
file (frameworks, reference tables, Watch-Out failure cases, checkpoints with answers,
cumulative exercise, glossary, recap, exam-scope flags preserved).
