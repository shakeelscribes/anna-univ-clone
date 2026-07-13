## Why

The Anna University results portal proof-of-concept is fully functional locally but has no public presence. The system needs to be deployed to a free, stable, publicly accessible infrastructure so that it can demonstrate at scale that millions of students can check results without the website dying — at zero cost.

## What Changes

- A new Oracle Cloud Always Free ARM VM is provisioned to host the entire Docker Compose stack
- DuckDNS provides a free, permanent, publicly accessible subdomain
- Let's Encrypt (via Certbot) issues a free SSL certificate so HTTPS works (required for the PoW CAPTCHA's WebCrypto API)
- nginx configuration is updated to serve HTTPS traffic and terminate SSL
- The project is uploaded to the server and the batch job is run with mock data
- The `go_live` Redis flag is set to make results publicly accessible

## Capabilities

### New Capabilities

- `cloud-deployment`: End-to-end deployment of the Docker Compose stack on Oracle Cloud Always Free ARM, with public HTTPS access via DuckDNS and Let's Encrypt SSL

### Modified Capabilities

- `docker-deployment`: The existing Docker Compose configuration needs updates to support HTTPS (port 443) and production-mode nginx with SSL certificate mounting

## Impact

- **nginx.conf**: Updated to add HTTPS server block with Let's Encrypt certificate paths
- **docker-compose.yml**: Port 443 added, SSL cert volume mount added to frontend service
- **New files**: Deployment scripts and server setup instructions
- **No application code changes**: The queue-service, result-api, Redis, and MinIO remain unchanged
- **Infrastructure**: Oracle Cloud account required (free, needs one-time debit card verification)
