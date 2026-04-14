/**
 * CUI Pattern Scanner
 *
 * Scans text and metadata for CUI (Controlled Unclassified Information) indicators.
 * Used as the core engine for the CUI sniffer middleware.
 *
 * Three verdicts: BLOCK, WARN, PASS
 */

// ── CATEGORY A: CUI Banner Markings (BLOCK) ──────────────────────────

const CATEGORY_A = [
  { name: 'CUI Banner', pattern: /\bCUI\b/, context: null },
  { name: 'CUI Category Marking', pattern: /\bCUI\s*\/\//, context: null },
  { name: 'Full CUI Designation', pattern: /CONTROLLED\s+UNCLASSIFIED\s+INFORMATION/i, context: null },
  { name: 'NOFORN Marking', pattern: /\bNOFORN\b/i, context: null },
  { name: 'FEDCON Marking', pattern: /\bFEDCON\b/i, context: null },
  { name: 'FED ONLY Marking', pattern: /\bFED\s+ONLY\b/i, context: null },
  { name: 'DL ONLY Marking', pattern: /\bDL\s+ONLY\b/i, context: null },
  { name: 'Controlled By Indicator', pattern: /Controlled\s+by\s*:/i, context: null },
  { name: 'CUI Category Indicator', pattern: /CUI\s+Category\s*:/i, context: null },
  { name: 'Distribution Control Indicator', pattern: /Distribution\/Dissemination\s+Control\s*:/i, context: null },
];

// ── CATEGORY B: Classification Markings (BLOCK) ──────────────────────

const CATEGORY_B = [
  { name: 'TOP SECRET', pattern: /\bTOP\s+SECRET\b/i, context: null },
  { name: 'TS//SCI', pattern: /\bTS\s*\/\/\s*SCI\b/i, context: null },
  {
    name: 'SECRET Classification',
    pattern: /\bSECRET\b/,
    context: /\b(classified|NOFORN|clearance|compartmented)\b/i,
  },
  {
    name: 'CONFIDENTIAL Classification',
    pattern: /\bCONFIDENTIAL\b/,
    context: /\b(classified|NOFORN|clearance|compartmented|classification)\b/i,
  },
  { name: 'FOUO Full', pattern: /\bFOR\s+OFFICIAL\s+USE\s+ONLY\b/i, context: null },
  { name: 'FOUO Abbreviation', pattern: /\bFOUO\b/i, context: null },
  {
    name: 'SBU Marking',
    pattern: /\bSBU\b/,
    context: /\b(sensitive|unclassified)\b/i,
  },
];

// ── CATEGORY C: ITAR / Export Control (BLOCK) ─────────────────────────

const CATEGORY_C = [
  { name: 'ITAR Reference', pattern: /\bITAR\b/i, context: null },
  { name: 'ITAR CFR Reference', pattern: /22\s*CFR\s*(12[0-9]|130)/i, context: null },
  { name: 'USML Reference', pattern: /\bUSML\b/i, context: null },
  { name: 'ECCN Number', pattern: /\bECCN\s*[0-9A-Z]/i, context: null },
  {
    name: 'EAR Reference',
    pattern: /\bEAR\b/,
    context: /\b(export|controlled|commerce)\b/i,
  },
  { name: 'Defense Article', pattern: /\bdefense\s+article/i, context: null },
  {
    name: 'Technical Data (Export)',
    pattern: /\btechnical\s+data\b/i,
    context: /\b(ITAR|export|munitions|defense)\b/i,
  },
  { name: 'DoD Distribution Statement', pattern: /Distribution\s+Statement\s+[B-F]/i, context: null },
  { name: 'US Munitions List', pattern: /\bU\.S\.\s+Munitions\s+List\b/i, context: null },
];

// ── CATEGORY D: Contract Clause References (WARN) ─────────────────────

const CATEGORY_D = [
  { name: 'DFARS 252.204-701x', pattern: /DFARS\s+252\.204[–\-]701[0-9]/i, context: null },
  { name: 'FAR 52.204-21', pattern: /FAR\s+52\.204[–\-]21/i, context: null },
  { name: 'NIST 800-171', pattern: /\bNIST\s+(SP\s+)?800[–\-]171\b/i, context: null },
  { name: 'DD Form 254', pattern: /\bDD\s+Form\s+254\b/i, context: null },
  { name: 'CMMC Level 2/3', pattern: /\bCMMC\s+Level\s+[23]\b/i, context: null },
];

// ── CATEGORY E: Heuristic / Contextual (WARN) ─────────────────────────

const CATEGORY_E = [
  {
    name: 'CAGE Code',
    pattern: /\b[0-9A-HJ-NP-Z]{5}\b/,
    context: /\b(CAGE|contract|procurement)\b/i,
  },
];

// ── FALSE POSITIVE PATTERNS ───────────────────────────────────────────

const FALSE_POSITIVE_RULES = {
  'CUI Banner': {
    // CUI inside words like circuit, cuisine, biscuit, cuirass
    pattern: /\b\w*cui\w+/i,
    check: (match, surroundingText) => {
      const lower = surroundingText.toLowerCase();
      const pos = lower.indexOf(match.toLowerCase());
      if (pos === -1) return false;
      // Check if CUI is part of a larger word
      const wordMatch = surroundingText.substring(Math.max(0, pos - 10), pos + match.length + 10)
        .match(/\b(\w*CUI\w*)\b/i);
      if (wordMatch) {
        const word = wordMatch[1].toLowerCase();
        return ['circuit', 'circuits', 'circuitry', 'cuisine', 'biscuit', 'biscuits',
          'cuirass', 'cuirasses'].some(fp => word.includes(fp) || fp.includes(word));
      }
      return false;
    },
  },
  'SECRET Classification': {
    pattern: /\b(trade\s+secret|secret\s+sauce|secret\s+ingredient|secret\s+santa|open\s+secret)\b/i,
    check: (match, surroundingText) => {
      const lower = surroundingText.toLowerCase();
      return /\b(trade\s+secret|secret\s+sauce|secret\s+ingredient|secret\s+santa|open\s+secret)\b/i.test(lower);
    },
  },
  'CONFIDENTIAL Classification': {
    pattern: /\bconfidential\s+(business|information|agreement)\b/i,
    check: (match, surroundingText) => {
      const lower = surroundingText.toLowerCase();
      if (/\bconfidential\s+(business|information|agreement)\b/i.test(lower)) {
        // Only a false positive if there's no classification context nearby
        return !/\b(classified|NOFORN|clearance|compartmented|classification\s+level)\b/i.test(lower);
      }
      return false;
    },
  },
  'EAR Reference': {
    pattern: /\bEAR\b/,
    check: (match, surroundingText) => {
      // EAR without export/controlled/commerce context is likely false positive
      return !/\b(export|controlled|commerce|regulation)\b/i.test(surroundingText);
    },
  },
  'Technical Data (Export)': {
    pattern: /\btechnical\s+data\b/i,
    check: (match, surroundingText) => {
      return !/\b(ITAR|export|munitions|defense|controlled)\b/i.test(surroundingText);
    },
  },
};

// Additional generic false positive words that contain pattern triggers
const CONTROLLED_FALSE_POSITIVES = /\b(controlled\s+environment|quality\s+controlled|controlled\s+substance|controlled\s+experiment|temperature\s+controlled)\b/i;

/**
 * Get surrounding text context (±200 chars around match position)
 */
function getSurroundingContext(text, matchIndex, matchLength) {
  const start = Math.max(0, matchIndex - 200);
  const end = Math.min(text.length, matchIndex + matchLength + 200);
  return text.substring(start, end);
}

/**
 * Get the line number of a match in the text
 */
function getLineNumber(text, matchIndex) {
  return text.substring(0, matchIndex).split('\n').length;
}

/**
 * Check if a match is likely a false positive
 */
function isLikelyFalsePositive(match, surroundingText, patternName) {
  // Check specific false positive rules
  const rule = FALSE_POSITIVE_RULES[patternName];
  if (rule && rule.check(match, surroundingText)) {
    return true;
  }

  // Check generic "controlled" false positives for any pattern involving CONTROLLED
  if (patternName.includes('Controlled') && CONTROLLED_FALSE_POSITIVES.test(surroundingText)) {
    return true;
  }

  return false;
}

/**
 * Run a set of patterns against text
 * @param {string} text - Text to scan
 * @param {Array} patterns - Pattern definitions
 * @param {string} category - Category letter (A-E)
 * @param {string} verdict - BLOCK or WARN
 * @returns {Array} findings
 */
function runPatterns(text, patterns, category, verdict) {
  const findings = [];

  for (const { name, pattern, context } of patterns) {
    // Use a fresh regex for global matching
    const globalPattern = new RegExp(pattern.source, pattern.flags + (pattern.flags.includes('g') ? '' : 'g'));
    let match;

    while ((match = globalPattern.exec(text)) !== null) {
      const surroundingText = getSurroundingContext(text, match.index, match[0].length);

      // Check for false positives
      if (isLikelyFalsePositive(match[0], surroundingText, name)) {
        continue;
      }

      // Check context requirement if specified
      if (context && !context.test(surroundingText)) {
        continue;
      }

      findings.push({
        pattern: name,
        category,
        match: match[0].substring(0, 50), // Truncate long matches
        line: getLineNumber(text, match.index),
        verdict,
      });

      // Only report first match per pattern per category
      break;
    }
  }

  return findings;
}

/**
 * Scan metadata fields for CUI indicators
 */
function scanMetadata(metadata) {
  const findings = [];
  const blockTerms = /\b(CUI|FOUO|ITAR|SECRET|CLASSIFIED|CONTROLLED\s+UNCLASSIFIED)\b/i;

  for (const [field, value] of Object.entries(metadata)) {
    if (!value || typeof value !== 'string') continue;

    if (blockTerms.test(value)) {
      const match = value.match(blockTerms);
      findings.push({
        pattern: `Metadata: ${field}`,
        category: 'E',
        match: match[0],
        line: 0,
        verdict: 'BLOCK',
      });
    }
  }

  return findings;
}

/**
 * Scan filename for CUI indicators
 */
function scanFilename(filename) {
  if (!filename) return [];

  const findings = [];
  // Use word boundary OR underscore/hyphen boundaries for filenames
  const blockTerms = /(?:^|[\b_\-\s.])(CUI|FOUO|ITAR|SECRET|CLASSIFIED|CONTROLLED)(?:[\b_\-\s.]|$)/i;

  if (blockTerms.test(filename)) {
    const match = filename.match(blockTerms);
    findings.push({
      pattern: 'Filename Contains CUI Indicator',
      category: 'E',
      match: match[0],
      line: 0,
      verdict: 'BLOCK',
    });
  }

  return findings;
}

/**
 * Main scanning function
 *
 * @param {string} text - Extracted text to scan
 * @param {Object} metadata - Document metadata (title, author, subject, keywords)
 * @param {string} filename - Original filename
 * @returns {{ verdict: 'BLOCK'|'WARN'|'PASS', findings: Array }}
 */
export function scanForCUI(text, metadata = {}, filename = '') {
  const allFindings = [];

  // Scan filename
  allFindings.push(...scanFilename(filename));

  // Scan metadata (high confidence — BLOCK)
  allFindings.push(...scanMetadata(metadata));

  // Scan text through each category
  if (text) {
    allFindings.push(...runPatterns(text, CATEGORY_A, 'A', 'BLOCK'));
    allFindings.push(...runPatterns(text, CATEGORY_B, 'B', 'BLOCK'));
    allFindings.push(...runPatterns(text, CATEGORY_C, 'C', 'BLOCK'));
    allFindings.push(...runPatterns(text, CATEGORY_D, 'D', 'WARN'));
    allFindings.push(...runPatterns(text, CATEGORY_E, 'E', 'WARN'));
  }

  // Determine overall verdict
  const hasBlock = allFindings.some(f => f.verdict === 'BLOCK');
  const hasWarn = allFindings.some(f => f.verdict === 'WARN');

  let verdict = 'PASS';
  if (hasBlock) verdict = 'BLOCK';
  else if (hasWarn) verdict = 'WARN';

  return { verdict, findings: allFindings };
}

/**
 * Client-compatible subset: Categories A + B only (for paste guard)
 */
export function scanForCUIClientPatterns(text) {
  const findings = [];
  if (text) {
    findings.push(...runPatterns(text, CATEGORY_A, 'A', 'BLOCK'));
    findings.push(...runPatterns(text, CATEGORY_B, 'B', 'BLOCK'));
  }
  const hasBlock = findings.some(f => f.verdict === 'BLOCK');
  return { verdict: hasBlock ? 'BLOCK' : 'PASS', findings };
}
