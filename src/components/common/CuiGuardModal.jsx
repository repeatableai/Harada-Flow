/**
 * CUI Guard Modal
 *
 * Client-side paste interceptor for DCE text input fields.
 * Runs a lightweight Category A + B pattern scan on pasted text > 500 chars.
 * Shows a warning modal before the paste is committed.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import { AlertTriangle } from 'lucide-react';

// ── CLIENT-SIDE CUI PATTERNS (Categories A + B only) ──────────────────

const CLIENT_PATTERNS = [
  { name: 'CUI Banner', pattern: /\bCUI\b/ },
  { name: 'CUI Category Marking', pattern: /\bCUI\s*\/\// },
  { name: 'Full CUI Designation', pattern: /CONTROLLED\s+UNCLASSIFIED\s+INFORMATION/i },
  { name: 'NOFORN', pattern: /\bNOFORN\b/i },
  { name: 'FEDCON', pattern: /\bFEDCON\b/i },
  { name: 'FED ONLY', pattern: /\bFED\s+ONLY\b/i },
  { name: 'TOP SECRET', pattern: /\bTOP\s+SECRET\b/i },
  { name: 'TS//SCI', pattern: /\bTS\s*\/\/\s*SCI\b/i },
  { name: 'FOUO', pattern: /\bFOR\s+OFFICIAL\s+USE\s+ONLY\b/i },
  { name: 'FOUO Abbreviation', pattern: /\bFOUO\b/i },
];

// False positive words containing "CUI"
const CUI_FALSE_POSITIVES = /\b(circuit|circuits|circuitry|cuisine|biscuit|biscuits|cuirass)\b/i;

function clientScanText(text) {
  const findings = [];
  for (const { name, pattern } of CLIENT_PATTERNS) {
    if (pattern.test(text)) {
      // Check false positives for CUI
      if (name === 'CUI Banner' && CUI_FALSE_POSITIVES.test(text)) {
        // Verify the CUI match is actually standalone
        const cuiMatch = text.match(/\bCUI\b/);
        if (cuiMatch) {
          const surrounding = text.substring(
            Math.max(0, cuiMatch.index - 10),
            cuiMatch.index + cuiMatch[0].length + 10
          );
          if (CUI_FALSE_POSITIVES.test(surrounding)) continue;
        }
      }
      findings.push(name);
    }
  }
  return findings;
}

/**
 * Hook: attach CUI paste guard to a container element
 *
 * Usage:
 *   const { modalProps } = useCuiGuard(containerRef);
 *   return <><div ref={containerRef}>...inputs...</div><CuiGuardDialog {...modalProps} /></>
 */
export function useCuiGuard(containerRef) {
  const [showModal, setShowModal] = useState(false);
  const [findings, setFindings] = useState([]);
  const pendingPasteTarget = useRef(null);
  const pendingPasteText = useRef('');

  const handlePaste = useCallback((e) => {
    const pastedText = e.clipboardData?.getData('text/plain') || '';
    if (pastedText.length < 500) return; // Skip short pastes

    const detected = clientScanText(pastedText);
    if (detected.length === 0) return;

    // Prevent the paste
    e.preventDefault();
    e.stopPropagation();

    pendingPasteTarget.current = e.target;
    pendingPasteText.current = pastedText;
    setFindings(detected);
    setShowModal(true);
  }, []);

  useEffect(() => {
    const container = containerRef?.current;
    if (!container) return;

    container.addEventListener('paste', handlePaste, true);
    return () => container.removeEventListener('paste', handlePaste, true);
  }, [containerRef, handlePaste]);

  const handleConfirm = useCallback(() => {
    // Allow the paste by inserting the text
    const target = pendingPasteTarget.current;
    if (target) {
      if (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT') {
        const start = target.selectionStart || 0;
        const end = target.selectionEnd || 0;
        const value = target.value;
        target.value = value.slice(0, start) + pendingPasteText.current + value.slice(end);
        // Trigger React's onChange
        const event = new Event('input', { bubbles: true });
        target.dispatchEvent(event);
      } else if (target.isContentEditable) {
        document.execCommand('insertText', false, pendingPasteText.current);
      }
      // Flag the field visually
      target.dataset.cuiConfirmed = 'true';
    }
    setShowModal(false);
    pendingPasteTarget.current = null;
    pendingPasteText.current = '';
  }, []);

  const handleRemove = useCallback(() => {
    setShowModal(false);
    pendingPasteTarget.current = null;
    pendingPasteText.current = '';
  }, []);

  return {
    modalProps: {
      open: showModal,
      findings,
      onConfirm: handleConfirm,
      onRemove: handleRemove,
    },
  };
}

/**
 * CUI Guard Warning Dialog
 */
export function CuiGuardDialog({ open, findings, onConfirm, onRemove }) {
  const cancelRef = useRef(null);

  // Focus trap: Escape defaults to Remove
  useEffect(() => {
    if (open && cancelRef.current) {
      cancelRef.current.focus();
    }
  }, [open]);

  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onRemove(); }}>
      <AlertDialogContent
        className="bg-slate-900 border-red-500/40 max-w-[480px]"
        style={{ zIndex: 10000 }}
        aria-label="CUI Warning"
      >
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-400" />
            Potential CUI Indicators Detected
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="text-blue-300 space-y-3">
              <p>
                The content you pasted contains patterns that may indicate
                Controlled Unclassified Information:
              </p>
              <ul className="list-disc ml-4 space-y-1 text-red-300/80">
                {findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
              <p className="text-sm text-blue-300/70">
                This content should not be submitted if it contains CUI,
                ITAR, or export-controlled information.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            ref={cancelRef}
            onClick={onRemove}
            className="bg-slate-800 text-white border-white/20 hover:bg-slate-700"
          >
            Remove Pasted Content
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className="bg-amber-600 text-white hover:bg-amber-700"
          >
            I Confirm This Is Not CUI
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
