---
name: docker-compose
description: "Design, optimize, or troubleshoot Docker Compose environments for local development, testing, and prod-like setups — services with correct dependencies/startup order, isolated networks, volume/persistence strategy, health checks, resource limits, hot-reload and dev tooling (pgAdmin, MailHog, MinIO, Swagger UI), multi-stage Dockerfiles — producing a complete docker-compose.yml + overrides + .env.example + helper scripts. Interactive: asks about the services and their relationships first. Trigger when the user types /docker-compose, or asks to \"set up docker-compose\", \"containerize my stack for local dev\", \"add a service to compose\", or \"dockerize this app for development\". Do NOT trigger for CI/CD pipelines (use /cicd-pipeline), for production Kubernetes orchestration, or for writing application code."
---

# docker-compose

Design containerized environments that "just work" for developers, with dev/prod parity. Interactive — **ask before generating**: the app's components, inter-service dependencies, data persistence needs, and which dev conveniences matter.

## Method

1. **Service analysis** — components, dependencies, startup order.
2. **Networks** — isolated custom networks and communication patterns.
3. **Volumes** — persistence, code mounting, sharing.
4. **Environment** — flexible `.env` management with a documented `.env.example`.
5. **Dev optimization** — hot-reload, remote debugging, DB/GUI/email/storage tooling.
6. **Prod alignment** — parity without sacrificing dev convenience.

## What good output includes

- A complete, logically structured `docker-compose.yml` (+ `docker-compose.override.yml` for local).
- Optimized multi-stage Dockerfiles where needed; `.env.example` with every variable documented.
- Health checks, resource limits, centralized logging, non-root users, secret handling.
- A Makefile/scripts for common ops (start/stop/reset/logs) and a setup + troubleshooting README.

## Principles

- **One process per container**; graceful shutdown with proper signal handling.
- **Health checks + explicit dependencies** so startup is reliable, not racy.
- **Dev convenience and prod parity together** — not one at the other's expense.
- **Security defaults**: non-root, least privilege, real secret management.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.
