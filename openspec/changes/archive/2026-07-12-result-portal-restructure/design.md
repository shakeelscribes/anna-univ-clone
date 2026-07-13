## Context

Anna University publishes semester results to hundreds of thousands of students simultaneously. The existing coe1.annauniv.edu-style portal is a traditional web app hitting a relational database directly — a model that collapses under the extreme read spike of result day. Students experience timeouts, CAPTCHA failures, and misleading "confirm resubmission" errors. There is no student-facing feedback loop, causing panic refresh cycles that worsen the overload.

The core insight driving this design: **results are static once published**. The problem is a large-scale content delivery event, not a live transactional workload. The architecture must be engineered accordingly.

This is a greenfield backend system. No legacy code is being modified — the existing portal is replaced entirely.

## Goals / Non-Goals

**Goals:**
- Serve 1.5 million-scale concurrent result requests without origin overload, using pre-generation + CDN delivery.
- Provide every student an honest, live queue position and wait time instead of a spinner/dead page.
- Eliminate all false failures: CAPTCHA timeouts, resubmission errors, duplicate result generation.
- Be load-tested at realistic concurrency before each result day.
- Expose a REST/WebSocket API so the website client can be built independently.
- Always degrade gracefully — no student ever sees a blank or unresponsive page.

**Non-Goals:**
- Building the client (website) — that is a later, separate decision.
- Replacing the exam cell's internal result finalization system — we consume its output, not replace it.
- Supporting live transactional results (exam results are always final before publication).
- Multi-university support (scope is Anna University / similar single-exam-cell institutions for now).

## Decisions

### Decision 1 — Pre-generation over live query
**Choice**: Render each student's result to a static JSON + PDF before result day; store in object storage + KV lookup index.

**Rationale**: Eliminates all live DB reads during the traffic spike. The result content is immutable once the exam cell finalises it, so pre-generation is semantically correct, not a workaround. Any approach that touches a relational DB during the spike will fail at 1.5 million-scale without heroic (expensive) sharding.

*Note for Development:* For local development and load testing, object storage will be simulated using a local `mock-s3/` directory to avoid cloud costs. The codebase will use the `@aws-sdk/client-s3` library or a standard filesystem adapter, allowing a seamless flip to a real Cloudflare R2 / AWS S3 bucket for production.

**Alternatives considered**:
- Read-replica DB with heavy caching: still requires a DB at origin; cache warm-up timing is a risk.
- On-demand render with aggressive CDN TTLs: first hit per student still hits origin; under 1.5 million-scale, that is still too many origin hits.

### Decision 2 — Redis sorted set for the waiting room queue
**Choice**: Each incoming student is assigned a queue token immediately (at the CDN edge or app server). Position is tracked in a Redis sorted set (score = arrival timestamp). An admission worker releases students at a controlled rate.

**Rationale**: Redis sorted sets provide O(log N) insert and O(1) rank lookup. The token can be issued at the edge (Cloudflare Worker) before the request ever reaches the origin, making queue admission effectively free in terms of origin load.

**Token lifecycle (Form First)**:
1. Student hits portal and immediately sees the result lookup form.
2. Student submits Reg No and DOB. The client browser solves the PoW CAPTCHA in the background.
3. Client POSTs the PoW solution to `/api/queue/join` and receives a `queue_token`. The client retains the Reg No and DOB in memory.
4. Client polls `/queue/status?token=<queue_token>` every 3–5 s → receives `{position, eta_seconds, admitted: bool}`.
5. On admission, a `result_token` (signed, 10 min TTL) is issued.
6. The client automatically uses the `result_token` along with the saved credentials to call `GET /result` → KV lookup → CDN-stored file returned.

**Alternatives considered**:
- First-come-first-served browser queue (client-side only): no server-side enforcement; trivially bypassed.
- SQS/Pub-Sub queue: heavier operational footprint; Redis is sufficient and already used for KV lookup.

### Decision 3 — Proof-of-Work (PoW) CAPTCHA at entry
**Choice**: A custom Proof-of-Work (PoW) cryptographic challenge is solved by the client's browser in the background *before* they are allowed to join the Redis queue.

