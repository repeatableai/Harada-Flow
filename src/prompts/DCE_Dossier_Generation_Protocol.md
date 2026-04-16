═══════════════════════════════════════════════════════════════════════════════
⚠️  CRITICAL — READ BEFORE PROCEEDING  ⚠️
═══════════════════════════════════════════════════════════════════════════════

** UPLOAD THIS ENTIRE FILE TO YOUR CLAUDE PROJECT FILES FIRST. **
** DO NOT PASTE THE CONTENTS OF THIS FILE INTO THE CHAT WINDOW. **
** THE DCE READS THIS DOCUMENT FROM PROJECT KNOWLEDGE — NOT FROM CHAT HISTORY. **

STEPS (do these in this exact order):

1. Save this file as `DCE_Dossier_Generation_Protocol.md` on your computer.
2. Open your Claude Project for this DCE engagement.
3. Click "Add content" in the Project Knowledge panel.
4. Upload this .md file to Project Knowledge.

The protocol below executes only when the file is present in Project Knowledge.
If you paste this content into chat instead of uploading it, the protocol will
not execute correctly — the DCE expects to retrieve it from Project Knowledge
via its search tool.

═══════════════════════════════════════════════════════════════════════════════

[BEGIN PROTOCOL BELOW]

# COMPANY DOSSIER GENERATION PROTOCOL
## Standing Instruction Set for the DCE Application
### Underlying LLM: Claude Opus 4.6 | Version 1.0 | April 2026

---

## [0] TRIGGER & SCOPE

### When This Protocol Fires
Execute this protocol end-to-end whenever the user's prompt matches any of the following intent patterns:
- "Generate a company dossier for [COMPANY]..."
- "Create a [Parker-level / MMG-level / comprehensive] dossier for [COMPANY]..."
- "Build a knowledge base for [COMPANY] for DCE Package #[N]..."
- "I need a dossier on [COMPANY] focused on [AREA]..."
- Any request that implies producing a comprehensive, research-grade, research-backed knowledge base that serves as the foundational context document for an entire DCE engagement.

A dossier is **NOT** a deliverable requiring the 6-Phase Engine (Magic Wand → Expert Panel → Pre-Mortem → MCQ → Build → Framework Application). It is a **pre-deliverable context document**. Skip all six phases for the dossier itself. The 6-Phase Engine fires on the deliverables that consume the dossier.

### Quality Benchmark
Reference the **Parker Aerospace**, **Momentum Manufacturing Group**, **Sig Sauer**, and **Plymouth Rock** dossiers as the quality anchor. A correctly-built dossier has:
- 22 structured sections
- Data-backed claims with source attribution
- Clearly labeled synthetic estimates
- A confidence-and-sourcing table at the end
- An engagement-specific deep dive as the centerpiece

---

## [1] EXECUTION MODE — ONE-SHOT, NO INTERRUPTIONS

### Hard Rules
- **ONE-SHOT EXECUTION:** Fire the cannon. Execute full research + full build in a single pass. Do not ask for confirmation between phases.
- **NO MCQ FOR THE DOSSIER:** The inputs (company name, engagement focus) are already clear from the trigger prompt. MCQs only fire on deliverables downstream of the dossier.
- **RESEARCH AGGRESSIVELY BEFORE WRITING:** Do not start drafting until Tier 1-6 research is complete.
- **NO SKELETONS:** Do not produce an outline and ask for approval. Produce the full dossier.
- **NO ABBREVIATED VERSIONS:** Do not omit sections for brevity. Use `[SYNTHETIC ESTIMATE]` where public data is thin.

### What the User Sees During Execution
Produce the dossier as a single markdown artifact. The user does not see the research process — they see the final product. Do not narrate search steps.

---

## [2] MANDATORY RESEARCH METHODOLOGY

Execute web searches in the following tiered sequence **before writing any dossier content**. Scale the number of searches to company size and public data availability:

- **Fortune 500 / public company:** 20-35 searches
- **Mid-market private company:** 12-20 searches
- **Small private company:** 6-12 searches
- **Very small / regional:** 4-8 searches (lean heavily on synthetic estimates)

