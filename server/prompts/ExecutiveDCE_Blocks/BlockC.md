# BLOCK C — ATTENDING ASSET DISCOVERY & PARALLEL PRODUCTION QUEUE
## DCE Master Spec | v1.2 | Implementation Ecosystem
## Paste this into your Claude session after Block A and Block B, before running any DCE build steps.

---

> **Usage:** This block instructs the executing AI to perform a comprehensive ecosystem scan after the primary deliverable is complete. It identifies every supporting asset needed for real-world implementation and generates a Parallel Production Queue with self-contained prompts for building each asset. The user pastes this block once at session start — it activates automatically when the final build step is complete.

---

```
# ─────────────────────────────────────────────────────────────
# DCE ENGINE — ATTENDING ASSET DISCOVERY v1.2
# ─────────────────────────────────────────────────────────────

## WHEN THIS FIRES
After the final DCE build step is complete and the polished final version of the primary deliverable has been produced, AUTOMATICALLY perform the Attending Asset Discovery below. Do not wait for the user to ask. This is a mandatory step in every DCE engagement.

## ATTENDING ASSET DISCOVERY PROTOCOL

Examine everything that was just built across all DCE steps and identify EVERY attending asset, collateral document, tool, communication, training material, form, survey, presentation, email sequence, landing page, dashboard, or supporting deliverable that the primary deliverable requires to function in a real operational environment.

For each attending asset identified, provide:
  (a) Name and brief description
  (b) Why it's required (what breaks or degrades without it)
  (c) Triage Tier:
      - MUST-HAVE NOW — the primary deliverable cannot function without this
      - SHOULD-HAVE SOON — meaningfully improves effectiveness within 30 days
      - NICE-TO-HAVE LATER — adds value but not on the critical path
  (d) Dependencies — what must exist before this asset can be built (list other assets or "None")
  (e) Complexity — Simple (single prompt) or Complex (DCE-structured multi-prompt)

## PARALLEL PRODUCTION QUEUE

After identifying all attending assets, generate a COMPLETE PARALLEL PRODUCTION QUEUE FILE containing a self-contained copy-paste prompt for EVERY identified attending asset.

Each prompt in the queue must include:

  --- START OF ATTENDING ASSET PROMPT: [Asset Name] ---
  TIER: [Must-Have Now / Should-Have Soon / Nice-to-Have Later]
  DEPENDS ON: [List or "None — can be built immediately"]
  COMPLEXITY: [Simple / Complex — if Complex, prompt is a mini-DCE pack]

  [UNIVERSAL CONTEXT BLOCK]
  Role: [carried from primary session]
  Industry: [carried from primary session]
  Company Size: [carried from primary session]
  Company URL: [if applicable]
  Primary Deliverable: [name and brief description of what was built in the main DCE session]
  Key Decisions Made: [summary of MCQ answers and structural choices from the primary session that affect this asset]
  Version Lock: Based on [Primary Deliverable Name] Final Version — [Date]

  [MAGIC WAND INSTRUCTION]
  If you had a magic wand — where even suspending the laws of gravity you could imagineer the solution in detail — describe it. Then give a brutal pre-mortem of every point of failure. Then convene a panel of 5 world-renowned domain experts to debate best strategy.

  [ASSET-SPECIFIC INSTRUCTION]
  [Complete, comprehensive, production-ready prompt for building this specific asset. NOT a summary — a full prompt with all context, specifications, scope, acceptance criteria, and structural requirements. For Complex assets, structure as a condensed DCE sequence: Draft → QA → Refine → Finalize, with MCQ decision points.]

  [OUTPUT RULES]
  Font: Inter only, never serif. WCAG AA contrast.
  Completion-first: produce complete deployable content, never outlines.
  Context window: Alert at 50%. Warning at 75%. Handoff document at 80%.
  Output blocks: [ARTIFACT], [TIME_STUDY] in every response.

  [REVIEW REQUIREMENTS]
  Must be reviewed by: [Legal / Compliance / None / specific role — based on asset type and industry]
  --- END OF ATTENDING ASSET PROMPT: [Asset Name] ---

The attending asset prompts must be informed by EVERYTHING that occurred across all DCE build steps. Every decision, every structural choice, every data point, every expert recommendation, every stress test finding that is relevant to the attending asset must be carried into its prompt. These are not generic templates — they are context-rich, session-aware production prompts.

Include a PORTFOLIO HUB GENERATION PROMPT as one of the Must-Have Now attending assets (see Block D for full Portfolio Hub specification).
```

---

*Source: DCE Master Upgrade v1.2 (May 2026)*
