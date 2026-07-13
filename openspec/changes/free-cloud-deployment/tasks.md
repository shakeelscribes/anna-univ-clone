## 1. Oracle Cloud VM Setup

- [ ] 1.1 Create an Oracle Cloud account at cloud.oracle.com (use Gmail/email, verify with debit card — no charges will occur)
- [ ] 1.2 Navigate to Compute → Instances → Create Instance, select "Ampere" shape (Always Free), choose Ubuntu 22.04, allocate 4 OCPUs and 24GB RAM
- [ ] 1.3 Download the SSH private key during VM creation and save it as `oracle-key.pem`
- [ ] 1.4 Note down the VM's public IP address from the Instances dashboard
- [ ] 1.5 Open firewall ports: go to Instance → Subnet → Security List → Add Ingress Rules for TCP ports 80 and 443 (source: 0.0.0.0/0)
- [ ] 1.6 Also open Ubuntu's internal firewall: SSH into VM and run `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT && sudo netfilter-persistent save`
- [ ] 1.7 Verify SSH access: `ssh -i oracle-key.pem ubuntu@<VM_PUBLIC_IP>`

## 2. Docker Installation on VM

- [ ] 2.1 SSH into the VM and run: `sudo apt update && sudo apt install -y docker.io docker-compose git`
- [ ] 2.2 Add ubuntu user to docker group: `sudo usermod -aG docker ubuntu` then log out and back in
- [ ] 2.3 Verify Docker works: `docker run hello-world`

## 3. DuckDNS Domain Setup

- [x] 3.1 Go to duckdns.org, sign in with Google or GitHub (free, no new account needed)
- [x] 3.2 Create a subdomain (e.g., `anna-results`) and enter the VM's public IP in the IP field → click "update ip"
- [ ] 3.3 Verify DNS resolves: `ping anna-results.duckdns.org` should return the VM's IP (may take 1-2 minutes)

## 4. Upload Project to Server

- [ ] 4.1 Push the project to a GitHub repository (or use scp to copy files directly to the VM)
- [ ] 4.2 On the VM, clone the project: `git clone https://github.com/<your-username>/anna-university.git`
- [ ] 4.3 Navigate into the project directory: `cd anna-university`

## 5. SSL Certificate with Let's Encrypt

- [ ] 5.1 Install Certbot on the VM: `sudo apt install -y certbot`
- [ ] 5.2 Make sure port 80 is not in use (Docker is not running yet): `sudo docker-compose down` if needed
- [ ] 5.3 Issue the SSL certificate (replace with your actual subdomain): `sudo certbot certonly --standalone -d anna-results.duckdns.org`
- [ ] 5.4 Verify certificate files exist at: `/etc/letsencrypt/live/anna-results.duckdns.org/fullchain.pem` and `privkey.pem`
- [ ] 5.5 Set up auto-renewal cron: `echo "0 12 * * * root /usr/bin/certbot renew --quiet" | sudo tee -a /etc/crontab`

## 6. Update nginx Configuration for HTTPS

- [x] 6.1 Edit `packages/frontend/nginx.conf` to add an HTTPS server block with `listen 443 ssl`, `ssl_certificate` and `ssl_certificate_key` directives pointing to `/etc/letsencrypt/live/<domain>/`
- [x] 6.2 Add an HTTP-to-HTTPS redirect block: `listen 80` → `return 301 https://$host$request_uri`

## 7. Update docker-compose.yml for HTTPS

- [x] 7.1 Edit `docker-compose.yml` frontend service: add port `"443:443"` alongside the existing `"8080:80"`
- [x] 7.2 Add a volume mount for Let's Encrypt certs: `/etc/letsencrypt:/etc/letsencrypt:ro`
- [x] 7.3 Change the frontend port mapping from `"8080:80"` to `"80:80"` so HTTP redirect works on standard port

## 8. Deploy Frontend to Cloudflare Pages

- [ ] 8.1 Go to dash.cloudflare.com -> Pages -> Connect to Git or Direct Upload
- [ ] 8.2 Upload the `packages/frontend` folder to Cloudflare Pages
- [ ] 8.3 Note down the generated public URL (e.g., `https://anna-results.pages.dev`)

## 9. Update Backend API & Frontend Code

- [x] 9.1 In `packages/queue-service/` and `packages/result-api/`, run `npm install cors`
- [x] 9.2 Add CORS middleware to both Node.js apps to allow requests from the Cloudflare Pages URL
- [x] 9.3 In `packages/frontend/app.js` and `captcha-client.js`, update all `fetch()` calls to use absolute URLs
- [ ] 9.4 Re-upload the updated `packages/frontend` to Cloudflare Pages

## 10. Launch All Backend Services

- [ ] 10.1 Start all Docker services on Oracle VM: `docker-compose up -d`
- [ ] 10.2 Verify all 5 containers are running: `docker ps`
- [ ] 10.3 Check nginx logs for SSL errors: `docker logs anna_univ_frontend`

## 11. Run the Batch Job

- [ ] 11.1 Navigate to batch directory on the server: `cd packages/batch`
- [ ] 11.2 Install dependencies: `npm install`
- [ ] 11.3 Copy or confirm `mock_results.csv` exists in the batch directory
- [ ] 11.4 Run the batch job: `node index.js mock_results.csv` (takes ~2 minutes for 100k students)
- [ ] 11.5 Verify output: `docker exec anna_univ_redis redis-cli DBSIZE` should return 100000

## 12. Go Live and Verify

- [ ] 12.1 Set the go_live flag: `docker exec anna_univ_redis redis-cli SET go_live true`
- [ ] 12.2 Open a browser and navigate to your Cloudflare Pages URL (`https://anna-results.pages.dev`)
- [ ] 12.3 Test with a sample student: Reg No `951822100000`, DOB `28/08/2001` — should successfully queue and display results
- [ ] 12.4 Share the Cloudflare URL with someone else on a different network to confirm public access works
