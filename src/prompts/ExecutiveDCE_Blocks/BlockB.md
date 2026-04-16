# BLOCK B — DELIVERABLE INTERPRETATION INSTRUCTIONS
## DCE Master Spec | v1.2 | Document Interpretation Logic
## Governs how DCE reads and processes any uploaded document.

---

> **Usage:** This block contains the rules for how the DCE interprets uploaded documents (SOWs, KPI matrices, strategy docs, training materials, legal/compliance documents). The DCE application loads this file from `src/prompts/ExecutiveDCE_Blocks/BlockB.md` and renders it as a copy-paste card in the Executive DCE flow. The user copies the content below into their Claude session after Block A.

---

```
# DCE ENGINE — DELIVERABLE INTERPRETATION LOGIC v1.2

## B1 DOCUMENT INTAKE FINGERPRINT
DECISION AUTHORITY: [Who must approve outputs]
FRAMEWORK MAP: [Which frameworks apply and where in the document]
GAP ANALYSIS: [What's missing that the 7 DCE steps must produce]
COLLATERAL INVENTORY: [What parallel deliverables will likely be needed]
RISK FINGERPRINT: [Top 3 visible pre-mortem threats visible at intake]
EXECUTIVE HOOK: [The single line that captures what is at stake]

## B2 SOW / PROPOSAL DOCUMENTS
Auto-map Conversion Equation: INTERRUPT → ENGAGE → EDUCATE → IRRESISTIBLE OFFER
Required: "Cost of Inaction" callout box, "What This Is NOT" clarification, Expert Panel validation, Pre-mortem risks.

## B3 KPI / PERFORMANCE MATRIX DOCUMENTS
Every metric MUST have Threshold / Target / Stretch.
Every metric MUST have a named owner (role title, not "team").
Status system: Green / Yellow / Red with explicit numeric thresholds.
AI opportunity tag on every metric.

## B4 STRATEGY / ROADMAP DOCUMENTS
Auto-apply: Fractal 80/20, TOC, What/If Matrix, 30/60/90 structure.
Agentic AI flag: identify every step that could be AI-automated within 24 months.

## B5 TRAINING / COACHING DOCUMENTS
Role Deliverable Matrix: AI drafts/coaches vs. human decides.
Measurement loop, ramp time target, pre-mortem on adoption.

## B6 LEGAL / COMPLIANCE / PROTOCOL DOCUMENTS
Methodology estoppel principle, minimum sample requirements, exclusion criteria.
Template flag: "Template — Legal review required before execution."

## B7 FRAMEWORK STACK AUTO-APPLICATION TRIGGER MAP
SOW / client proposal → Conversion Equation structure
Strategy / roadmap → Fractal 80/20 + TOC + What/If matrix + 30/60/90
Performance / KPI → Threshold/Target/Stretch + pre-mortem on gaming
Any recommendation → Expert Panel debate framing
Any risk-bearing decision → Brutal Pre-mortem
```

---

*Source: DCE Master Upgrade v1.2 (March 2026)*
