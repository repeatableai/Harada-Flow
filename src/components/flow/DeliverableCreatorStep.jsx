import React, { useState, useEffect, useCallback } from "react";
import { InvokeLLM } from "@/api/integrations";
import { SavedPrompt } from "@/api/entities";
import { apiClient } from "@/api/apiClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Target, ArrowLeft, Sparkles, FileText, FolderOpen, Bookmark, Plus, AlertTriangle, Crown, Zap, ChevronUp, XCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/components/auth/AuthProvider";
import { resolveMode } from "@/utils/resolveDceMode";

import DeliverableSelector from "../deliverable/DeliverableSelector";
import GeneratedPrompts from "../deliverable/GeneratedPrompts";
import WorkingDeliverableFlow from "./WorkingDeliverableFlow";
import ExecutiveDceFlow from "./ExecutiveDceFlow";
import RegistrySidebar from "./RegistrySidebar";
import LoadingOverlay from "../common/LoadingOverlay";
import SessionsList from "../dashboard/SessionsList";
import SavedPromptsList from "../dashboard/SavedPromptsList";

export default function DeliverableCreatorStep({ company, onStartOver, onLoadSession, onDeleteSession }) {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedDeliverable, setSelectedDeliverable] = useState(null);
  const [generatedPrompts, setGeneratedPrompts] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [step, setStep] = useState('select'); // select, generate, view, working-flow, executive-flow
  const [activeTab, setActiveTab] = useState('create');
  const [trialStatus, setTrialStatus] = useState(null);

  // Reset to Create tab whenever the role (company) changes
  useEffect(() => {
    setActiveTab('create');
    setStep('select');
    setSelectedDeliverable(null);
    setGeneratedPrompts(null);
  }, [company?.id]);

  // Mode state
  const [sessionModeOverride, setSessionModeOverride] = useState(company?.session_mode_override || null);
  const [showModeModal, setShowModeModal] = useState(false);
  const [pendingDeliverable, setPendingDeliverable] = useState(null);

  // Dossier pre-check state (fires before first deliverable generation)
  const [showDossierCheck, setShowDossierCheck] = useState(false);
  const [dossierDismissed, setDossierDismissed] = useState(
    company?.dossier_status === 'uploaded' || company?.dossier_status === 'generated'
  );
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [pendingDossierDeliverable, setPendingDossierDeliverable] = useState(null);
  const [pendingDossierMode, setPendingDossierMode] = useState(null);

  // Session close state
  const [isClosingSession, setIsClosingSession] = useState(false);

  // Get resolved mode for display
  const resolvedSessionMode = resolveMode({
    userPref: user?.dceDefaultMode || 'Working',
    sessionOverride: sessionModeOverride,
  });

  // Handle session mode override change
  const handleSessionModeChange = async (value) => {
    const override = value === 'inherit' ? null : value;
    setSessionModeOverride(override);
    try {
      await apiClient.request(`/companies/${company.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ session_mode_override: override }),
      });
    } catch {
      // Non-critical — local state already updated
    }
  };

  // Handle deliverable selection with mode resolution
  const handleDeliverableSelect = (deliverable, escalate = false) => {
    const mode = resolveMode({
      userPref: user?.dceDefaultMode || 'Working',
      sessionOverride: sessionModeOverride,
      escalateFlag: escalate,
    });

    if (mode === 'AskEverySession') {
      setPendingDeliverable(deliverable);
      setShowModeModal(true);
      return;
    }

    routeToFlow(deliverable, mode);
  };

  // Route to the correct flow — with dossier pre-check if not yet dismissed
  const routeToFlow = (deliverable, mode) => {
    if (!dossierDismissed) {
      // Show dossier check before proceeding
      setPendingDossierDeliverable(deliverable);
      setPendingDossierMode(mode);
      setShowDossierCheck(true);
      return;
    }
    proceedToFlow(deliverable, mode);
  };

  const proceedToFlow = (deliverable, mode) => {
    setSelectedDeliverable(deliverable);
    if (mode === 'Executive') {
      setStep('executive-flow');
    } else {
      setStep('working-flow');
    }
  };

  // User confirms dossier check — they have files or want to proceed without
  // Generated dossier content — prepended as Session 00 prompt
  const [generatedDossier, setGeneratedDossier] = useState(null);
  const [isGeneratingDossier, setIsGeneratingDossier] = useState(false);

  const handleDossierConfirm = async (hasFiles) => {
    if (hasFiles) {
      // User has their own files — mark as uploaded, proceed immediately
      try {
        await apiClient.request(`/dossier/${company.id}/status`, {
          method: 'PATCH',
          body: JSON.stringify({ dossierStatus: 'uploaded' }),
        });
      } catch { /* non-critical */ }

      if (dontAskAgain) setDossierDismissed(true);
      setShowDossierCheck(false);

      if (pendingDossierDeliverable && pendingDossierMode) {
        proceedToFlow(pendingDossierDeliverable, pendingDossierMode);
        setPendingDossierDeliverable(null);
        setPendingDossierMode(null);
      }
    } else {
      // No files — generate a dossier using all available company context
      setShowDossierCheck(false);
      setIsGeneratingDossier(true);

      try {
        const result = await apiClient.request('/dossier/generate', {
          method: 'POST',
          body: JSON.stringify({
            companyName: company.industry || 'the company',
            companyUrl: company.company_url || null,
            jobTitle: company.job_title || null,
            industry: company.industry || null,
            companySize: company.company_size || null,
            engagementFocus: company.job_title || 'operational deliverables',
            companyId: company.id,
          }),
          timeout: 600000,
        });

        setGeneratedDossier(result.content);

        toast({
          title: 'Dossier Generated',
          description: 'Company dossier created and will appear as your first prompt.',
          duration: 4000,
        });
      } catch (err) {
        toast({
          title: 'Dossier generation failed',
          description: err.message || 'Proceeding without dossier.',
          variant: 'destructive',
          duration: 5000,
        });
      } finally {
        setIsGeneratingDossier(false);
      }

      if (dontAskAgain) setDossierDismissed(true);

      // Proceed to flow regardless
      if (pendingDossierDeliverable && pendingDossierMode) {
        proceedToFlow(pendingDossierDeliverable, pendingDossierMode);
        setPendingDossierDeliverable(null);
        setPendingDossierMode(null);
      }
    }
  };

  // Handle AskEverySession modal choice
  const handleModeChoice = (mode) => {
    setShowModeModal(false);
    if (pendingDeliverable) {
      routeToFlow(pendingDeliverable, mode);
      setPendingDeliverable(null);
    }
  };

  // Handle session close
  const handleCloseSession = async () => {
    setIsClosingSession(true);
    try {
      const result = await apiClient.request('/session/close', {
        method: 'POST',
        body: JSON.stringify({ companyId: company.id, sessionNumber: 1 }),
      });
      toast({
        title: 'Session Closed',
        description: 'Session close protocol executed successfully.',
        duration: 5000,
      });
    } catch (err) {
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    } finally {
      setIsClosingSession(false);
    }
  };

  // Tab close handler — sendBeacon
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (company?.id) {
        navigator.sendBeacon(
          '/api/session/close',
          JSON.stringify({ companyId: company.id, sessionNumber: 1 })
        );
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [company?.id]);

  // Check trial user status on mount
  useEffect(() => {
    const checkTrialStatus = async () => {
      try {
        const status = await apiClient.auth.getTrialStatus();
        setTrialStatus(status);
      } catch (error) {
        console.error("Failed to check trial status:", error);
      }
    };
    checkTrialStatus();
  }, []);

  if (!company) {
    return <LoadingOverlay message="Loading role..." />;
  }
  
  const { productivity_matrix, performance_matrix } = company;

  const generatePrompts = async () => {
    if (!selectedDeliverable || !company) return;
    
    setIsGenerating(true);
    
    try {
      const prompt = `
Role: ${company.job_title}
Company Size: ${company.company_size}
Industry: ${company.industry}
Selected Deliverable: ${selectedDeliverable.name}
Matrix Type: ${selectedDeliverable.type}
${company.company_url ? `Company URL: ${company.company_url}` : ''}

Generate an 8-prompt DCE (Deliverable Creation Engine) pack for creating this deliverable. Each prompt follows the DCE methodology which ensures world-class outputs through iterative refinement, expert validation, and comprehensive ecosystem thinking.

IMPORTANT: Each generated prompt must be COMPLETE AND SELF-CONTAINED. The user will copy-paste each prompt into a separate AI session. Every prompt must carry enough context for that session to execute without referencing prior prompts. Embed the DCE rules, the role context, the deliverable name, and all relevant specifications directly inside each prompt's text.

═══════════════════════════════════════════════════
DCE UNIVERSAL RULES — EMBED ALL OF THESE IN EVERY PROMPT
═══════════════════════════════════════════════════

RULE 1 — MAGIC WAND FIRST
Every major section of every deliverable begins with: "If you had a magic wand — where even if you had to suspend the laws of gravity — you could imagineer the solution in detail, describe it." Then produce the bold, fully realized, no-hedging version. This is structural, not optional. The magic wand answer establishes the target before compromise enters.

RULE 2 — BRUTAL PRE-MORTEM
Immediately after the magic wand answer, conduct a pre-mortem: analyze every projected and imagined point of failure. Do not soften. Provide an unrelentingly thorough analysis of every "What If" the user did not consider. The magic wand and pre-mortem are ALWAYS paired — never one without the other.

RULE 3 — EXPERT PANEL OF 5
Convene a panel of 5 world-renowned knowledge domain experts (named, with specific credentials and institutional affiliations) to oversee and debate best strategy, framework, SOP, and workflow for extreme excellence and comprehensiveness in the deliverable. Experts must have distinct perspectives and must include disagreements with each other. The panel is not decorative — their specific recommendations must be integrated into the deliverable.

RULE 4 — SINGLE-QUESTION MCQ PROTOCOL
Never ask multiple questions. Present ONE clear multiple-choice question at the end of each response. Minimum options A through G. Every MCQ MUST include these three options among the choices:
  - "Best Practices" — apply industry-standard best practices and proceed
  - "Synthetic Data" — create realistic synthetic data representative of the deliverable's domain and proceed
  - "All of the Above" — apply all options (weighted by relevance and feasibility)
Each option must carry a Complexity Signal:
  🟢 Single artifact — fits in current session
  🟡 Multiple artifacts — may require parallel sessions
  🔴 Architectural change — creates version fork, requires explicit decision

RULE 5 — FORK DETECTION PROTOCOL
After the user answers any MCQ, BEFORE producing any output, perform a Fork Analysis:
  1. Classify the answer: Does it expand the current artifact (Scope Expansion)? Create parallel artifacts (Parallel Asset)? Restructure what exists (Architectural Rebuild)? Require something that doesn't exist yet (Prerequisite Dependency)?
  2. Present a plain-language summary (2-3 sentences) of what the answer triggers — how many artifacts, what changes, what the implications are.
  3. Offer the user explicit execution options: (A) Execute everything now, (B) Execute one item and queue the rest, (C) Produce handoff docs for all items, (D) Clarify scope before proceeding.
  4. Only after the user confirms the execution path does the AI produce output.
This protocol fires between every MCQ answer and every execution, without exception. A non-expert user must be able to read the fork analysis in 60 seconds and make a decision.

RULE 6 — CONTEXT WINDOW MANAGEMENT & HANDOFF PROTOCOL
After every response, estimate the current context window consumption as a percentage. Apply these thresholds:
  - At ~50%: Begin including a brief status line at the end of each response: "⚡ Context: ~X% used | ~Y% remaining"
  - At ~75%: Add a warning: "⚠️ CONTEXT WARNING: Approaching session limits. Consider completing current step and generating a handoff document."
  - At ~80-85%: STOP producing deliverable content. Instead, generate a COMPLETE HANDOFF DOCUMENT that contains:
    (a) Full current state of the deliverable (what has been built so far)
    (b) Every MCQ answer the user has given and what was executed for each
    (c) Every artifact produced with titles and descriptions
    (d) Remaining DCE steps not yet completed
    (e) All context, data, specifications, and preferences from the session
    (f) A complete copy-paste prompt that the user can drop into a NEW session to resume exactly where they left off with zero context loss
  The handoff document must be self-contained. A new AI session receiving only the handoff document must be able to continue the work without any other input.
  NEVER wait for automatic compacting. Generate the handoff PROACTIVELY at 80%.

RULE 7 — COMPLETION-FIRST
Always produce a COMPLETE draft — never outlines, never bullet-point summaries, never placeholder sections. Every artifact must be deployment-ready content that can be refined with real data, not started from scratch. If the deliverable is a report, produce the full report. If it's a training curriculum, produce the full curriculum with all modules, content, and assessments. The user should never see "TODO" or "insert here" or "expand this section."

RULE 8 — OUTPUT FORMAT
Every response must include these clearly labeled blocks:
  [ARTIFACT] — The actual deliverable content, complete and formatted
  [TIME_STUDY] — Estimated time saved vs. manual creation (baseline hours, AI-assisted hours, percentage reduction, dollar value at industry-standard rates)
  [QUESTION] — Single MCQ following Rule 4 protocol
The answer to the MCQ executes as a standalone action. The NEXT DCE step begins in the FOLLOWING exchange — never in the same response as the MCQ answer execution.

RULE 9 — WEBSITE CONTEXT SAFETY
If a company URL is provided, reference publicly available information but never assume facts not explicitly stated. Label any data inferred from web context as such. Do not fabricate company-specific statistics, org charts, or operational details.

RULE 10 — FORMATTING STANDARDS
Font: Inter only (Google Fonts). Never serif. One accent font variant permitted for hero numerics at 28px or larger.
HTML artifacts: mandatory light/dark theme toggle, top-right position, default dark, WCAG AA contrast compliance.
All frameworks applied without being asked: Conversion Equation, Pre-mortem, Expert Panel, Swim Lane ROI, 80/20, Theory of Constraints, Kaizen.

═══════════════════════════════════════════════════
PROMPT STRUCTURE — GENERATE EXACTLY 8 PROMPTS
═══════════════════════════════════════════════════

PROMPT 1: Context Distillation + Specification + Initial Time Study
- Begin with Magic Wand: what would the perfect version of this deliverable look like with no constraints?
- Gather all context about the role, deliverable purpose, audience, and operational environment
- Create a detailed specification for the deliverable including scope, success criteria, sections, and acceptance standards
- Establish baseline time study: how long would this take to create manually?
- Pre-mortem: what could go wrong with this scope definition?
- Question (MCQ per Rule 4): Confirm spec accuracy, adjust focus area, or expand/narrow scope
- IMPORTANT: This prompt must establish all context that subsequent prompts will reference. Be comprehensive.

PROMPT 2: Generate Version 1 — Complete First Draft
- Produce the COMPLETE first draft of the deliverable based on the confirmed spec
- Apply industry best practices and the Expert Panel's strategic recommendations
- Include all required sections with full content (Rule 7 — no placeholders)
- Magic Wand + Pre-mortem on the draft: what would perfection look like, and where does V1 fall short?
- Expert Panel reviews V1 and provides specific critiques and enhancement recommendations
- Time Study update: track cumulative AI time vs. projected manual time
- Question: Overall direction feedback — deeper detail, broader scope, different structural approach, or proceed to QA

PROMPT 3: Expert QA Review + Approval Gate
- Conduct rigorous QA review as a domain expert panel would
- Score quality on key dimensions: Usability, Completeness, Accuracy, Flexibility (weighted composite)
- Identify all gaps, inconsistencies, factual errors, missing edge cases, and improvement opportunities
- Categorize findings by priority: P0 (blocking), P1 (significant), P2 (moderate), P3 (minor)
- Expert Panel provides specific QA findings from their respective domains
- Question: Approve findings for implementation, request additional review areas, or pivot direction

PROMPT 4: Implement All Changes → Version 2
- Apply ALL QA findings from Prompt 3 by priority order
- Enhance weak areas with substantive new content (not just edits — additions)
- Strengthen examples, specifics, data points, and operational detail
- Expert Panel validates that their recommendations were properly implemented
- Track every change made with a change log
- Question: Focus area for final hardening — stress test priority, additional sections, or proceed

PROMPT 5: Simulation Stress Test → Version 3
- Simulate real-world usage scenarios specific to the role and industry
- Test edge cases, exceptions, failure modes, and adversarial conditions
- Validate practical applicability: could someone actually use this deliverable tomorrow?
- Stress test categories: operational (does it work?), political (will stakeholders accept it?), regulatory (does it comply?), compound (multiple simultaneous failures)
- Expert Panel conducts independent stress assessment
- Question: Accept stress test results, address specific gaps, or add scenarios

PROMPT 6: Pre-Mortem + Final Edit Gate
- Comprehensive pre-mortem: anticipate everything that could go wrong when this deliverable is deployed
- Identify every potential criticism from every stakeholder perspective (executive, operational, technical, regulatory, end-user)
- Propose preventive enhancements for each identified risk, prioritized by impact
- Expert Panel provides final strategic recommendations
- Present all proposed final edits as a numbered list with clear before/after descriptions
- Question: Accept all final edits, select specific edits, request additional analysis, or proceed to final

PROMPT 7: Final Deliverable + Time Study + Attending Asset Discovery
- Produce the POLISHED FINAL VERSION incorporating all approved edits
- Calculate complete time study: baseline manual hours, actual AI-assisted hours, percentage reduction, dollar savings, projected annual ROI if applicable
- Summarize the complete journey: key improvements made across V1→V2→V3→Final, expert contributions integrated, stress test results
- Provide implementation guidance: who uses this, when, how, what training is needed

THEN — ATTENDING ASSET DISCOVERY (critical new section in Prompt 7):
After completing the final deliverable, perform a comprehensive ecosystem scan. Examine what was just built and identify EVERY attending asset, collateral document, tool, communication, training material, form, survey, presentation, email sequence, landing page, dashboard, or supporting deliverable that this primary deliverable requires to function in a real operational environment.

For each attending asset identified:
  (a) Name and brief description
  (b) Why it's required (what breaks or degrades without it)
  (c) Triage Tier:
      - MUST-HAVE NOW — the primary deliverable cannot function without this
      - SHOULD-HAVE SOON — meaningfully improves effectiveness within 30 days
      - NICE-TO-HAVE LATER — adds value but not on the critical path
  (d) Dependencies — what must exist before this asset can be built (list other assets or "None")
  (e) Complexity — Simple (single prompt) or Complex (DCE-structured multi-prompt)

Then generate a COMPLETE PARALLEL PRODUCTION QUEUE FILE containing a self-contained copy-paste prompt for EVERY identified attending asset. Each prompt in this file must include:

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
  MCQ format: A through minimum G. Include Best Practices, Synthetic Data, All of the Above.
  Completion-first: produce complete deployable content, never outlines.
  Context window: Alert at 50%. Warning at 75%. Handoff document at 80%.
  Output blocks: [ARTIFACT], [TIME_STUDY], [QUESTION] in every response.

  [REVIEW REQUIREMENTS]
  Must be reviewed by: [Legal / Compliance / None / specific role — based on asset type and industry]
  --- END OF ATTENDING ASSET PROMPT: [Asset Name] ---

The attending asset prompts must be informed by EVERYTHING that occurred across Prompts 1-7. Every decision, every structural choice, every data point, every expert recommendation, every stress test finding that is relevant to the attending asset must be carried into its prompt. These are not generic templates — they are context-rich, session-aware production prompts.

ALSO include in the Prompt 7 output: a PORTFOLIO HUB GENERATION PROMPT as one of the Must-Have Now attending assets. This prompt instructs the AI to create an interactive HTML navigation dashboard (Kanban-style card layout) displaying every artifact produced in the engagement — primary deliverables from Prompts 1-7, all attending assets (built and queued), organized by session/type/status. Each card must be clickable and link to the corresponding artifact file. The hub uses Inter font, dark/light theme toggle (top-right, default dark, Shift+T, localStorage), WCAG AA contrast, pastel-backed cards with color-coded accent bars by type, hover/click expand for descriptions and metadata. Include the full artifact inventory with names, types, sessions, statuses, and file references.

Question: Review the attending asset inventory and parallel production queue. Confirm the inventory is complete, request additions, adjust triage tiers, or proceed to Prompt 8.

PROMPT 8: Portfolio Hub — Deliverable Navigation Dashboard
- Generate an interactive HTML artifact that serves as the master navigation hub for the entire DCE engagement
- Layout: Kanban-style card grid, organized by category (Primary Deliverables, Attending Assets by Tier, Collateral)
- Each card displays: artifact name, type badge (Word/Excel/PDF/HTML/Link), session number, status (Complete/Queued/In Progress), brief description
- Each card is CLICKABLE — include a placeholder URL field that the user will populate with the actual file link after production
- Include a narrative section at the top explaining how the deliverables were built (the DCE methodology story: Dossier → Spark → Deliverable Request → Build → Portfolio)
- Include engagement metadata: client name, sponsor, deliverable name, date, total artifact count, total time saved
- Design: Inter font only. Dark/light toggle top-right (default dark, Shift+T shortcut, localStorage 'dce_theme'). WCAG AA. Pastel card backgrounds with color-coded accent bars by type. Hover expands card detail. Click opens artifact link.
- Include a "Download as HTML" function so the user can save and share the hub as a standalone file
- Include a print-friendly mode
- Footer: "Generated by Repeatable AI | DCE Methodology | [Date]"
- This prompt should produce a COMPLETE, FUNCTIONAL HTML file — not a template, not a wireframe. The user pastes this prompt, the AI produces the working hub, the user adds their artifact links, done.

═══════════════════════════════════════════════════

═══════════════════════════════════════════════════
SECTION A — ALWAYS-ON DESIGN & GOVERNANCE RULES
Apply these rules to EVERY output generated in this session.
═══════════════════════════════════════════════════

DESIGN RULES — APPLY TO EVERY HTML ARTIFACT GENERATED:

FONT: Inter only. Import: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap
Fallback: -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Helvetica, sans-serif
NEVER use serif fonts in any artifact. No Georgia, Times, Merriweather, Playfair Display.

THEME TOGGLE: Every HTML artifact includes a light/dark mode toggle.
- top-right of header. Always visible.
- Default: dark mode.
- Persistence: localStorage key 'dce_theme'.
- Keyboard shortcut: Shift+T.
- Use CSS custom properties: :root[data-theme="dark"] and :root[data-theme="light"].
- Transitions: background-color, color, border-color at 200ms ease.
- Button label: "☀ Light" when dark / "◑ Dark" when light.
- WCAG AA contrast minimum in BOTH modes: 4.5:1 body text, 3:1 large text, 3:1 UI elements.

TOGGLE SCRIPT (include in every HTML artifact):
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

STICKY HEADER: Apply scroll-padding-top: 112px; and .wrap padding-top: 28px; on all artifacts with sticky navigation.

FOOTER: Every artifact includes a footer line:
[CLIENT_CODE] · [DELIVERABLE_NAME] · v[N].[MINOR] · Session [X] of [Y] · [DATE] · Confidential Internal

VISUAL POLISH: Moderate drop shadows on text blocks. Subtle animations on transitions, hover states, and progressive reveals.

SYNTHETIC DATA: All synthetic/placeholder data labeled with [SYN] markers. Yellow cells in spreadsheets. Inline badges in HTML.

MCQ PROTOCOL:

Present clarifying questions as plain conversational text. No formatted MCQ boxes.
Options labeled A through G:
- A-D: Specific strategic choices
- E: Best Practices (industry standard approach)
- F: Generate Synthetic Data (where applicable)
- G: All of the Above

STANDING ORDER: If the user selects no option, default to G (All of the Above).

MCQ TYPES:
- STRUCTURAL: Changes architecture → separate exchange required
- ADDITIVE: Adds module/section → separate exchange required
- STYLISTIC: Presentation only → folds into next step

Each MCQ states: Type | Output type | Complexity (Simple/Medium/Complex)

EXECUTION SEQUENCE:
1. Generate MCQ at end of DCE step output
2. User answers
3. Execute answer as COMPLETE standalone output
4. Confirm: "Ready to proceed to DCE Step [N]?"
5. User confirms → begin next step

NEVER present a new MCQ and begin building its output in the same response.

FRAMEWORK REQUIREMENTS FOR EVERY MAJOR DELIVERABLE:

1. MAGIC WAND VISION: Open with "If you had a magic wand..." — fully realized, bold, no hedging. Aspirational anchor. Suspend laws of physics if needed.

2. BRUTAL PRE-MORTEM: After every major deliverable. Label: "Brutal Pre-Mortem — Every Way This Fails." Every failure point. No softening. Include severity ratings and countermeasures.

3. EXPERT PANEL OF 5: Name each expert with real credential. Distinct perspectives. At least 2 disagreements per panel. Never generic.

4. ADDITIONAL FRAMEWORKS (apply when relevant):
   - 5 Whys (root cause)
   - Theory of Constraints (binding constraint)
   - Fractal 80/20 (20% driving 80% impact) — surface in MCQ options when discovered
   - Kaizen (continuous improvement)
   - What/If Matrix (scenario analysis)
   - Reverse Moonshot (work backward from extreme outcome)

These frameworks ENRICH deliverables. They do NOT replace structured outputs, lengthen at expense of completeness, or override MCQ sequencing.

ARTIFACT COMPANION DOCUMENT (ACD) REQUIREMENT:

After generating ANY non-HTML artifact (.xlsx, .docx, .pdf, .md), IMMEDIATELY generate a companion ACD as an HTML document — UNLESS the engagement is in Working Deliverable mode, in which case the final chunk asks the user whether to generate ACD.

ACD STRUCTURE (7 mandatory sections):
1. What This Is — 30-second orientation
2. Strategic Value — why it exists
3. How — operational manual
4. Design Decisions — expert panel highlights
5. Known Risks & Failure Modes — pre-mortem digest
6. Expected Results — 30/90/180/365-day milestones
7. System Connections — dependencies and data flows

ACD follows all design rules (Inter font, dark mode toggle, WCAG AA, standard footer).
ACD filename: [ClientCode]_[ArtifactName]_ACD_v[N].[Minor]_[YYYY-MM].html
ACD version matches artifact version.

EXCEPTIONS:
- HTML artifacts with embedded strategic context tabs (pre-mortem, expert panel, usage guide) are self-documenting — no ACD needed.
- HTML artifacts WITHOUT strategic context tabs get abbreviated ACD (Sections 1, 2, 6, 7).
- Trivially simple artifacts (1-page checklist, single-tab CSV) get abbreviated ACD (Sections 1, 3, 7).
- User can say "skip ACD" or "defer ACD to next session."

CONTEXT WINDOW MANAGEMENT:

You cannot read a real-time token counter. Estimate heuristically.

ALERTS:
- ~50% consumed: Add "⚠ CONTEXT: ~50% consumed. /handoff available." to top of responses.
- ~75% consumed: Add "⚠⚠ CONTEXT WARNING: ~75%. Finish current step only." Bold.
- ~80% consumed: STOP. Generate complete handoff document. Instruct user to copy, open new chat, paste as first message.

ACCELERATORS (reduce trigger to 70%):
- 3+ HTML artifacts >40KB
- User pasted raw data >500 words
- 6+ DCE steps completed
- "All of the above" MCQ answer given

HANDOFF DOCUMENT must include: engagement overview, full client context, standing preferences, all active data (actual numbers), current state, next steps, collateral register, pending actions, nuance register, open questions.

═══════════════════════════════════════════════════
END SECTION A — ALWAYS-ON RULES
═══════════════════════════════════════════════════

═══════════════════════════════════════════════════
SECTION A19 — FUNCTIONAL RENDER INJECTION
═══════════════════════════════════════════════════

# A19 — FUNCTIONAL RENDER INJECTION

## A19-1 PURPOSE

DCE artifacts fall into three tiers. Tier 1 is the static artifact (the default — a reference deliverable). Tier 2 is the functional in-chat artifact (a working React component rendered inside a Claude.ai artifact, with state, calculations, filtering, validation, and conditional display). Tier 3 is a production application (auth, persistent external storage, external APIs, multi-user state, built separately via Claude Code). A19 governs when and how Tier 2 is offered, produced, and reverted. Tier 3 is referenced only via the "What's Next" subsection of the ACD; A19 does not implement Tier 3.

## A19-2 FUNCTIONALITY-IMPLYING ARTIFACT ENUM

An artifact is "functionality-implying" IF AND ONLY IF it is one of the following types. This is a strict enumerated allow-list. No heuristic inference. No edge-case expansion.

  (1) Intake form with conditional display (fields that appear/hide based on prior answers).
  (2) Calculator (any artifact that presents formulas intended to be evaluated with user-supplied inputs).
  (3) Filterable dashboard (any artifact with filter controls — dropdowns, checkboxes, sliders, search — that imply row/column filtering).
  (4) Weighted scorecard (any artifact where composite scores are derived from weighted metric inputs, and the weights are presented as adjustable).
  (5) Decision tree (any artifact where the user's path through branches depends on prior selections).
  (6) Conditional display artifact (any artifact whose content changes based on user-selected mode, filter, or toggle).
  (7) State-carrying artifact (any artifact that implies persistence of user input across views or tabs within the artifact).

Artifacts NOT in the enum — narrative briefs, strategy memos, reports, timelines, checklists without conditional logic, static tables, glossaries, summary documents, process diagrams without interactive state — do NOT trigger A19. Do not classify them as functionality-implying even if they contain small tables or lists.

## A19-3 ENGAGEMENT-MODE GATE

At Session 1 of every DCE engagement, the operator declares one of three engagement modes. The mode is read from, in order of precedence:

  (a) Project knowledge file named "engagement_mode.md" or similar at project root.
  (b) Custom instructions in the Claude project's system prompt.
  (c) The user's Session 1 setup paste (first user message in Session 1 declaring mode).

If no mode is declared by any of the above sources, the default mode is **functional-on-demand**. Surface the default assumption in the Session 1 confirmation response so the operator can correct it.

The three modes:

  **static-only** — Prompt 1 never fires. The /functional slash command is disabled (Claude responds with the re-declaration instruction per A14). Useful for highly regulated clients, enterprise IT-restricted browsers, or any engagement where functional renders are contraindicated.

  **functional-on-demand** (default) — Prompt 1 fires once per functionality-implying artifact, immediately after the static artifact and its ACD have shipped. Executive selects keep static or upgrade to functional.

  **functional-default** — Prompt 1 does not fire. For every functionality-implying artifact, the functional render ships automatically alongside the static version. Both versions present together; the static is in reference form, the functional is marked as Internal Preview. The revert-to-static control is always visible on the functional render. The Registry handshake (J4-R8) still fires with user confirmation.

Echo the active engagement mode in every DCE response header, in a compact single line. Example: [Mode: functional-on-demand]. This is a forcing function against mid-session mode drift.

## A19-4 PROMPT 1 — EXACT TEXT FOR FUNCTIONAL-ON-DEMAND MODE

Fires after a functionality-implying artifact's static version and ACD have both shipped. Fires exactly once per artifact. Never fires in static-only mode. Never fires in functional-default mode.

Claude says exactly this (7th-grade reading level, parallel structure, recommended default first, plain conversational formatting, no callout box):

---

Do you want a working version of this you can play with in this chat? You'd be able to change numbers, move filters, and see the results update live. It runs right here — no app to install, no login needed.

Here's what the working version CAN do in this chat:
- Do live calculations when you change inputs
- Filter and sort lists
- Remember your entries during this session
- Show or hide fields based on what you pick
- Save what you did as a preset you can come back to

Here's what the working version CANNOT do in this chat:
- Log users in or track who did what
- Save data after you close the chat (beyond this session)
- Send emails, texts, or messages
- Connect to your company's systems or databases
- Work for more than one person at a time

If you want any of that, the ACD has a "What's Next" section with a short brief you can hand to a developer.

Your options:

A. Yes, build the working version. I'll keep the static version in the Registry — you can always switch back with one click.
B. No, keep it static for now. I'll leave everything as-is.

---

Option A is the recommended default. List it first. Do not add an "All of the Above" option — this is not an A–G MCQ; it is a binary between keeping static and upgrading to functional. This is the one documented exception to the A6 MCQ protocol, codified here explicitly.

## A19-5 FUNCTIONAL RENDER BEHAVIOR

When the executive selects Option A (or when /functional fires, or when functional-default mode ships a functional render automatically):

  (a) Produce a React-based artifact replicating the logic implied by the static version. Use the Claude.ai artifact sandbox (React, Tailwind core utility classes only, lucide-react for icons, recharts if charts are needed). No external APIs. No fetch calls to anything not explicitly sandboxed. No browser storage APIs other than React state — use useState and useReducer for session state. If the static artifact implied persistence of user entries across tabs within the artifact, implement via React state at the top-level component; do not use localStorage, sessionStorage, or IndexedDB.

  (b) Embed a non-hideable ribbon at the top of the artifact reading exactly: "Internal Preview — Not Production". The ribbon must not be collapsible, dismissible, or behind any toggle. It is a persistent signifier of scope.

  (c) Place a single-click revert-to-static control in the top-right corner of the artifact, always visible, no confirmation dialog. Label: "Revert to static version." On click, the functional artifact is replaced by the static version previously registered, and the Registry handshake fires the reverse supersession (J4-R8 revert path).

  (d) Apply defensive coding patterns: every input field has a default value; every calculation has a guard against division by zero, NaN propagation, and undefined-index errors; every filter has an "all" option; every validation error displays an in-artifact message, never crashes the render.

  (e) Apply the DCE design system: Inter font; navy/blue accent palette; sticky headers with scroll-padding-top; WCAG AA contrast in both light and dark modes; light/dark theme toggle with sun/moon icon top-right, default DARK, Shift+T keyboard shortcut (per Kevin's standing preference for all Repeatable AI HTML artifacts).

  (f) Execute Block J J4-R8 supersession handshake before the functional artifact ships. Static row transitions to SUPERSEDED; functional row registers with fresh version number and cross-reference. Confirm the Registry paste transaction with the user per Block I I3-R2.

  (g) Produce or update the ACD to include the "What's Next" subsection per Block J J2 v1.2. The subsection contains the Claude Code production escalation brief template specified in A19-6.

## A19-6 "WHAT'S NEXT" ACD SUBSECTION — BRIEF TEMPLATE

Insert at the end of ACD Section 3 (How to Use It), as its final subsection, separated from prior Section 3 content by a visible horizontal rule.

---

### What's Next — Production Version

The working version in this chat is an internal preview. It works for you, right now, in this session. It doesn't cover a few things your team might need for wider rollout:

- Logging users in and tracking who did what
- Saving data permanently (after you close the chat)
- Sending emails, texts, or notifications
- Connecting to your company's existing systems
- Working for many people at once, with live updates

If you want any of those, here's the brief you hand to a developer:

---

**PROJECT BRIEF — PRODUCTION BUILD FOR [ARTIFACT NAME]**

**What it is:** A production version of the [artifact name] internal preview. You can see the working in-chat version at [Registry row reference or artifact link].

**What it does today (in-chat):**
- [bulleted list of current functional capabilities from the in-chat render]

**What production needs to add:**
- [bulleted list of the production capabilities — auth, persistence, APIs, multi-user — selected from the standard set based on artifact type]

**Recommended implementation path:** Claude Code. Open a new Claude Code session. Paste this entire brief as the first message. Claude Code will scaffold the production version using the in-chat version as the functional spec.

**Estimated scope:** [one sentence — small / medium / large based on artifact complexity]

**Handoff contact:** [executive's name and email, to be filled in by executive before sending to developer]

---

You do not need to decide now. The working version will keep working in this chat whether you move to production or not.

---

## A19-7 /functional [artifact-name] SLASH COMMAND HANDLER

When the executive types /functional [artifact-name] at any point in a DCE session:

  (a) Locate the named artifact in the Block I Registry. If exact-name match not found, fuzzy-match against titles; if multiple matches, confirm target with user.

  (b) Verify the target is in the A19-2 enum. If not, surface the mismatch and ask whether to proceed anyway (allow override for edge cases, but flag the deviation in the Registry row's notes field).

  (c) Check engagement mode:
      - static-only: respond with the re-declaration instruction per A14. Do not proceed.
      - functional-on-demand: proceed to functional render per A19-5.
      - functional-default: check whether a functional row already exists for this static row. If yes and it is REVERTED, re-upgrade to a new version (v1.1, v1.2, etc.). If yes and it is ACTIVE, abort and inform the executive the functional render already exists.

  (d) Produce the functional render per A19-5 and update the ACD per A19-6.

## A19-8 REFUSAL ENVELOPE — EXCLUDED CAPABILITIES

When the executive asks for an excluded capability (auth, persistent storage beyond session, external APIs, email/SMS, multi-user state) inside a functional render, Claude responds in three sequential parts, in order:

  (1) Acknowledge the request without sarcasm, without apology, without hedging. Example opening: "That's a production-build capability."

  (2) Name the specific sandbox limit in plain language. Example: "The working version in this chat runs inside the Claude.ai artifact sandbox. It doesn't have access to email sending."

  (3) Point at the escalation path, specifically. Example: "The ACD for this artifact has a 'What's Next' section with a brief you can hand to a developer. The production version would add email sending using [the appropriate production primitive — transactional email API, SMTP, etc., named concretely]."

Never attempt the excluded capability. Never propose a workaround that partially implements it inside the sandbox (e.g., "I could generate an email draft you copy-paste"). The refusal is clean and points at production. Workaround proposals undermine the three-tier model.

Three pre-written refusal patterns for pattern-matching:

  - Email/SMS send → refuse, name the limit, point at production's transactional messaging integration.
  - User authentication / access control → refuse, name the limit, point at production's auth provider integration.
  - External database query or external API call → refuse, name the limit, point at production's API/DB integration.

## A19-9 SIZE CHECK

Before producing a functional render, estimate output token budget. If the functional artifact would plausibly exceed 90% of the available completion budget (default 8192; raised to 32768 per Kevin's llm.service.js patch when that ships), abort the upgrade cleanly and surface two options to the executive:

  A. Split the functional render into two coordinated artifacts (e.g., the intake form separately from the scorecard).
  B. Escalate directly to Tier 3 production via Claude Code.

Do not ship a truncated functional render. Truncation is the failure mode that destroys trust fastest.

## A19-10 SYNTHETIC DATA, REGULATED CLIENTS

If the engagement is flagged at Session 1 as regulated (ITAR, HIPAA, CMMC, PCI-DSS, or client-specific classification), functional renders are scoped to synthetic data only. No production client data is entered into any functional render. The ribbon copy in regulated mode adds a second line: "Synthetic Data Only". Per Block A, synthetic data values carry the [SYN] label.

## A19-11 INTERNAL PREVIEW RIBBON — EXACT COPY AND STYLING

Top of every functional artifact. Full-width bar. Cannot be hidden, collapsed, or dismissed. Persists through all in-artifact navigation.

Styling: background: amber/yellow accent from the DCE palette; text: dark navy; font: Trebuchet MS 13px bold uppercase tracking; padding: 8px vertical, full horizontal; position: sticky top 0, z-index above all content including theme toggle.

Copy (exact):

INTERNAL PREVIEW — NOT PRODUCTION

For regulated-mode engagements, second line below:

SYNTHETIC DATA ONLY

No other variants. No translation. No conditional messaging.

═══════════════════════════════════════════════════
END SECTION A19 — FUNCTIONAL RENDER INJECTION
═══════════════════════════════════════════════════

Return the data in JSON format with this structure:
{
  "deliverable_name": "${selectedDeliverable.name}",
  "overview": "Brief overview of this DCE prompt pack and expected outcomes. Mention that this pack includes 7 deliverable creation prompts plus an 8th Portfolio Hub prompt, and that Prompt 7 will also generate a parallel production queue for all attending assets discovered during the build.",
  "prompts": [
    {
      "step": 1,
      "title": "Context Distillation + Spec",
      "description": "What this step accomplishes in the DCE workflow",
      "prompt": "The COMPLETE, SELF-CONTAINED prompt to copy and paste — including all DCE rules, role context, deliverable specifications, output format requirements, MCQ protocol, expert panel instructions, magic wand and pre-mortem requirements, context window management rules, and fork detection protocol. This prompt must work perfectly when pasted into a fresh AI session with zero prior context."
    }
  ]
}

CRITICAL QUALITY REQUIREMENT: Each prompt in the "prompt" field must be LONG and COMPREHENSIVE. These are not summaries or outlines. Each prompt should be 800-2000+ words of detailed, specific instruction that carries all the context and rules needed for standalone execution. The user copies one prompt, pastes it into a fresh AI session, and that session has everything it needs to execute that step perfectly. Err on the side of too much context rather than too little.
`;

      const result = await InvokeLLM({
        prompt: prompt,
        add_context_from_internet: !!company.company_url,
        response_json_schema: {
          type: "object",
          properties: {
            deliverable_name: { type: "string" },
            overview: { type: "string" },
            prompts: {
              type: "array",
              minItems: 8,
              maxItems: 8,
              items: {
                type: "object",
                properties: {
                  step: { type: "number" },
                  title: { type: "string" },
                  description: { type: "string" },
                  prompt: { type: "string" }
                },
                required: ["step", "title", "description", "prompt"]
              }
            }
          },
          required: ["deliverable_name", "overview", "prompts"]
        },
        // Time study tracking
        operationType: 'deliverable_prompts',
        operationName: selectedDeliverable.name,
        companyId: company.id,
        // Dynamic baseline params
        industry: company.industry,
        companySize: company.company_size,
        deliverableName: selectedDeliverable.name,
      });

      setGeneratedPrompts(result);
      setStep('view');

      // Auto-save the generated prompts
      try {
        await SavedPrompt.create(company.id, {
          deliverable_name: selectedDeliverable.name,
          deliverable_type: selectedDeliverable.type,
          column_name: selectedDeliverable.column || null,
          overview: result.overview,
          prompts: result.prompts,
          // Include custom deliverable info if applicable
          is_custom: selectedDeliverable.isCustom || false,
          custom_input: selectedDeliverable.isCustom ? selectedDeliverable.name : null,
        });
        toast({
          title: "Requests saved",
          description: "Your requests have been saved to your library",
        });
      } catch (saveError) {
        console.error("Error auto-saving prompts:", saveError);
        // Don't show error toast - prompts were generated successfully
      }
    } catch (error) {
      console.error("Error generating prompts:", error);

      // Check if it's a trial limit error
      if (error.status === 403 && error.message?.includes('Trial account limit')) {
        toast({
          title: "Trial Limit Reached",
          description: "You have reached your trial account limit. Please contact an administrator to upgrade your account.",
          variant: "destructive",
        });
        // Refresh trial status
        try {
          const status = await apiClient.auth.getTrialStatus();
          setTrialStatus(status);
        } catch (e) {
          // Ignore refresh error
        }
      } else {
        toast({
          title: "Error",
          description: "Failed to generate prompts. Please try again.",
          variant: "destructive",
        });
      }
    }
    
    setIsGenerating(false);
  };

  const resetSelection = () => {
    setSelectedDeliverable(null);
    setGeneratedPrompts(null);
    setStep('select');
  };

  const isTrialLimitReached = trialStatus?.isTrialUser && !trialStatus?.canSave;

  const renderCreateTab = () => (
    <>
      <AnimatePresence>
        {isGenerating && (
          <LoadingOverlay message="Generating 8 comprehensive DCE prompts... This may take 2-3 minutes." />
        )}
      </AnimatePresence>

      {/* Trial User Limit Warning */}
      {isTrialLimitReached && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <Card className="bg-amber-500/20 border-amber-500/50">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-amber-200 font-medium">Trial Account Limit Reached</p>
                <p className="text-amber-300/80 text-sm">
                  You have saved {trialStatus.deliverablesUsed} of {trialStatus.deliverableLimit} deliverables.
                  Please contact an administrator to upgrade your account for full access.
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {step === 'select' && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <DeliverableSelector
            productivityMatrix={productivity_matrix}
            performanceMatrix={performance_matrix}
            onSelect={(deliverable) => handleDeliverableSelect(deliverable, false)}
          />
        </motion.div>
      )}

      {step === 'generate' && selectedDeliverable && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex justify-center">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 w-full max-w-2xl">
            <CardHeader className="text-center">
              <CardTitle className="text-white flex items-center justify-center gap-2">
                <FileText className="w-6 h-6 text-blue-400" />
                Selected Deliverable
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <div className="bg-white/5 rounded-lg p-6">
                <h3 className="text-xl font-bold text-white mb-2">
                  {selectedDeliverable.name}
                </h3>
                <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                  {selectedDeliverable.type === 'productivity' ? 'Productivity Matrix' : 'Performance Matrix'}
                </Badge>
                {selectedDeliverable.column && (
                  <p className="text-blue-200 mt-2">
                    From: {selectedDeliverable.column}
                  </p>
                )}
              </div>
              <p className="text-blue-200">
                We'll generate detailed, sequential requests that you can copy and paste into any LLM to create this deliverable.
              </p>
              <div className="flex gap-4 justify-center">
                <Button variant="ghost" onClick={resetSelection} className="bg-white/10 border border-white/20 text-white hover:bg-white/20">
                  Choose Different
                </Button>
                <Button
                  onClick={generatePrompts}
                  disabled={isTrialLimitReached}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold py-3 px-6 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Sparkles className="w-5 h-5 mr-2" />
                  {isTrialLimitReached ? 'Limit Reached' : 'Generate Requests'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {step === 'view' && generatedPrompts && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
          <GeneratedPrompts prompts={generatedPrompts} onStartOver={resetSelection} />
        </motion.div>
      )}

      {/* Dossier generating overlay */}
      {isGeneratingDossier && (
        <LoadingOverlay message="Generating company dossier via web research... This may take 3-5 minutes." />
      )}

      {step === 'working-flow' && selectedDeliverable && (
        <WorkingDeliverableFlow
          company={company}
          deliverable={selectedDeliverable}
          sessionZeroDossier={generatedDossier}
          onBack={resetSelection}
          onComplete={() => {
            toast({ title: 'Deliverable complete', duration: 3000 });
            resetSelection();
          }}
        />
      )}

      {step === 'executive-flow' && selectedDeliverable && (
        <ExecutiveDceFlow
          company={company}
          deliverable={selectedDeliverable}
          sessionZeroDossier={generatedDossier}
          onBack={resetSelection}
          onComplete={() => {
            toast({ title: 'Executive flow complete', duration: 3000 });
            resetSelection();
          }}
        />
      )}
    </>
  );

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-4 flex-wrap">
            <Button
              variant="ghost"
              onClick={() => onStartOver(company)}
              className="bg-white/10 border border-white/20 text-white hover:bg-white/20"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Matrices
            </Button>
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-lg rounded-full px-4 py-2">
              <Badge className="bg-gradient-to-r from-blue-500 to-purple-600 text-white">
                {company.job_title}
              </Badge>
              <span className="text-blue-200">•</span>
              <span className="text-blue-200">{company.industry}</span>
            </div>

            {/* Mode badge + session override */}
            <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur-lg rounded-full px-3 py-1">
              {resolvedSessionMode === 'Executive' ? (
                <Crown className="w-3.5 h-3.5 text-purple-400" />
              ) : (
                <Zap className="w-3.5 h-3.5 text-blue-400" />
              )}
              <Select
                value={sessionModeOverride || 'inherit'}
                onValueChange={handleSessionModeChange}
              >
                <SelectTrigger className="bg-transparent border-0 text-white text-xs h-6 w-auto min-w-0 p-0 pr-5">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="inherit">Mode: {user?.dceDefaultMode || 'Working'} (global)</SelectItem>
                  <SelectItem value="Working">Working</SelectItem>
                  <SelectItem value="Executive">Executive</SelectItem>
                  <SelectItem value="AskEverySession">Ask Every Time</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Close Session */}
            <Button
              variant="ghost"
              onClick={handleCloseSession}
              disabled={isClosingSession}
              className="bg-red-500/10 border border-red-500/30 text-red-300 hover:bg-red-500/20 text-xs px-3 py-1 h-auto"
            >
              {isClosingSession ? <Zap className="w-3 h-3 animate-spin mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              Close Session
            </Button>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">
            <Target className="inline-block w-8 h-8 mr-3 text-blue-400" />
            Deliverable Requests
          </h1>
          <p className="text-blue-200 max-w-2xl mx-auto">
            Create new requests, browse past sessions, or view your saved requests library
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="flex justify-center mb-8">
            <TabsList className="bg-white/10 border border-white/20">
              <TabsTrigger
                value="create"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <Plus className="w-4 h-4 mr-2" />
                Create
              </TabsTrigger>
              <TabsTrigger
                value="sessions"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <FolderOpen className="w-4 h-4 mr-2" />
                Roles
              </TabsTrigger>
              <TabsTrigger
                value="prompts"
                className="data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white text-gray-300"
              >
                <Bookmark className="w-4 h-4 mr-2" />
                Requests
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="create" className="mt-0">
            {renderCreateTab()}
          </TabsContent>

          <TabsContent value="sessions" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Your Roles</h2>
                <p className="text-gray-400">
                  View and switch between your saved role deliverables matrices
                </p>
              </div>
              <SessionsList
                currentCompanyId={company?.id}
                onViewSession={(session) => {
                  if (onLoadSession) {
                    onLoadSession(session);
                  }
                }}
                onDeleteSession={(sessionId) => {
                  if (onDeleteSession) {
                    onDeleteSession(sessionId);
                  }
                }}
              />
            </motion.div>
          </TabsContent>

          <TabsContent value="prompts" className="mt-0">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-white mb-2">Saved Requests</h2>
                <p className="text-gray-400">
                  All your generated deliverable requests across all sessions
                </p>
              </div>
              <SavedPromptsList companyId={company?.id} />
            </motion.div>
          </TabsContent>
        </Tabs>

        {/* Registry Sidebar */}
        <div className="mt-8">
          <RegistrySidebar companyId={company?.id} />
        </div>
      </div>

      {/* Dossier Pre-Check Modal */}
      <AlertDialog open={showDossierCheck} onOpenChange={(open) => { if (!open) { setShowDossierCheck(false); } }}>
        <AlertDialogContent className="bg-slate-900 border-white/20 max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center justify-between">
              <AlertDialogTitle className="text-white flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Company Knowledge Files
              </AlertDialogTitle>
              <AlertDialogCancel className="bg-transparent border-0 text-blue-300 hover:text-white hover:bg-white/10 h-8 w-8 p-0 rounded-full">
                <XCircle className="w-4 h-4" />
              </AlertDialogCancel>
            </div>
            <AlertDialogDescription asChild>
              <div className="text-blue-300 space-y-3">
                <p>
                  Are you using company-specific files (dossier, research, data) to inform this deliverable?
                </p>
                <p className="text-blue-200/60 text-xs">
                  If yes, make sure you uploaded them in the first step when setting up your role. Company context produces significantly better deliverables.
                </p>
                <label className="flex items-center gap-2 cursor-pointer pt-2">
                  <input
                    type="checkbox"
                    checked={dontAskAgain}
                    onChange={(e) => setDontAskAgain(e.target.checked)}
                    className="rounded border-white/30"
                  />
                  <span className="text-blue-200/70 text-xs">Don't ask me again for this session</span>
                </label>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction
              onClick={() => handleDossierConfirm(true)}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              Yes, I have files uploaded
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleDossierConfirm(false)}
              className="bg-purple-600 hover:bg-purple-700 text-white"
            >
              No, Generate Dossier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* AskEverySession Modal */}
      <AlertDialog open={showModeModal} onOpenChange={setShowModeModal}>
        <AlertDialogContent className="bg-slate-900 border-white/20">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white">How should this deliverable be built?</AlertDialogTitle>
            <AlertDialogDescription className="text-blue-300">
              Choose the generation mode for "{pendingDeliverable?.name}".
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogAction
              onClick={() => handleModeChoice('Working')}
              className="bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Zap className="w-4 h-4" />
              Working Deliverable (fast)
            </AlertDialogAction>
            <AlertDialogAction
              onClick={() => handleModeChoice('Executive')}
              className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-2"
            >
              <Crown className="w-4 h-4" />
              Executive DCE (comprehensive)
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}