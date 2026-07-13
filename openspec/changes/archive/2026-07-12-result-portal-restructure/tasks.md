## 1. Project Foundations & Data Feed Contract

- [x] 1.1 Implement mock data generator for 1.5 million students (simulate CSV feed)
- [x] 1.2 Validate architecture can handle 1.5 million scale
- [x] 1.3 Document architecture and bottlenecks discovered during the proof-of-concept
- [x] 1.4 Set up repository structure: monorepo with packages for `batch`, `queue-service`, `result-api`, `load-test`
- [x] 1.5 Configure shared infrastructure-as-code (Terraform or equivalent) for Redis, object storage, and CDN

## 2. Result Pre-Generation Pipeline (batch)

- [x] 2.1 Implement exam-cell data feed ingestion module (parse CSV/JSON input, validate required fields, report skipped records)
- [x] 2.2 Implement per-student JSON result file generator (subject marks, grades, overall result status)
- [ ] 2.3 [DEFERRED] Implement per-student PDF result file generator (formatted, downloadable version of the JSON data)
- [x] 2.4 Implement object storage upload module (write JSON to local mock S3 folder 'mock-s3/' under deterministic key `results/{reg_no}/{semester}`, simulating real S3 storage for development)
- [x] 2.5 Implement KV store index writer (write `reg_no -> result_key` mapping to Redis; verify atomicity)
- [x] 2.6 Implement CDN cache warm-up step (issue GET for each uploaded file URL; log success/failure counts)
- [x] 2.7 Implement batch job summary reporter (total processed, generated, KV entries written, warmed, errors)
- [x] 2.8 Write unit tests for ingestion, file generation, and KV write with mock data
- [x] 2.9 Run batch pipeline end-to-end with a sample dataset of 1,000 mock students; verify idempotency on second run

## 3. Result Fetch API

- [x] 3.1 Implement HMAC-signed result token generator (`{reg_no, iat, exp}`, 10-minute TTL)
- [x] 3.2 Implement `GET /result?token=<result_token>` endpoint: validate signature, check expiry, perform KV lookup, return JSON result
- [ ] 3.3 [DEFERRED] Implement signed PDF download URL generator (time-limited pre-signed object storage URL, 30-minute TTL)
- [x] 3.4 Add idempotency test: call `GET /result` with the same token 5× and assert identical response each time
- [x] 3.5 Add edge case tests: expired token → 401, tampered token → 401, unknown reg_no → 404
- [x] 3.6 Verify no POST endpoints exist on the result fetch path (eliminate resubmission error class entirely)

## 4. Waiting Room Service

- [x] 4.1 Implement queue token issuer (signed JWT with `{queue_position, arrival_ts, exp}`; write to Redis sorted set with score = arrival timestamp)
- [x] 4.2 Implement `GET /queue/status?token=<queue_token>` endpoint (return `{position, eta_seconds, admitted}` from Redis sorted set rank)
- [x] 4.3 Implement ETA calculation (current rank ÷ current admission rate → estimated seconds)
- [x] 4.4 Implement queue token persistence across tab close (set-cookie with HttpOnly, Secure, SameSite=Strict; restore position on re-entry)
- [x] 4.5 Implement admission worker process (reads `queue:admission_rate` from Redis on each cycle; dequeues N students per second; marks them admitted; issues result tokens)
- [x] 4.6 Implement runtime admission rate update (admission worker picks up new `queue:admission_rate` value within ≤ 5 s without restart)
- [x] 4.7 Implement queue capacity limit (reject new tokens when queue exceeds configured max; return capacity-full status response)
- [x] 4.8 Implement queue token expiry flow (expired token → 401 on status endpoint; client re-joins at back of queue)
- [x] 4.9 Write integration tests for admission cycle: token issued → position decreasing → admitted → result token returned
- [ ] 4.10 [DEFERRED] Deploy Redis with replication (Sentinel or Cluster mode) and verify failover does not drop queue state

