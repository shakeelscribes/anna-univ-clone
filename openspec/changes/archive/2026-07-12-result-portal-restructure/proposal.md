## Why

Anna University's result portal (coe1.annauniv.edu-style) collapses every result day under 1.5 million-scale concurrent traffic, leaving students unable to access their own results — a predictable, avoidable failure caused by treating a static-content delivery event as a live transactional system. This restructure re-engineers the portal around pre-generation, CDN delivery, and a virtual waiting room so that result day is no longer a crisis.

## What Changes

- **Pre-generate** every student's result as a static JSON + PDF immediately after results are finalised, before any student traffic arrives — eliminating all live DB computation during the traffic spike.
- **Serve results from CDN + KV cache** (S3-compatible object storage behind a CDN, registration-number -> result-key lookups in Redis/DynamoDB) so every result fetch is an O(1) edge read, not a relational DB query.
- **Replace visual CAPTCHA** with a custom Proof-of-Work (PoW) cryptographic challenge to remove the captcha bottleneck and third-party dependencies.
- **Issue queue tokens immediately** to every incoming student via a virtual waiting room, admitting students in controlled batches at a safe backend rate — replacing the broken page with an honest, live queue position and wait estimate.
- **Make result fetch idempotent** via a short-lived signed access token so refresh / back-button never triggers re-computation and never produces a "confirm resubmission" error.
- **Deploy stateless, autoscaling app servers** behind a load balancer, load-tested before result day at simulated 1.5 million-scale concurrency.
- **Guarantee graceful degradation**: if load exceeds provisioned capacity, students always see a proper status/queue page — never a blank or dead page.
- Architect the **backend as a REST/WebSocket API** so the website client remains decoupled from the core logic.

## Capabilities

### New Capabilities

- `result-pre-generation`: Batch pipeline that ingests exam-cell result data and generates a static result file (JSON + PDF) per student, writing files to object storage and a lookup index to KV store.
- `result-fetch-api`: Token-based, idempotent GET endpoint that resolves a signed access token to the pre-generated result from KV cache + CDN. No live DB computation.
- `waiting-room`: Virtual waiting room service - issues queue tokens at the edge, tracks position in Redis sorted set, admits students in controlled batches, exposes a status-polling endpoint with live position and ETA.
- `silent-bot-check`: Custom Proof-of-Work (PoW) CAPTCHA solved by the client's browser in the background, submitting cryptographic proof to join the Redis queue.
- `graceful-degradation`: Fallback layer that ensures students always see a meaningful status/queue page when capacity is exceeded.
- `load-testing`: Scripted 1.5 million-scale load test suite (k6 or Locust) validating queue throughput, admission rate, KV cache hit rate, and CDN delivery under simulated peak concurrency — run before each result day.

### Modified Capabilities

*(No existing specs - this is a greenfield system.)*

## Impact

- **Data source integration point**: Since this is an independent proof-of-concept, we will build a mock data generator for 1.5 million students to simulate the exam cell data feed.
- **Infrastructure**: New components - Redis (queue + KV lookup), S3-compatible object storage, CDN (Cloudflare/Fastly), stateless app servers with autoscaling, load balancer.
- **Client layer**: Waiting room UI (web page) and result view are the only client-facing surfaces; both consume the same REST/WebSocket API.
- **No legacy portal dependency**: Architecture is entirely independent of coe1.annauniv.edu; it uses generated mock data to prove the concept.
- **Legal/scope**: This is an independent, unaffiliated project built to explore architectural solutions to the university's result portal bottleneck.
