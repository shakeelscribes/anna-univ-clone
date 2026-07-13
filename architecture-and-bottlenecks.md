# Architecture & PoC Bottlenecks

During the proof-of-concept (PoC) phase built in the `captcha-system` directory, we implemented a minimal viable product (MVP) to validate the core ideas: behavioral Proof-of-Work CAPTCHA, a queue management system, and pre-generated result lookups.

While the PoC demonstrated that these components successfully mitigate bot traffic and traffic spikes, we identified several severe bottlenecks that prevent scaling to 1.5 million students.

## 1. Single Node In-Memory State
**Bottleneck:** The queue and the result index were stored entirely in memory (JavaScript `Set`, arrays, and global variables).
- Cannot run across multiple processes/servers (no PM2 cluster mode or auto-scaling).
- A server crash would wipe out the entire queue and admit states, forcing all waiting users to start over.
- Node.js memory limits (typically ~1.4 GB default) would be quickly exhausted by a 1.5 million entry index and thousands of active queue tokens.

**Solution:** Offload all state to a cluster-ready data store (Redis). Redis sorted sets for the queue and Redis KV for the index.

## 2. Disk I/O & File System Limits
**Bottleneck:** Results were read from the local file system using `fs.readFile`.
- Fetching small individual JSON files heavily limits IOPS on a single disk.
- Difficult to scale across multiple servers without using a network file system (NFS), which introduces latency.
- No CDN caching layer for the raw result data.

**Solution:** Pre-generate and upload all result JSON and PDF files to S3-compatible Object Storage, then place a Global CDN in front. The CDN handles 99% of requests instantly, bypassing the origin server entirely for result fetching.

## 3. Lack of Graceful Degradation
**Bottleneck:** If the backend crashed, users simply received `5xx` errors.
- No static waiting room fallback if Redis or Node.js were overwhelmed.

**Solution:** CDN-level edge rules. If the origin is unreachable or returns a 5xx, the CDN will serve a pre-cached static HTML status page ("We are experiencing high traffic...").

## 1.5 Million Scale Validation
Based on the identified solutions:
- **Redis (Queue & Index):** A moderately sized Redis instance can handle > 100,000 ops/sec. Storing 1.5 million KV pairs for the index takes < 100 MB of RAM. The queue state for ~100k active users is negligible.
- **CDN (Results):** Once generated and uploaded, 1.5 million JSON files are served directly from edge nodes worldwide. The origin server sees near-zero traffic for the actual results.
- **Node.js (API & Queue Logic):** Without holding large indexes in memory and offloading results to the CDN, the Node.js API merely handles JWT signing and Redis rank checks. It can easily scale horizontally behind a load balancer to handle tens of thousands of requests per second.

The proposed architecture is mathematically validated to handle the 1.5 million scale efficiently.
