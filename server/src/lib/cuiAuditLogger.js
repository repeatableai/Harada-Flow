/**
 * CUI Audit Logger
 *
 * Immutable audit logging for every CUI scan event.
 * NEVER stores file content, extracted text, or matched text.
 * Only stores: pattern name, category, and line number.
 *
 * Retention: 3 years minimum (CMMC evidence requirement).
 */

import prisma from '../db.js';

/**
 * Log a CUI scan event
 *
 * @param {string|null} organizationId - Tenant org ID
 * @param {string} userId - Scanning user ID
 * @param {Object} eventData - Scan event details
 * @param {string} eventData.scan_id - UUID for this scan
 * @param {string} eventData.filename - Original filename
 * @param {string} eventData.file_type - MIME type
 * @param {number} eventData.file_size_bytes - File size
 * @param {string} eventData.verdict - BLOCK, WARN, or PASS
 * @param {number} eventData.findings_count - Number of findings
 * @param {Array} eventData.findings_summary - [{pattern_name, category}] only
 * @param {string} eventData.ip_address - Request IP
 */
export async function logScanEvent(organizationId, userId, eventData) {
  try {
    await prisma.cuiScanLog.create({
      data: {
        scanId: eventData.scan_id,
        organizationId: organizationId || null,
        userId,
        filename: eventData.filename || null,
        fileType: eventData.file_type || null,
        fileSizeBytes: eventData.file_size_bytes || null,
        verdict: eventData.verdict,
        findingsCount: eventData.findings_count || 0,
        findingsSummary: eventData.findings_summary || [],
        ipAddress: eventData.ip_address || null,
      },
    });
  } catch (err) {
    // Audit logging should never crash the request
    console.error('CUI audit log write failed:', err.message);
  }
}

/**
 * Record user confirmation of a WARN verdict
 *
 * @param {string} scanId - The scan_id from the WARN response
 * @param {string} userId - The confirming user
 * @returns {Object|null} Updated record or null if not found
 */
export async function confirmScan(scanId, userId) {
  const existing = await prisma.cuiScanLog.findUnique({
    where: { scanId },
  });

  if (!existing || existing.verdict !== 'WARN') {
    return null;
  }

  return prisma.cuiScanLog.update({
    where: { scanId },
    data: {
      userConfirmed: true,
      confirmedAt: new Date(),
    },
  });
}

/**
 * Get paginated audit log for an organization
 *
 * @param {Object} options - Query options
 * @param {string} options.organizationId - Tenant org ID
 * @param {string} options.verdict - Filter by verdict
 * @param {number} options.page - Page number (1-based)
 * @param {number} options.limit - Items per page
 * @returns {{ data: Array, total: number, page: number, totalPages: number }}
 */
export async function getAuditLog({ organizationId, verdict, page = 1, limit = 25 }) {
  const where = {};
  if (organizationId) where.organizationId = organizationId;
  if (verdict) where.verdict = verdict;

  const [data, total] = await Promise.all([
    prisma.cuiScanLog.findMany({
      where,
      orderBy: { scannedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.cuiScanLog.count({ where }),
  ]);

  return {
    data,
    total,
    page,
    totalPages: Math.ceil(total / limit),
  };
}

/**
 * Get summary stats for an organization
 *
 * @param {string|null} organizationId - Tenant org ID (null for super admin)
 * @returns {Object} Summary statistics
 */
export async function getStats(organizationId) {
  const where = organizationId ? { organizationId } : {};

  const [total, blocks, warnings, passes, confirmed] = await Promise.all([
    prisma.cuiScanLog.count({ where }),
    prisma.cuiScanLog.count({ where: { ...where, verdict: 'BLOCK' } }),
    prisma.cuiScanLog.count({ where: { ...where, verdict: 'WARN' } }),
    prisma.cuiScanLog.count({ where: { ...where, verdict: 'PASS' } }),
    prisma.cuiScanLog.count({ where: { ...where, verdict: 'WARN', userConfirmed: true } }),
  ]);

  return {
    totalScans: total,
    blocks,
    warnings,
    passes,
    confirmations: confirmed,
    confirmationRate: warnings > 0 ? (confirmed / warnings * 100).toFixed(1) + '%' : 'N/A',
  };
}
