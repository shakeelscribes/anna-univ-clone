## 1. Environment Preparation

- [x] 1.1 Update `queue-service/index.js` to respect `REDIS_HOST` and `REDIS_PORT` environment variables (fallback to localhost/6379).
- [x] 1.2 Update `result-api/index.js` to respect `REDIS_HOST` and `REDIS_PORT` environment variables.
- [x] 1.3 Update `batch/generate-feed.js` and other scripts to respect `REDIS_HOST` and `REDIS_PORT`.

## 2. Dockerfiles

- [x] 2.1 Create a lightweight `Dockerfile` in `packages/queue-service/` (Node.js 20 Alpine).
- [x] 2.2 Create a lightweight `Dockerfile` in `packages/result-api/` (Node.js 20 Alpine).
- [x] 2.3 Create a lightweight `Dockerfile` in `packages/batch/` (Node.js 20 Alpine) tailored for script execution.

## 3. Docker Compose Configuration

- [x] 3.1 Create `docker-compose.yml` in the root directory.
- [x] 3.2 Add `redis` service using `redis:alpine` image.
- [x] 3.3 Add `queue-service` referencing its Dockerfile and exposing port 3000.
- [x] 3.4 Add `result-api` referencing its Dockerfile and exposing port 3001.
- [x] 3.5 Add `frontend` service using `nginx:alpine` to serve `packages/frontend/` statically on port 8080.
- [x] 3.6 Define environment variables in the compose file to connect Node services to the `redis` service.

## 4. Verification

- [x] 4.1 Run `docker-compose build` to verify images build successfully.
- [x] 4.2 Run `docker-compose up -d` to verify stack boots up without crashing.
- [x] 4.3 Open the frontend on localhost:8080 and verify the PoW, queue, and result workflow functions seamlessly over the Docker network.
