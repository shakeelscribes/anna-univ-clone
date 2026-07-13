## Why

The Anna University results portal proof-of-concept is fully functional locally but has no public presence. The system needs to be deployed to a free, stable, publicly accessible infrastructure so that it can demonstrate at scale that millions of students can check results without the website dying — at zero cost.

## What Changes

- Cloudflare Pages is used to host the frontend static files for a massive, free global CDN (Decoupled Architecture)
- A new Oracle Cloud Always Free ARM VM is provisioned to host the backend API (queue-service, result-api, Redis, MinIO)
- DuckDNS provides a free, permanent, publicly accessible subdomain for the Oracle VM backend API
- Let's Encrypt (via Certbot) issues a free SSL certificate for the backend (required to prevent Mixed Content errors from the Cloudflare frontend)
- nginx configuration is updated to serve HTTPS traffic and terminate SSL for the backend API
- CORS middleware is added to the backend APIs to allow requests from the Cloudflare Pages domain
- The project is uploaded to the server and the batch job is run with mock data
- The `go_live` Redis flag is set to make results publicly accessible

## Capabilities

### New Capabilities

- `cloud-deployment`: Decoupled end-to-end deployment. Frontend on Cloudflare Pages. Backend Docker Compose stack on Oracle Cloud Always Free ARM with public HTTPS access via DuckDNS and Let's Encrypt SSL.

### Modified Capabilities

- `docker-deployment`: The existing Docker Compose configuration needs updates to support HTTPS (port 443) and production-mode nginx with SSL certificate mounting

## Impact

- **nginx.conf**: Updated to add HTTPS server block with Let's Encrypt certificate paths (serves API only)
- **docker-compose.yml**: Port 443 added, SSL cert volume mount added to frontend service
- **Code Changes**: 
  - Backend: Added CORS middleware to `queue-service` and `result-api`
  - Frontend: `app.js` API fetch URLs updated to absolute paths pointing to DuckDNS
- **New files**: Deployment scripts and server setup instructions
- **Infrastructure**: Oracle Cloud account (free) and Cloudflare account (free) required
