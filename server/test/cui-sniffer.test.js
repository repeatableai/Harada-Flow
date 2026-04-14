/**
 * CUI Sniffer Test Runner
 *
 * Tests the scanForCUI() function against fixture files.
 * Run: node test/cui-sniffer.test.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { scanForCUI } from '../src/lib/cuiPatterns.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

// Test definitions
const tests = [
  {
    file: 'cui-marked.txt',
    expectedVerdict: 'BLOCK',
    description: 'CUI//SP-CTI banner marking',
  },
  {
    file: 'itar-reference.txt',
    expectedVerdict: 'BLOCK',
    description: 'ITAR 22 CFR reference with technical data',
  },
  {
    file: 'classification-header.txt',
    expectedVerdict: 'BLOCK',
    description: 'TOP SECRET//SCI classification',
  },
  {
    file: 'legacy-fouo.txt',
    expectedVerdict: 'BLOCK',
    description: 'FOR OFFICIAL USE ONLY marking',
  },
  {
    file: 'dfars-reference.txt',
    expectedVerdict: 'WARN',
    description: 'DFARS 252.204-7012 contract clause',
  },
  {
    file: 'clean-job-description.txt',
    expectedVerdict: 'PASS',
    description: 'Clean job description, no controlled markings',
  },
  {
    file: 'false-positive-circuit.txt',
    expectedVerdict: 'PASS',
    description: 'False positives: circuit, trade secret, controlled environment, secret sauce',
  },
  {
    file: 'metadata-cui.pdf',
    expectedVerdict: 'BLOCK',
    description: 'PDF with CUI in document title metadata',
    isMetadataTest: true,
  },
];

// Additional pure pattern tests (no files)
const patternTests = [
  {
    text: 'CUI//PRIVACY - This contains personal information',
    expectedVerdict: 'BLOCK',
    description: 'CUI category marking (PRIVACY)',
  },
  {
    text: 'Distribution Statement B: Distribution authorized to U.S. Government agencies only',
    expectedVerdict: 'BLOCK',
    description: 'DoD Distribution Statement B',
  },
  {
    text: 'ECCN 3A001 applies to this component',
    expectedVerdict: 'BLOCK',
    description: 'ECCN export control number',
  },
  {
    text: 'Ensure compliance with NIST SP 800-171 requirements',
    expectedVerdict: 'WARN',
    description: 'NIST 800-171 reference',
  },
  {
    text: 'CMMC Level 2 certification is required for this contract',
    expectedVerdict: 'WARN',
    description: 'CMMC Level 2 reference',
  },
  {
    text: 'The secret to good management is communication',
    expectedVerdict: 'PASS',
    description: 'False positive: "secret" without classification context',
  },
  {
    text: 'This is confidential business information protected under NDA',
    expectedVerdict: 'PASS',
    description: 'False positive: "confidential" in business context',
  },
  {
    text: 'The controlled environment maintained a steady temperature of 72°F',
    expectedVerdict: 'PASS',
    description: 'False positive: "controlled environment"',
  },
];

// Filename tests
const filenameTests = [
  {
    filename: 'CUI_document_draft.docx',
    expectedVerdict: 'BLOCK',
    description: 'Filename contains CUI',
  },
  {
    filename: 'FOUO_report_2024.pdf',
    expectedVerdict: 'BLOCK',
    description: 'Filename contains FOUO',
  },
  {
    filename: 'quarterly_report.pdf',
    expectedVerdict: 'PASS',
    description: 'Clean filename',
  },
];

// Run tests
let passed = 0;
let failed = 0;
const failures = [];

console.log('\n=== CUI Sniffer Test Suite ===\n');

// File-based tests
console.log('--- File Fixture Tests ---\n');
for (const test of tests) {
  const filePath = path.join(FIXTURES_DIR, test.file);
  const text = fs.readFileSync(filePath, 'utf-8');

  let result;
  if (test.isMetadataTest) {
    // For metadata test, simulate PDF metadata extraction
    // (actual PDF parsing would require pdf-parse which is async)
    const metadata = { title: 'CUI Document - Restricted', subject: 'CUI Test' };
    result = scanForCUI(text, metadata, test.file);
  } else {
    result = scanForCUI(text, {}, test.file);
  }

  if (result.verdict === test.expectedVerdict) {
    console.log(`  PASS  ${test.file} — ${test.description}`);
    if (result.findings.length > 0) {
      console.log(`        Findings: ${result.findings.map(f => f.pattern).join(', ')}`);
    }
    passed++;
  } else {
    console.log(`  FAIL  ${test.file} — ${test.description}`);
    console.log(`        Expected: ${test.expectedVerdict}, Got: ${result.verdict}`);
    if (result.findings.length > 0) {
      console.log(`        Findings: ${result.findings.map(f => `${f.pattern} (${f.category})`).join(', ')}`);
    }
    failed++;
    failures.push(test.file);
  }
}

// Pure pattern tests
console.log('\n--- Pattern Tests ---\n');
for (const test of patternTests) {
  const result = scanForCUI(test.text);

  if (result.verdict === test.expectedVerdict) {
    console.log(`  PASS  ${test.description}`);
    passed++;
  } else {
    console.log(`  FAIL  ${test.description}`);
    console.log(`        Expected: ${test.expectedVerdict}, Got: ${result.verdict}`);
    if (result.findings.length > 0) {
      console.log(`        Findings: ${result.findings.map(f => `${f.pattern} (${f.match})`).join(', ')}`);
    }
    failed++;
    failures.push(test.description);
  }
}

// Filename tests
console.log('\n--- Filename Tests ---\n');
for (const test of filenameTests) {
  const result = scanForCUI('', {}, test.filename);

  if (result.verdict === test.expectedVerdict) {
    console.log(`  PASS  ${test.description}`);
    passed++;
  } else {
    console.log(`  FAIL  ${test.description}`);
    console.log(`        Expected: ${test.expectedVerdict}, Got: ${result.verdict}`);
    failed++;
    failures.push(test.description);
  }
}

// Summary
console.log('\n=== Results ===');
console.log(`  Total: ${passed + failed}`);
console.log(`  Passed: ${passed}`);
console.log(`  Failed: ${failed}`);

if (failures.length > 0) {
  console.log(`\n  Failed tests:`);
  failures.forEach(f => console.log(`    - ${f}`));
}

console.log('');
process.exit(failed > 0 ? 1 : 0);
