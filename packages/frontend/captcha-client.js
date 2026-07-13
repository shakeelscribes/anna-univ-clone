/**
 * captcha-client.js
 *
 * Proof-of-work solver + behavioral signal collector for the queue page.
 *
 * Runs automatically on DOMContentLoaded:
 *   1. Records page render time (for timing check).
 *   2. Attaches passive mousemove/touchmove listeners (for movement entropy).
 *   3. Fetches a PoW challenge from /api/captcha/challenge.
 *   4. Solves the PoW in the background (yields every 500 iterations so UI stays responsive).
 *   5. Silently re-fetches and re-solves a fresh challenge every 90 seconds so the
 *      challenge never expires before the student clicks "Join Queue".
 *   6. On queue-join form submit, injects all captcha fields into the payload.
 *
 * No external dependencies. Requires HTTPS (crypto.subtle is not available on http:).
 */

(function () {
  'use strict';

  // ─── State ────────────────────────────────────────────────────────────────

  const API_BASE_URL = 'https://anna-univ-clone.duckdns.org';

  /** Resolved PoW nonce (null until solved) */
  let solvedNonce = null;

  /** Promise that resolves to the nonce when solving is done */
  let solvePromise = null;

  /** Challenge payload received from the server */
  let challengeData = null;

  /** Timestamp when the page/form was rendered */
  const formRenderedAt = Date.now();

  /** Count of mousemove and touchmove events */
  let movements = 0;

  // ─── Movement entropy ─────────────────────────────────────────────────────

  document.addEventListener('mousemove', function () { movements++; }, { passive: true });
  document.addEventListener('touchmove', function () { movements++; }, { passive: true });

  // ─── Leading-zero bit counter ─────────────────────────────────────────────

  /**
   * Counts leading zero bits in a hex-encoded SHA-256 hash string.
   * @param {string} hex - 64-character lowercase hex string
   * @returns {number}
   */
  function countLeadingZeroBits(hex) {
    var bits = 0;
    for (var i = 0; i < hex.length; i++) {
      var nibble = parseInt(hex[i], 16);
      if (nibble === 0) {
        bits += 4;
        continue;
      }
      // Count leading zeros in this 4-bit nibble using Math.clz32
      bits += Math.clz32(nibble) - 28;
      break;
    }
    return bits;
  }

  // ─── PoW solver ───────────────────────────────────────────────────────────

  /**
   * Brute-force SHA-256 nonce search using the Web Crypto API.
   * Yields to the event loop every 500 iterations so the UI stays responsive.
   *
   * @param {string} challenge
   * @param {number} difficultyBits
   * @returns {Promise<number>} - The valid nonce
   */
  async function solveChallenge(challenge, difficultyBits) {
    var encoder = new TextEncoder();
    var nonce = 0;

    while (true) {
      var data = challenge + nonce;
      var hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(data));
      var hashArray = Array.from(new Uint8Array(hashBuffer));
      var hashHex = hashArray.map(function (b) {
        return b.toString(16).padStart(2, '0');
      }).join('');

      if (countLeadingZeroBits(hashHex) >= difficultyBits) {
        return nonce;
      }

      nonce++;

      // Yield to browser every 500 iterations to prevent UI blocking
      if (nonce % 500 === 0) {
        await new Promise(function (r) { setTimeout(r, 0); });
      }
    }
  }

  // ─── Challenge fetch + solve ───────────────────────────────────────────────

  async function initCaptcha() {
    try {
      var resp = await fetch(API_BASE_URL + '/api/captcha/challenge');
      if (!resp.ok) throw new Error('Challenge fetch failed: ' + resp.status);
      challengeData = await resp.json();

      // Start solving in the background; store the promise so submit can await it
      solvePromise = solveChallenge(challengeData.challenge, challengeData.difficultyBits)
        .then(function (nonce) {
          solvedNonce = nonce;
          return nonce;
        });
    } catch (err) {
      console.warn('[captcha] Failed to initialise PoW:', err.message);
    }
  }

  // ─── Silent challenge auto-refresh (task 9.1 + 9.2 + 9.3) ─────────────────

  /**
   * Silently fetches a new challenge and re-solves the PoW in the background.
   * State is swapped atomically only AFTER the new nonce is ready, so there
   * is no window where getPayload() could read a challenge without a matching nonce.
   *
   * Completely silent: no console output, no UI change, no interruption to any
   * in-progress getPayload() call (which still awaits the old solvePromise).
   */
  async function refreshChallenge() {
    try {
      var resp = await fetch(API_BASE_URL + '/api/captcha/challenge');
      if (!resp.ok) return; // silent — don't warn, don't disrupt

      var newChallenge = await resp.json();

      // Solve the new nonce fully before swapping state
      var newNonce = await solveChallenge(newChallenge.challenge, newChallenge.difficultyBits);

      // Atomic swap — both fields update together so getPayload() always sees a consistent pair
      challengeData = newChallenge;
      solvedNonce = newNonce;
      solvePromise = Promise.resolve(newNonce);
    } catch (_) {
      // Silent — a failed refresh just means the old challenge stays active.
      // If it's already expired the server will return an elevated challenge,
      // and the next 90s tick will try again.
    }
  }

  // ─── Form submit hook ─────────────────────────────────────────────────────

  /**
   * Injects captcha fields into the form's submit payload.
   * Awaits the solver if it hasn't finished yet.
   *
   * Call this from the queue-join form's submit handler:
   *
   *   form.addEventListener('submit', async (e) => {
   *     e.preventDefault();
   *     const captchaFields = await window.__captcha.getPayload();
   *     // merge captchaFields into your fetch/XHR body
   *   });
   */
  async function getPayload() {
    if (!challengeData) {
      console.warn('[captcha] No challenge data — PoW fields will be missing');
      return {};
    }

    // Await solver if still running
    var nonce = solvedNonce !== null ? solvedNonce : await solvePromise;

    return {
      challenge: challengeData.challenge,
      issuedAt: challengeData.issuedAt,
      signature: challengeData.signature,
      difficultyBits: challengeData.difficultyBits,
      nonce: nonce,
      elapsed: Date.now() - formRenderedAt,
      movements: movements,
      // Honeypot field value — will be empty string for real users
      website: (document.querySelector('input[name="website"]') || {}).value || '',
    };
  }

  // ─── Auto-init ────────────────────────────────────────────────────────────

  document.addEventListener('DOMContentLoaded', function () {
    initCaptcha();
    // Auto-refresh every 90s — keeps challenge fresh inside the 2-minute expiry window
    setInterval(refreshChallenge, 90000);
  });

  // ─── Public API ───────────────────────────────────────────────────────────

  window.__captcha = {
    getPayload: getPayload,
    /** Exposed for testing/debugging only */
    _state: function () {
      return { solvedNonce: solvedNonce, movements: movements, formRenderedAt: formRenderedAt };
    },
    /**
     * Re-initialise with an externally provided challenge (e.g. elevated challenge
     * returned by the server after a failed submission). Used by queue.html.
     * @param {{ challenge: string, issuedAt: number, signature: string, difficultyBits: number }} data
     */
    _reinit: function (data) {
      challengeData = data;
      solvedNonce = null;
      solvePromise = solveChallenge(data.challenge, data.difficultyBits)
        .then(function (nonce) { solvedNonce = nonce; return nonce; });
    },
  };
})();
