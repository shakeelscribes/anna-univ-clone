'use strict';

const { verifySolution, issueChallenge } = require('./pow');

/**
 * Verifies all captcha signals for an incoming queue-token request.
 *
 * Checks run in order (first failure short-circuits):
 *   1. Honeypot field — hard reject if filled
 *   2. Timing check  — hard reject if elapsed < 800ms
 *   3. PoW solution  — hard reject if invalid
 *   4. Movement entropy — soft signal only (contributes `suspicious` flag)
 *
 * @param {object} req - Express-style request object
 * @param {object} req.body - Parsed request body
 * @param {string}  req.body.website     - Honeypot field (should be empty)
 * @param {number}  req.body.elapsed     - ms since page render (client-measured)
 * @param {string}  req.body.challenge   - PoW challenge string
 * @param {number}  req.body.issuedAt    - Unix ms timestamp of challenge
 * @param {string}  req.body.signature   - HMAC signature of challenge
 * @param {number}  req.body.nonce       - Client-found PoW nonce
 * @param {number}  req.body.difficultyBits - Difficulty used when solving
 * @param {number}  req.body.movements   - Count of mousemove/touchmove events
 * @param {object}  [req.headers]        - For User-Agent inspection
 * @returns {{ pass: boolean, reason?: string, suspicious?: boolean }}
 */
function verifyRequest(req) {
  const {
    website,
    elapsed,
    challenge,
    issuedAt,
    signature,
    nonce,
    difficultyBits,
    movements,
  } = req.body || {};

  // 1. Honeypot — hard reject when field contains non-empty text after trim
  if (website && String(website).trim() !== '') {
    return { pass: false, reason: 'honeypot' };
  }

  // 2. Timing — hard reject if implausibly fast
  if (Number(elapsed) < 800) {
    return { pass: false, reason: 'too_fast' };
  }

  // 3. Proof-of-work — hard reject if invalid
  if (!verifySolution({ challenge, issuedAt, signature, nonce, difficultyBits })) {
    return { pass: false, reason: 'pow_failed' };
  }

  // 4. Mouse/touch entropy — soft signal only
  const userAgent = (req.headers && req.headers['user-agent']) || '';
  const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(userAgent);
  const suspicious = !isMobile && Number(movements) === 0;

  return { pass: true, suspicious };
}

/**
 * Handles a failed or suspicious captcha verification silently.
 *
 * Default strategy: 'elevated' — re-issues a harder PoW challenge.
 * The response is structurally identical to /api/captcha/challenge so
 * the client cannot distinguish a penalty from a legitimate retry.
 *
 * Available strategies:
 *   - 'elevated' (default): return a new challenge with difficultyBits + 2
 *   - 'delay':    wait 2–5 seconds then resolve (caller must await)
 *   - 'requeue':  return { requeued: true } — caller places request at back of queue
 *
 * @param {object} req       - Express-style request object (used for context/logging)
 * @param {string} [strategy='elevated'] - Which silent strategy to apply
 * @returns {Promise<object>} - Response payload to send back to the client
 */
async function rejectSilently(req, strategy = 'elevated') {
  switch (strategy) {
    case 'elevated': {
      // Re-issue a new challenge at increased difficulty
      const originalBits = Number((req.body && req.body.difficultyBits) || process.env.CAPTCHA_DIFFICULTY_BITS || 18);
      const elevatedBits = originalBits + 2; // 4× harder
      const newChallenge = issueChallenge();
      return { ...newChallenge, difficultyBits: elevatedBits };
    }

    case 'delay': {
      // Hold the connection for 2–5 seconds; return a fresh challenge
      const delayMs = 2000 + Math.floor(Math.random() * 3000);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return issueChallenge();
    }

    case 'requeue': {
      // Signal to the caller that this request should be placed at back of queue
      return { requeued: true };
    }

    default:
      throw new Error(`Unknown silent-failure strategy: "${strategy}"`);
  }
}

module.exports = { verifyRequest, rejectSilently };
