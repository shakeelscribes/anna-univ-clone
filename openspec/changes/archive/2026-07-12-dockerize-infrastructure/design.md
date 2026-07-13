## Context

The architecture consists of several distinct pieces:
1. `batch`: A script that runs periodically to pre-generate results.
2. `queue-service`: A Node.js API that issues queue tokens and validates PoW.
3. `result-api`: A Node.js API that serves pre-generated results.
4. `frontend`: HTML/JS static files (currently served via Live Server).
5. `Redis`: The state store holding queue data and result mappings.

To deploy this in an Enterprise environment (like Oracle Cloud free tier), managing these components manually is unscalable. Docker and Docker Compose provide the standard way to package these apps into containers.

## Goals / Non-Goals

**Goals:**
- Containerize `batch`, `queue-service`, and `result-api` using efficient Node.js Docker images.
- Provide a `docker-compose.yml` that seamlessly boots all services and a `redis:alpine` container.
- Create an internal Docker network so the Node.js services can communicate with Redis using the hostname `redis` instead of `localhost`.
- Serve the `frontend` files using a production-grade Nginx Docker container.

**Non-Goals:**
- Actually deploying the code to a cloud provider (this change just sets up the Docker configuration).
- Modifying the core logic of the application.

## Decisions

- **Base Images**: Use `node:20-alpine` for the Node.js services to keep image sizes extremely small and secure.
- **Frontend Serving**: Instead of using a dedicated Node.js static server or Live Server, we will use the official `nginx:alpine` image to serve the frontend folder.
- **Networking**: Docker Compose will automatically create a default network. We will set the `REDIS_HOST` environment variable to `redis` in the compose file so the Node.js apps can find the database.
- **Batch Processing**: The `batch` folder is a script, not an API. We won't run it as a continuous service in Compose, but we will provide a Dockerfile so it can be run manually via `docker run` to seed the database.

## Risks / Trade-offs

- **Risk**: Hardcoded `localhost` connections in the codebase will fail when running inside Docker containers.
- **Mitigation**: We must ensure that the codebase respects environment variables like `REDIS_HOST` rather than strictly connecting to `localhost:6379`.
