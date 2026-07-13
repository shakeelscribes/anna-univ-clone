## Context

The anna-university project is a fully functional local Docker Compose stack demonstrating a high-scale Anna University results portal. All five services (queue-service, result-api, redis, minio, nginx) run on a developer's Windows machine. The goal is to deploy this to a publicly accessible free server with HTTPS so millions of students can access it without the developer's machine being involved.

The critical constraint: the PoW CAPTCHA uses `crypto.subtle.digest` (WebCrypto API) which browsers only allow in **secure contexts** (HTTPS). Without HTTPS, the entire queue/CAPTCHA flow breaks with "Security check failed."

## Goals / Non-Goals

**Goals:**
- Deploy the full Docker Compose stack to Oracle Cloud Always Free ARM VM (4 OCPUs, 24GB RAM)
- Establish a permanent public HTTPS URL via DuckDNS + Let's Encrypt
- Keep total cost at ₹0 — no paid services, no credit card charges
- Preserve all existing application code exactly as-is
- Enable the `go_live` flag so results are publicly accessible

**Non-Goals:**
- Adding Cloudflare CDN (can be layered on top later without code changes)
- Changing any application logic or data model
- Setting up CI/CD or automated deployments
- Monitoring or alerting infrastructure
- High-availability / multi-region setup

## Decisions

**Decision 1: Oracle Cloud Always Free ARM (Ampere A1) as the host**
- Rationale: Oracle's Always Free ARM tier gives 4 OCPUs and 24GB RAM with no time limit and no charges after verification. The full Docker Compose stack uses ~2GB RAM, leaving 22GB headroom. No other free cloud (Google Cloud e2-micro: 1GB RAM, AWS free tier: 12 months only) comes close.
- Alternative considered: Google Cloud e2-micro — rejected, 1GB RAM is insufficient for 5 Docker services running simultaneously.
- Alternative considered: Render/Railway free tiers — rejected, services sleep after inactivity causing queue state loss.

**Decision 2: DuckDNS for free permanent subdomain**
- Rationale: DuckDNS provides a permanent, free subdomain (e.g., `anna-results.duckdns.org`) that points to any IP. It has been running since 2012, requires only an email/Google/GitHub login, and has no expiry. Takes under 5 minutes to set up.
- Alternative considered: Freenom (.tk/.ml domains) — rejected, known for instability and sudden domain seizures.
- Alternative considered: Cloudflare Quick Tunnel (`trycloudflare.com`) — rejected, URL changes on every restart making it unsuitable as a stable link.

**Decision 3: Let's Encrypt (Certbot) for free SSL**
- Rationale: Let's Encrypt issues free, browser-trusted SSL certificates valid for 90 days with auto-renewal via Certbot. This is the industry standard for free HTTPS. Works directly with DuckDNS subdomains.
- Alternative considered: Cloudflare SSL — requires delegating DNS to Cloudflare, which doesn't support DuckDNS subdomains without additional complexity.
- Alternative considered: Self-signed certificate — rejected, browsers will show security warnings that will confuse students.

**Decision 4: nginx handles SSL termination at the container layer**
- Rationale: nginx already serves as the backend reverse proxy. The Let's Encrypt certificates are mounted into the nginx container as a read-only volume.
- The existing `nginx.conf` needs a new `server` block for port 443 with `ssl_certificate` directives, routing traffic to `/api`.

**Decision 4.5: Cloudflare Pages for Frontend (Decoupled Architecture)**
- Rationale: Serving static HTML/CSS/JS from the Oracle VM wastes its bandwidth and CPU. By deploying the frontend to Cloudflare Pages (free), 100% of the static file traffic is absorbed by a massive global CDN. The Oracle VM is freed up to only handle API requests.
- Note: This requires updating the frontend to make API calls to absolute URLs (`https://anna-univ-clone.duckdns.org/api/...`) and adding CORS to the Node.js backend.

**Decision 5: Batch job runs once on the server using the existing mock CSV**
- Rationale: The `mock_results.csv` already contains 100,000 realistic student records in the correct Anna University format. The existing `node index.js mock_results.csv` batch job generates all pre-built JSON files into `mock-s3/`. No changes to batch logic needed.

## Risks / Trade-offs

- **Oracle Cloud ARM capacity** → Oracle sometimes shows "Out of Capacity" for ARM instances in certain regions. Mitigation: try multiple regions (Mumbai, Singapore, Frankfurt) during signup.
- **DuckDNS reliability** → DuckDNS is a community project, not enterprise-grade. Mitigation: acceptable for a demo/proof-of-concept. Can migrate to a paid domain later for ₹800/year.
- **Let's Encrypt rate limits** → Let's Encrypt allows 5 certificate issuances per domain per week. Mitigation: use staging environment for testing, production for the final cert.
- **Certbot auto-renewal** → Certbot renews certificates every 60 days automatically. Mitigation: set up a cron job (`0 12 * * * /usr/bin/certbot renew --quiet`) on the server.
- **Redis data persistence** → If the Oracle VM restarts, Redis queue state is lost. Mitigation: the `restart: unless-stopped` Docker policy handles this. Results (in MinIO) are unaffected.

## Migration Plan

1. Provision Oracle Cloud ARM VM with Ubuntu 22.04
2. Open firewall ports: 22 (SSH), 80 (HTTP for Certbot verification), 443 (HTTPS)
3. Install Docker + Docker Compose on the VM
4. Upload project files via `git clone` or `scp`
5. Update `nginx.conf` to add HTTPS server block
6. Update `docker-compose.yml` to mount SSL certs and expose port 443
7. Register DuckDNS subdomain, point to VM public IP
8. Run Certbot to issue SSL certificate (standalone mode, before Docker starts nginx)
9. Start all services: `docker-compose up -d`
10. Run batch job: `node index.js mock_results.csv`
11. Set go_live: `docker exec anna_univ_redis redis-cli SET go_live true`
12. Deploy `packages/frontend` to Cloudflare Pages and get the public URL
13. Update frontend `app.js` to point to the DuckDNS API URL and add CORS middleware in the Node.js backend to allow the Cloudflare URL
14. Verify public access and full queue flow via the Cloudflare Pages URL

**Rollback:** If anything breaks, `docker-compose down` stops all services. The VM can be terminated from Oracle Cloud console with no lasting consequences (Always Free, no charges).
