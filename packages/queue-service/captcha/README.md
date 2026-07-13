# captcha/ — PoW + Behavioral Verification Module

Zero-cost, proof-of-work + behavioral captcha for the Anna University result portal queue system.

---

## Files

| File | Purpose |
|---|---|
| `pow.js` | Server: issue and verify PoW challenges |
| `verify.js` | Server: orchestrate all checks; silent failure handling |
| `../public/captcha-client.js` | Browser: PoW solver + behavioral signal collection |
| `../routes/queue.js` | Express: `/api/captcha/challenge` and `/api/queue/join` endpoints |

---

## Environment Variables

| Variable | Required | Default | Description |
|---|---|---|---|
| `CAPTCHA_SECRET` | **Yes** | — | HMAC signing key. Generate with `openssl rand -hex 32`. Rotating this invalidates in-flight challenges (~2 min window). |
| `CAPTCHA_DIFFICULTY_BITS` | No | `18` | Leading zero bits required in SHA-256(challenge+nonce). See tuning guide below. |

---

## Difficulty Tuning Guide

### What each bit costs

| `CAPTCHA_DIFFICULTY_BITS` | Avg solve time (mid-range CPU) | Script cost per request |
|---|---|---|
| 16 | ~50–100ms | 65,536 hashes |
| 18 | ~200–500ms | 262,144 hashes |
| 20 | ~800ms–2s | 1,048,576 hashes |
| 22 | ~3–8s | 4,194,304 hashes |

Each extra bit **doubles** average solve time. A human notices >1s. Scripts pay this cost on every request.

### When to raise difficulty

- **Normal days**: 18 bits — invisible to students, ~4× harder per extra bit if scripts appear.
- **Result day (high traffic)**: Raise to 20 before the results go live. Monitor server logs.
- **Active attack**: Raise to 22 to make bulk hammering prohibitively expensive.
- **Rollback**: Lower if legitimate users on slow devices start experiencing >1s delays.

### How to change without a redeploy

`CAPTCHA_DIFFICULTY_BITS` is read at challenge-issue time, so updating the environment variable
and restarting (or using hot-reload) takes effect immediately for new challenges.
In-flight challenges retain the difficulty they were issued with.

### How to calibrate on a low-end device

1. Open the queue page on the target device (e.g. old Android phone, budget laptop).
2. Open DevTools → Console.
3. Run: `window.__captcha._state()` after the page loads — note `solvedNonce`.
4. Or time it: `const t = Date.now(); await window.__captcha.getPayload(); console.log(Date.now() - t, 'ms')`.
5. If solve time > 800ms on the target device, lower `CAPTCHA_DIFFICULTY_BITS` by 1–2 bits.

---

## Silent Failure Strategies

When verification fails or a request is flagged as suspicious, `rejectSilently(req, strategy)` is called.

| Strategy | Behaviour | When to use |
|---|---|---|
| `'elevated'` **(default)** | Returns a new challenge at `difficultyBits + 2`. Structurally identical to a normal challenge — undetectable. | Default for all failures |
| `'delay'` | Holds the connection 2–5s before responding. | Alternative if elevated PoW is not suitable |
| `'requeue'` | Returns `{ requeued: true }` — caller places request at back of queue. | Alternative if you want queue-position penalty |

---

## Architecture Notes

- **Stateless**: No Redis or DB required. Challenge validity is proven by HMAC signature + expiry check.
- **HTTPS required**: `crypto.subtle` (used by the browser solver) only works in secure contexts.
- **Scope**: PoW check is on the **queue-token issuance endpoint only** — not the result fetch endpoint (which is downstream and protected by the queue token itself).
- **No third-party dependencies**: Pure Node.js `crypto` module on the server; Web Crypto API in the browser.

---

## Testing

```bash
# Unit tests (Node built-in assert, no framework needed)
node tests/pow.test.js
node tests/verify.test.js

# Load testing (requires k6 or Locust)
# See Section 8 of the build instructions for full test scenarios
```
