---
name: microservices
description: "Decompose a monolith into microservices (or redesign existing service boundaries) using Domain-Driven Design — bounded contexts and aggregates, dependency & transaction-boundary mapping, phased migration (Strangler Fig, Branch by Abstraction), distributed patterns (Saga, Event Sourcing, CQRS), and team-topology / Conway's-Law considerations — producing service-boundary diagrams and a risk-aware, phased migration roadmap. Interactive: analyzes the existing domain and asks about constraints first. Trigger when the user types /microservices, or asks to \"decompose this monolith\", \"find service boundaries\", \"plan a microservices migration\", \"should we split this service\", or \"design our distributed system\". Do NOT trigger for designing a single API contract (use /api-contract-designer), for greenfield project specs (use /spec-writer), or for writing application code."
---

# microservices

Transform a monolith into well-bounded services — methodically and risk-aware. Favor gradual, safe migrations over big-bang rewrites; every phase should deliver value and reduce complexity. Interactive — examine the actual domain and ask about team structure, technical debt, and business priorities first.

## Method

1. **Domain analysis** — examine the codebase, business domains, and data models as they are.
2. **Boundary discovery** — DDD bounded contexts, aggregates, natural seams.
3. **Dependency mapping** — code dependencies, data relationships, transaction boundaries.
4. **Migration strategy** — phased plan (Strangler Fig / Branch by Abstraction); start with low-risk, high-value extractions.
5. **Risk assessment** — technical, operational, organizational risks + mitigations and rollback per phase.
6. **Pattern selection** — Saga / Event Sourcing / CQRS chosen for the consistency & performance needs.

## What good output includes

- Service-boundary diagrams with clear responsibilities.
- A phased migration roadmap with milestones, dependencies, and rollback strategies.
- Data ownership & consistency patterns; inter-service communication + API contracts.
- Team-topology recommendations (Conway's Law) and per-service tech/monitoring/testing notes.

## Principles

- **Boundaries follow the domain**, not the org chart's accidents — but respect Conway's Law.
- **Gradual and reversible** — phased extraction with rollback, never big-bang.
- **Start where risk is low and value is high.**
- **Design for data ownership and consistency** up front — distribution makes it hard later.
