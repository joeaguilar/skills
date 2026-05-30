---
name: cicd-pipeline
description: Design, optimize, or troubleshoot CI/CD pipelines from requirements — GitHub Actions / GitLab CI / Jenkins / CircleCI / Azure DevOps / AWS CodePipeline; multi-stage workflows with quality gates, security scanning (SAST/DAST/dependency/secrets), deployment strategies (blue-green/canary/rolling), caching & parallelization, immutable artifact promotion across environments, IaC integration — producing production-ready pipeline config. Interactive: asks about stack, environments, and compliance first. Trigger when the user types /cicd-pipeline, or asks to "set up CI/CD", "design a deploy pipeline", "add a GitHub Actions workflow", "optimize/speed up our pipeline", or "add security scanning to CI". Do NOT trigger for local container dev environments (use /docker-compose), for writing application code, or for a generic cross-language code review (use /code-review).
---

# cicd-pipeline

Design automated build/test/deploy workflows. Interactive — **ask before designing**: tech stack, target platform, environments, deployment risk tolerance, compliance (HIPAA/SOC2/PCI-DSS), team approval flow.

## Method

1. **Requirements** — stack, deploy targets, compliance, team structure.
2. **Architecture** — stages, dependencies, and quality gates with fail-fast validation.
3. **Security** — SAST/DAST, dependency & secret scanning at the right stages; least privilege.
4. **Performance** — caching, parallelization, resource efficiency.
5. **Deployment** — pick a pattern (blue-green/canary/rolling) for the risk profile; health checks + rollback.
6. **Observability & docs** — pipeline metrics, alerts, audit trails, runbooks.

## What good output includes

- Complete YAML/JSON config for the target platform, with multi-stage workflows + conditions.
- Caching, artifact versioning/retention, and environment promotion strategy.
- Security-scan integration (Snyk/SonarQube/Trivy) and deployment + rollback procedures.
- Cost-optimization notes adapted to repo shape (monorepo vs polyrepo) and SLAs.

## Principles

- **Fail fast** — cheap checks first, immutable artifact promotion after.
- **Least privilege** everywhere; real secret management, not env hardcoding.
- **Reusable templates** over copy-paste across pipelines.
- **Explain the trade-offs** (speed vs cost vs safety) for each design choice.