**Rationale**: By shifting the compute burden to the client (requiring them to hash a challenge until they find a specific prefix), we make it computationally expensive for a botnet to flood the queue. Because it requires no visual interaction, it does not block legitimate users, but it naturally throttles the rate at which any single machine can request queue tokens.

**Alternatives considered**:
- Cloudflare Turnstile / hCaptcha: Relying on third-party services introduces an external point of failure and potential rate limits.
- Traditional visible CAPTCHA: already proven to be a bottleneck and failure point; eliminated.

### Decision 4 — Idempotent result fetch via signed token
**Choice**: `GET /result?token=<result_token>` is a pure read — no server-side state mutation. Refreshing or pressing back is safe.

**Rationale**: The "confirm resubmission" error in the existing portal is caused by POST-based result fetching — the browser warns on refresh because the server re-executes computation. Switching to a signed-token GET eliminates this class of error entirely.

**Token design**: HMAC-signed, contains `{reg_no, exp}`. Server validates signature + expiry, then does a KV lookup for the result file URL. No DB write on fetch.

### Decision 5 — Stateless app servers, horizontally scaled
**Choice**: App servers hold no local state (all state in Redis + object storage). Autoscaling group behind a load balancer, sized by load test results.

**Rationale**: Stateless servers can be scaled horizontally without sticky sessions. Load testing with k6/Locust before result day gives a measured autoscaling baseline rather than a guess.

## Risks / Trade-offs

- **[Risk] Data feed unavailability** → The pre-generation batch job requires an authoritative result feed from the exam cell before result day. If this feed is delayed or unavailable, the entire architecture cannot pre-generate. *Mitigation*: Establish the data feed contract (format, timing, delivery mechanism) as the first external dependency before any build begins. Design the batch job to be re-runnable idempotently.

- **[Risk] Queue token abuse / enumeration** → A malicious user could try to enumerate result tokens for other students. *Mitigation*: Result tokens are HMAC-signed and bound to the student's own registration number; they cannot be crafted for another student without the signing key.

- **[Risk] Redis single point of failure** → Redis is used for both the queue and KV lookup index. If Redis goes down, both queue position tracking and result lookup fail. *Mitigation*: Deploy Redis with replication (Redis Sentinel or Redis Cluster). KV lookup can fall back to DynamoDB as a secondary store.

- **[Risk] CDN cache miss on first access** → If a student's result has not yet been CDN-cached, the first hit reaches origin (object storage). At 1.5 million-scale, even 1% cold misses is thousands of origin hits. *Mitigation*: Warm the CDN proactively as part of the pre-generation batch job (issue a HEAD/GET request for each generated file immediately after upload).

- **[Risk] Admission rate miscalibration** → If the admission worker releases students too fast, origin is overloaded; too slow, and students wait unnecessarily long. *Mitigation*: Load test sets the safe admission rate. Expose admission rate as a runtime-configurable parameter (Redis key), adjustable without a deploy.

- **[Trade-off] Pre-generation storage cost** -> Storing a JSON + PDF per student at 1.5 million scale is non-trivial (e.g., 500 KB per student * 1,500,000 = ~750 GB). *Accepted*: For development, this costs $0 using the local `mock-s3/` directory. For production, object storage at this scale is cheap (especially with Cloudflare R2 for free egress); far cheaper than the cost of portal failure.

## Migration Plan

1. **Phase 0**: Establish mock data generator for 1.5 million students. No code yet.
2. **Phase 1**: Build and test the result pre-generation pipeline in isolation with mock data.
3. **Phase 2**: Build and deploy the result fetch API against the pre-generated data; verify idempotency.
4. **Phase 3**: Build and load-test the waiting room service; tune admission rate against load test results.
5. **Phase 4**: Integrate PoW CAPTCHA validation into the Redis queue admission path.
6. **Phase 5**: Build the client layer (website) against the REST/WebSocket API.
7. **Phase 6**: Full end-to-end load test at 1.5 million-scale simulated concurrency; tune and harden.
8. **Phase 7**: Go-live. Monitor queue depth, CDN hit rate, error rate. Graceful degradation page is always live.

**Rollback**: The existing portal is not modified — it can be restored as-is if this system fails before go-live. After go-live, rollback = DNS switch back to legacy portal (with all its known limitations).
