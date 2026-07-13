'use strict';

const crypto = require('crypto');

/**
 * Issues a new proof-of-work challenge.
 *
 * Returns a signed object that the client must present back alongside
 * a valid nonce. The signature prevents clients from forging a cheaper
 * challenge or replaying an expired one.
 *
 * @returns {{ challenge: string, issuedAt: number, signature: string, difficultyBits: number }}
 */
function issueChallenge() {
  const secret = process.env.CAPTCHA_SECRET;
  if (!secret) throw new Error('CAPTCHA_SECRET env variable is not set');

  const challenge = crypto.randomBytes(16).toString('hex');
  const issuedAt = Date.now();
  const difficultyBits = parseInt(process.env.CAPTCHA_DIFFICULTY_BITS || '18', 10);

  const signature = crypto
    .createHmac('sha256', secret)
    .update(challenge + issuedAt)
    .digest('hex');

  return { challenge, issuedAt, signature, difficultyBits };
}

/**
 * Verifies a proof-of-work solution submitted by the client.
 *
 * Checks (in order):
 *   1. Challenge is not older than 2 minutes.
 *   2. HMAC signature matches — challenge has not been tampered with.
 *   3. SHA-256(challenge + nonce) has >= difficultyBits leading zero bits.
 *
 * @param {{ challenge: string, issuedAt: number, signature: string, nonce: number|string, difficultyBits?: number }} params
 * @returns {boolean}
 */
function verifySolution({ challenge, issuedAt, signature, nonce, difficultyBits = 18 }) {
  const secret = process.env.CAPTCHA_SECRET;
  if (!secret) throw new Error('CAPTCHA_SECRET env variable is not set');

  // 0. Ensure all required fields exist (handles cases where JS is disabled)
  if (!challenge || !issuedAt || !signature || nonce === undefined) {
    return false;
  }

  // 1. Reject expired challenges (older than 2 minutes)
  if (Date.now() - Number(issuedAt) > 2 * 60 * 1000) return false;

  // 2. Reject forged or tampered challenges
  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(challenge + issuedAt)
    .digest('hex');
  if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(signature, 'hex'))) {
    return false;
  }

  // 3. Verify the actual proof of work
  const hash = crypto
    .createHash('sha256')
    .update(challenge + nonce)
    .digest('hex');

  return countLeadingZeroBits(hash) >= Number(difficultyBits);
}

/**
 * Counts the number of leading zero bits in a hex-encoded SHA-256 hash.
 * @param {string} hex - 64-character hex string
 * @returns {number}
 */
function countLeadingZeroBits(hex) {
  let bits = 0;
  for (const char of hex) {
    const nibble = parseInt(char, 16);
    if (nibble === 0) {
      bits += 4;
      continue;
    }
    // Count leading zeros in this 4-bit nibble
    bits += Math.clz32(nibble) - 28;
    break;
  }
  return bits;
}

module.exports = { issueChallenge, verifySolution, countLeadingZeroBits };