## 5. Proof-of-Work CAPTCHA Integration

- [x] 5.1 Copy `captcha/` folder and `public/captcha-client.js` from `captcha-system` to this repository
- [x] 5.2 Copy frontend UI files (`index.html`, `style.css`, `app.js`) from `captcha-system`
- [x] 5.3 Integrate PoW challenge generation endpoint (`GET /api/captcha/challenge`)
- [x] 5.4 Rewrite `/api/queue/join` to verify the PoW solution before assigning a queue token
- [x] 5.5 Rewrite `/api/queue/join` and `/api/queue/status` to use Redis Sorted Sets instead of in-memory arrays
- [x] 5.6 Implement PoW challenge token single-use enforcement in Redis
- [x] 5.7 Test end-to-end: human simulated request → browser solves PoW → successfully joins Redis queue

## 6. Graceful Degradation & Fallback

- [ ] 6.1 [DEFERRED] Create and deploy static status/degradation HTML page to CDN (pre-cached, no-origin dependency)
- [ ] 6.2 [DEFERRED] Configure CDN error-page rule: on 5xx or origin timeout → serve static status page
- [x] 6.3 Implement "results not yet published" mode (pre-go-live flag in Redis; portal serves pre-published status page)
- [x] 6.4 Implement queue-full status response (styled, informative page — no raw 503)
- [ ] 6.5 [DEFERRED] Verify that Redis unavailability → CDN serves static page (test by stopping Redis and hitting the portal)

## 7. Load Testing

- [x] 7.1 Write k6 (or Locust) load test script: ramp 0 → 1,500,000 virtual users over 60 s; each user submits reg_no lookup → joins queue → polls status → fetches result
- [ ] 7.2 [DEFERRED] Seed staging environment with 1,500,000 mock student records and pre-generated result files
- [ ] 7.3 [DEFERRED] Run load test against staging; capture report (RPS, error rate, p50/p95/p99 latency, CDN hit rate, queue depth over time)
- [ ] 7.4 [DEFERRED] Verify acceptance criteria: ≥ 99% queue tokens issued within 1 s, p95 result fetch ≤ 500 ms, error rate ≤ 0.1%, CDN hit rate ≥ 99%
- [ ] 7.5 [DEFERRED] Set production `queue:admission_rate` to 80% of measured safe rate from load test
- [ ] 7.6 [DEFERRED] Run load test a second time after tuning; confirm all criteria pass and re-store the report artifact
- [ ] 7.7 [DEFERRED] Document test-mode flag procedure for running load test against production pre-go-live

## 8. Client Layer (Website)

- [x] 8.1 Build waiting room UI: shows live queue position, ETA countdown, "Verifying..." state, and transitions to result view on admission
- [x] 8.2 Build result view: displays subject-wise marks, grades, overall result (PDF download deferred)
- [x] 8.3 [REPLACED BY POW] Integrate Turnstile/hCaptcha invisible widget into client
- [x] 8.4 Test client end-to-end against staging: join queue → wait → admit → view result

## 9. Pre-Go-Live Checklist

- [ ] 9.1 [DEFERRED] Run full batch pre-generation pipeline with real exam-cell data feed; verify all students have result files and KV entries
- [ ] 9.2 [DEFERRED] Warm CDN cache for all generated result files; confirm warm-up success rate ≥ 99%
- [ ] 9.3 [DEFERRED] Run production load test (test mode); confirm all acceptance criteria pass
- [ ] 9.4 [DEFERRED] Set production admission rate from load test results (80% of safe rate)
- [ ] 9.5 [DEFERRED] Set Redis `go_live` flag to enable portal serving mode
- [ ] 9.6 [DEFERRED] Monitor live: queue depth, CDN hit rate, error rate, Redis memory; have admission rate adjustment procedure ready
- [ ] 9.7 [DEFERRED] Confirm graceful degradation page is reachable and correct at CDN edge before opening traffic