### Tier 1 — Company Identity & Financial Foundation
Search for:
- `[Company Name] annual revenue [current fiscal year]`
- `[Company Name] SEC 10-K` (public) or `[Company Name] PitchBook Crunchbase` (private)
- `[Company Name] founded headquarters history`
- `[Company Name] Wikipedia`
- `[Company Name] employees count fiscal year`

### Tier 2 — Leadership & Ownership
Search for:
- `[Company Name] CEO [current year]`
- `[Company Name] leadership team executives`
- `[Company Name] board of directors` (public)
- `[Company Name] private equity owner` / `[Company Name] ownership history` (private)

### Tier 3 — Business Structure & Operations
Search for:
- `[Company Name] divisions business segments`
- `[Company Name] products capabilities portfolio`
- `[Company Name] facilities locations manufacturing`
- `[Company Name] acquisitions history`
- `[Company Name] quality certifications ISO AS9100`

### Tier 4 — Engagement-Specific Deep Dive
Search for:
- `[Company Name] [specific division/function in DCE focus]`
- `[Key Stakeholder Name] [title] [Company Name]`
- `[Company Name] [specific operational challenge/transformation]`

### Tier 5 — Industry & Competitive Context
Search for:
- `[Company Name] competitors`
- `[Industry] benchmarks [KPI relevant to engagement]`
- `[Industry] AI automation trends [current year]`

### Tier 6 — Recent News & Developments (24-36 Months)
Search for:
- `[Company Name] news [recent quarter/year]`
- `[Company Name] press release [recent months]`
- `[Company Name] earnings call [recent quarter]` (public)

### Search Quality Rules
- Use concise queries (1-6 words); start broad, narrow as needed
- Cross-reference EVERY material fact in at least two sources before asserting it
- If a fact appears in only one source, mark it `[VERIFY]` in the dossier
- Never fabricate data. If unavailable, write "Not publicly disclosed"

---

## [3] OUTPUT STRUCTURE — 22-SECTION DOSSIER TEMPLATE

All 22 sections are required. Produce as a single markdown artifact.

### Dossier Header
# [COMPANY NAME] — COMPREHENSIVE COMPANY DOSSIER
## Knowledge File for DCE Software Application — Package #[N]
### Compiled: [DATE] | Source: [brief list of primary sources]

### Section 1 — Company Identity & Legal Structure
### Section 2 — Ownership & Investment History
### Section 3 — Financials & Business Metrics
### Section 4 — Executive Leadership
### Section 5 — Organizational Structure (Divisions / Segments / Groups)
### Section 6 — Quality & Compliance Certifications
### Section 7 — Full Capabilities Portfolio
### Section 8 — Industries Served
### Section 9 — Acquisition History
### Section 10 — Competitive Landscape
### Section 11 — Engagement-Specific Deep Dive ⭐ (MOST IMPORTANT SECTION)
### Section 12 — Key Technology/Capability Deep Dive (Optional)
### Section 13 — Recent News & Developments (2-3 Year Timeline)
### Section 14 — Value Proposition Summary
### Section 15 — [SYNTHETIC ESTIMATE] Department-Level Role Breakdown
### Section 16 — [SYNTHETIC ESTIMATE] AI Opportunity Analysis
### Section 17 — Glossary (minimum 15-20 terms)
### Section 18 — Data Confidence & Sourcing Notes
### Section 19 — Research Plan Execution Status (if research plan provided)
### Section 20 — Key Stakeholders & Contacts
### Section 21 — Key Deadlines & Engagement Context
### Section 22 — Closing

---

## [4] QUALITY STANDARDS — NON-NEGOTIABLE

- Every factual claim must have a traceable source
- `[SYNTHETIC ESTIMATE]` badge on all inferred/modeled data
- `[VERIFY]` badge on single-source claims
- Data Confidence table at end (Section 18) — mandatory
- **Never fabricate:** names, titles, revenue figures, dates, quotes, or customer names

---

## [7] FORMAT & DELIVERY

- Output: Markdown (.md)
- File name: `[CompanyName]_Dossier_DCE[PackageNumber].md`
- Deliver as downloadable markdown — NOT HTML artifact
- Do not include UI elements (theme toggles, navigation)

---

*End of Protocol — DCE Company Dossier Generation v1.0*
*Underlying LLM: Claude Opus 4.6*
*Quality benchmark: Parker Aerospace / Momentum Manufacturing Group / Sig Sauer / Plymouth Rock dossiers*
