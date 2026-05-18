/**
 * Webhook Service
 *
 * Dispatches outbound webhook events, handles retries, and logs all activity.
 * All dispatch calls are async/non-blocking — they don't delay user flows.
 */

import prisma from '../db.js';
import crypto from 'crypto';

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 5000, 30000]; // 1s, 5s, 30s

/**
 * Generate a secure API key for a new webhook endpoint.
 */
export function generateApiKey() {
  return `whk_${crypto.randomBytes(32).toString('hex')}`;
}

/**
 * Dispatch a webhook event to all matching outbound endpoints.
 * Non-blocking — fires and forgets. Errors are logged, not thrown.
 *
 * @param {string} event - Event name, e.g. 'prompt.saved'
 * @param {object} data - Event payload data
 * @param {string} userId - Owner user ID (matches endpoints)
 * @param {string|null} organizationId - Optional org scope
 */
export async function dispatchWebhookEvent(event, data, userId, organizationId = null) {
  // Fire async — don't await in calling code
  _dispatch(event, data, userId, organizationId).catch(err => {
    console.error(`[Webhook] Dispatch error for event "${event}":`, err.message);
  });
}

async function _dispatch(event, data, userId, organizationId) {
  // Find all active outbound endpoints for this user that subscribe to this event
  const whereClause = {
    isActive: true,
    direction: 'outbound',
    events: { has: event },
    OR: [
      { userId },
      ...(organizationId ? [{ organizationId }] : []),
    ],
  };

  const endpoints = await prisma.webhookEndpoint.findMany({ where: whereClause });

  if (endpoints.length === 0) return;

  // Dispatch to all matching endpoints concurrently
  await Promise.allSettled(
    endpoints.map(endpoint => deliverToEndpoint(endpoint, event, data))
  );
}

/**
 * Deliver a single event to a single endpoint with retry logic.
 */
async function deliverToEndpoint(endpoint, event, data) {
  const deliveryId = crypto.randomUUID();
  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data,
    webhook: {
      endpointId: endpoint.id,
      deliveryId,
    },
  };

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000); // 30s timeout

      const response = await fetch(endpoint.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Delivery': deliveryId,
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const responseText = await response.text().catch(() => '');

      // Log the delivery
      await prisma.webhookLog.create({
        data: {
          endpointId: endpoint.id,
          event,
          direction: 'outbound',
          payload,
          statusCode: response.status,
          response: responseText.substring(0, 2000), // Truncate
          success: response.ok,
        },
      });

      if (response.ok) return; // Success — done

      // Non-retryable status codes
      if (response.status >= 400 && response.status < 500 && response.status !== 429) {
        console.error(`[Webhook] ${endpoint.name}: ${event} failed with ${response.status}, not retrying`);
        return;
      }

      // Retryable — fall through to retry delay
    } catch (err) {
      // Network error or timeout — log and retry
      if (attempt === MAX_RETRIES) {
        await prisma.webhookLog.create({
          data: {
            endpointId: endpoint.id,
            event,
            direction: 'outbound',
            payload,
            statusCode: null,
            response: err.message?.substring(0, 2000) || 'Unknown error',
            success: false,
          },
        });
        console.error(`[Webhook] ${endpoint.name}: ${event} failed after ${MAX_RETRIES} retries:`, err.message);
        return;
      }
    }

    // Wait before retry
    if (attempt < MAX_RETRIES) {
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAYS[attempt]));
    }
  }
}

/**
 * Log an inbound webhook event.
 */
export async function logInboundEvent(endpointId, event, payload, statusCode, success) {
  await prisma.webhookLog.create({
    data: {
      endpointId,
      event,
      direction: 'inbound',
      payload,
      statusCode,
      success,
    },
  });
}

/**
 * Send a test event to a specific endpoint.
 */
export async function sendTestEvent(endpointId) {
  const endpoint = await prisma.webhookEndpoint.findUnique({
    where: { id: endpointId },
  });

  if (!endpoint) throw new Error('Endpoint not found');
  if (!endpoint.url) throw new Error('Endpoint has no URL configured');

  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    data: {
      message: 'This is a test webhook event from DCE.',
      endpointName: endpoint.name,
    },
    webhook: {
      endpointId: endpoint.id,
      deliveryId: crypto.randomUUID(),
    },
  };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Event': 'test',
      },
      body: JSON.stringify(testPayload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseText = await response.text().catch(() => '');

    await prisma.webhookLog.create({
      data: {
        endpointId: endpoint.id,
        event: 'test',
        direction: 'outbound',
        payload: testPayload,
        statusCode: response.status,
        response: responseText.substring(0, 2000),
        success: response.ok,
      },
    });

    return { success: response.ok, statusCode: response.status, response: responseText.substring(0, 500) };
  } catch (err) {
    clearTimeout(timeout);

    await prisma.webhookLog.create({
      data: {
        endpointId: endpoint.id,
        event: 'test',
        direction: 'outbound',
        payload: testPayload,
        statusCode: null,
        response: err.message,
        success: false,
      },
    });

    return { success: false, statusCode: null, response: err.message };
  }
}
