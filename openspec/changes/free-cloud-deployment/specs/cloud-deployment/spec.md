## ADDED Requirements

### Requirement: Oracle Cloud ARM VM provisioning
The system SHALL be deployable on an Oracle Cloud Always Free ARM (Ampere A1) virtual machine running Ubuntu 22.04, with a minimum of 2 OCPUs and 8GB RAM allocated from the Always Free quota.

#### Scenario: VM is accessible via SSH
- **WHEN** the Oracle Cloud ARM VM is created
- **THEN** the operator SHALL be able to SSH into the VM using the downloaded private key file
- **AND** the VM SHALL have a stable public IP address assigned

#### Scenario: Required ports are open
- **WHEN** the VM security list is configured
- **THEN** ports 22 (SSH), 80 (HTTP), and 443 (HTTPS) SHALL be open to inbound traffic from all sources (0.0.0.0/0)

### Requirement: Docker environment on the VM
The system SHALL have Docker Engine and Docker Compose installed on the VM such that the existing docker-compose.yml can be executed without modification to application service definitions.

#### Scenario: Docker Compose starts all services
- **WHEN** `docker-compose up -d` is run in the project root
- **THEN** all five services (redis, minio, queue-service, result-api, frontend/nginx) SHALL start successfully and be in a running state

### Requirement: Public HTTPS access via DuckDNS and Let's Encrypt
The system SHALL be accessible over HTTPS at a permanent DuckDNS subdomain (e.g., `anna-results.duckdns.org`) with a valid browser-trusted SSL certificate issued by Let's Encrypt.

#### Scenario: HTTPS URL loads the frontend
- **WHEN** a user navigates to `https://<subdomain>.duckdns.org` in any modern browser
- **THEN** the browser SHALL display no security warnings
- **AND** the Anna University results frontend (index.html) SHALL load successfully

#### Scenario: HTTP redirects to HTTPS
- **WHEN** a user navigates to `http://<subdomain>.duckdns.org`
- **THEN** nginx SHALL redirect the request to `https://<subdomain>.duckdns.org` with HTTP 301

#### Scenario: Let's Encrypt certificate auto-renews
- **WHEN** the SSL certificate is within 30 days of expiry
- **THEN** the certbot renewal cron job SHALL automatically renew the certificate without operator intervention

### Requirement: Batch job produces result data on the server
The system SHALL run the pre-generation batch job on the server using the mock CSV, producing all result JSON files in the MinIO object store accessible to the result-api.

#### Scenario: Batch job completes successfully
- **WHEN** `node index.js mock_results.csv` is run from the `packages/batch` directory on the server
- **THEN** the batch job SHALL complete without errors
- **AND** 100,000 result JSON files SHALL be written to the MinIO bucket
- **AND** 100,000 Redis KV entries SHALL be written mapping reg_no to result path

### Requirement: Results are publicly live via go_live flag
The system SHALL serve the results frontend (not the fallback page) when the `go_live` Redis key is set to `true`.

#### Scenario: Setting go_live makes results accessible
- **WHEN** `redis-cli SET go_live true` is executed
- **THEN** students navigating to the root URL SHALL see the results login form
- **AND** students SHALL NOT see the fallback "results not yet published" page

## MODIFIED Requirements

### Requirement: Dockerization of Queue Service
The `queue-service` SHALL be runnable as a Docker container, and the overall `docker-compose.yml` SHALL expose port 443 for HTTPS traffic and mount Let's Encrypt SSL certificate files into the nginx frontend container.

#### Scenario: nginx serves HTTPS traffic
- **WHEN** docker-compose starts the frontend service
- **THEN** the nginx container SHALL listen on port 443
- **AND** SSL certificates from `/etc/letsencrypt/live/<domain>/` SHALL be mounted into the container as read-only volumes
- **AND** nginx SHALL terminate SSL and proxy API requests to backend services as before
