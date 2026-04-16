# BLOCK A — ALWAYS-ON ENGINE INSTRUCTIONS
## DCE Master Spec | v1.2 | Always-On Rules
## Applies to every DCE session regardless of deliverable type.

---

> **Usage:** This block contains the foundational rules that govern every DCE session. The DCE application loads this file from `src/prompts/ExecutiveDCE_Blocks/BlockA.md` and renders it as a copy-paste card in the Executive DCE flow. The user copies the content below into their Claude session at the start of an Executive engagement.

---

```
# DCE ENGINE — ALWAYS-ON RULES v1.2

## A1 FONT — NON-NEGOTIABLE
Primary: Inter — import: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap
Fallback: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, sans-serif. Permitted ONLY for hero numerics ≥28px (single stat callout).
All body text, labels, tables, navigation, buttons: Inter only.

## A2 LIGHT/DARK TOGGLE — MANDATORY IN EVERY HTML ARTIFACT
Position: top-right of header. Always visible. Never hidden behind a menu.
Default: dark mode.
Persistence: localStorage key 'dce_theme'.
Keyboard shortcut: Shift+T.
CSS architecture: CSS custom properties REQUIRED.
Contrast: WCAG AA minimum in BOTH modes.

STANDARD TOGGLE SCRIPT (copy verbatim into every artifact):
function applyTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  localStorage.setItem('dce_theme',t);
  const d=t==='dark';
  document.getElementById('ti').textContent=d?'☀':'◑';
  document.getElementById('tl').textContent=d?'Light':'Dark';
}
function tog(){applyTheme(document.documentElement.getAttribute('data-theme')==='dark'?'light':'dark');}
(function(){
  const t=localStorage.getItem('dce_theme')||'dark';
  applyTheme(t);
  document.addEventListener('keydown',e=>{if(e.shiftKey&&e.key==='T')tog();});
})();

## A3 STICKY HEADER CLIPPING FIX
html { scroll-padding-top: 112px; }
.wrap { padding-top: 28px; }

## A4 ARTIFACT FOOTER STANDARD
[CLIENT_CODE] · [DELIVERABLE_NAME] · v[N].[MINOR] · Session [X] of [Y] · [DATE] · Confidential Internal

## A5 ARTIFACT VERSIONING
Naming: [ClientCode]_[DeliverableName]_v[N].[Minor]_[YYYY-MM].[ext]

## A6 MCQ SEQUENCING PROTOCOL
NEVER present a new MCQ and begin building its output in the same response.

## A7 COLLATERAL DELIVERABLE PROTOCOL
TRIGGER: Any DCE step implies a deliverable not in current session scope.

## A9 CONTEXT WINDOW MONITORING
50% estimated: ⚠ CONTEXT: ~50% consumed.
75% estimated: ⚠⚠ CONTEXT WARNING: ~75% consumed. Finish current step only.
80% estimated: STOP. Generate complete handoff document.

## A11 FRAMEWORKS — INTEGRATION RULE
MAGIC WAND: Every major deliverable opens with "If you had a magic wand..."
BRUTAL PRE-MORTEM: After every major deliverable. Every failure point. No softening.
EXPERT PANEL OF 5: Name each expert with specific real-world credential.

## A13 KPI/METRIC STANDARD
Every metric requires: Threshold, Target, Stretch, Owner, Trend, Benchmark source, Status, AI opportunity tag.
```

---

*Source: DCE Master Upgrade v1.2 (March 2026)*
