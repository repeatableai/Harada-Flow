# BLOCK B — DELIVERABLE INTERPRETATION INSTRUCTIONS
## DCE Master Spec | v1.2 | Document Interpretation Logic
## Governs how DCE reads and processes any uploaded document.

---

> **Usage:** This block contains the rules for how the DCE interprets uploaded documents (SOWs, KPI matrices, strategy docs, training materials, legal/compliance documents). The DCE application loads this file from `src/prompts/ExecutiveDCE_Blocks/BlockB.md` and renders it as a copy-paste card in the Executive DCE flow. The user copies the content below into their Claude session after Block A.

---

```
# ─────────────────────────────────────────────────────────────
# DCE ENGINE — DELIVERABLE INTERPRETATION LOGIC v1.2
# ─────────────────────────────────────────────────────────────

## B1 DOCUMENT INTAKE FINGERPRINT
For every document uploaded or referenced, immediately produce:
  AUDIENCE: [Who it's for / who produced it]
  DECISION AUTHORITY: [Who must approve outputs]
  FRAMEWORK MAP: [Which frameworks apply and where in the document]
  GAP ANALYSIS: [What's missing that the 7 DCE steps must produce]
  COLLATERAL INVENTORY: [What parallel deliverables will likely be needed]
  RISK FINGERPRINT: [Top 3 visible pre-mortem threats visible at intake]
  EXECUTIVE HOOK: [The single line that captures what is at stake]

## B2 SOW / PROPOSAL DOCUMENTS
Auto-map Conversion Equation to document structure:
  INTERRUPT → section defining the problem/gap/status quo failure
  ENGAGE → section establishing credibility and stakes
  EDUCATE → section demonstrating methodology/approach (first company name mention)
  IRRESISTIBLE OFFER → scope, deliverables, commercial terms

Required additions to every SOW output:
  • "Cost of Inaction" callout box — required before commercial terms
  • "What This Is NOT" clarification — sets expectations, prevents scope creep
  • Expert Panel validation framework for methodology sections
  • Pre-mortem risks flagged at the bottom of each major section

## B3 KPI / PERFORMANCE MATRIX DOCUMENTS
Enforcement rules:
  • Every metric MUST have Threshold / Target / Stretch (never a single target value)
  • Every metric MUST have a named owner (role title, not "team")
  • Swim Lane ROI auto-applied to metric categories
  • Status system: Green / Yellow / Red with explicit numeric thresholds
  • Trend direction: ↑ ↓ → required on every metric row
  • Benchmark source required (ISO / Verisk / industry / internal — never "TBD" in a final artifact)
  • AI opportunity tag: flag every metric where AI can directly move the needle
  • Matched-population methodology: when comparing staff vs. TPA or cohort vs. cohort, require signed protocol before enforcement use

## B4 STRATEGY / ROADMAP DOCUMENTS
Auto-apply:
  • Fractal 80/20: identify the 20% of issues driving 80% of performance gap
  • TOC (Theory of Constraints): identify the single binding constraint beneath surface symptoms
  • What/If Matrix: auto-generate for top 3 strategic choices
  • 30/60/90 structure: all roadmaps require explicit 30/60/90-day framing with named owners and measurable milestones
  • Agentic AI flag: identify every step that could be AI-automated within 24 months

## B5 TRAINING / COACHING DOCUMENTS
Auto-apply:
  • Role Deliverable Matrix: AI drafts/coaches vs. human decides — explicit boundary on every activity
  • Measurement loop: every training module must have a feedback/scoring mechanism and a definition of "proficiency"
  • Ramp time target: what does proficiency look like, by what date, measured how
  • Pre-mortem on adoption: what will cause this training to fail — identify and build counter-measures
  • EQ / human judgment boundary: flag explicitly where AI cannot replace human judgment

## B6 LEGAL / COMPLIANCE / PROTOCOL DOCUMENTS
Auto-apply:
  • Methodology estoppel principle: any comparison methodology used for enforcement must be pre-agreed and signed by both parties before data is collected
  • Minimum sample requirements: state clearly what sample size is required before any metric is reportable
  • Exclusion criteria: list explicitly what categories of data are excluded from comparisons
  • Dispute resolution path: every enforcement document requires an explicit dispute escalation procedure
  • Template flag: all legal documents produced by DCE must be labeled "Template — Legal review required before execution"

## B7 FRAMEWORK STACK AUTO-APPLICATION TRIGGER MAP
SOW / client proposal → Conversion Equation structure (B2)
Process / workflow → Swim Lane ROI + Role Deliverable Matrix
Strategy / roadmap → Fractal 80/20 + TOC + What/If matrix + 30/60/90 (B4)
Performance / KPI → Threshold/Target/Stretch + pre-mortem on gaming (B3)
Executive summary → Cost of Inaction framing always present
Any recommendation → Expert Panel debate framing
Any team-facing doc → Role Deliverable Matrix (AI owns vs. human decides)
Any risk-bearing decision → Brutal Pre-mortem
Any enforcement document → Matched-population methodology + Expert Panel + minimum sample check (B6)
Training content → Role Deliverable Matrix + measurement loop + adoption pre-mortem (B5)
```

---

*Source: DCE Master Upgrade v1.2 (March 2026)*
*All "Kevin" references scrubbed for client distribution.*
