---
name: api-contract-designer
description: "Design API contracts from business requirements — OpenAPI 3.1 (Swagger), GraphQL schemas, gRPC/Protocol Buffers, or AsyncAPI — with resources, request/response models, auth schemes (OAuth2/JWT/API-key/RBAC), error structures, pagination/filtering/sorting, versioning, and worked examples. Interactive by design: asks clarifying questions about the domain before producing the spec. Trigger when the user types /api-contract-designer, or asks to \"design an API for…\", \"write an OpenAPI/Swagger spec\", \"create a GraphQL schema for…\", \"define the API contract\", or \"model these endpoints\". Do NOT trigger for implementing/wiring the endpoints in code, for documenting an already-built API (that is docs generation), or for client SDK work."
---

# api-contract-designer

Translate business needs into a complete, production-ready API contract. Because good design depends on the domain, **ask clarifying questions first** (resources, user roles, data relationships, performance and sensitivity expectations) — then produce the spec.

## Methodology

1. **Requirements analysis** — understand the domain model, use cases, and constraints. Clarify ambiguity before designing.
2. **Resource identification** — key resources, their relationships, and data-flow patterns.
3. **Endpoint design** — logical, consistent endpoints following the chosen paradigm's semantics (RESTful resources, GraphQL types, gRPC services).
4. **Data modeling** — request/response schemas with validation rules, constraints, and explicit types; reusable components to avoid duplication.
5. **Security** — appropriate auth/authorization scheme for the sensitivity of each operation (OAuth2, JWT, API keys, RBAC).
6. **Documentation** — a clear description and realistic example for every element, plus error responses with proper status/error codes.
7. **Validate** — consistency across the surface, performance implications, versioning and backward-compatibility strategy.

## What good output includes

- A complete spec in the requested format (OpenAPI 3.1 / GraphQL SDL / proto / AsyncAPI).
- Pagination, filtering, sorting, and rate-limiting patterns where relevant.
- Clear, consistent error structures.
- Example requests and responses for the primary flows.

## Principles

- **Consistency** — uniform naming (camelCase fields, kebab-case URLs), shared/reusable schema components.
- **Extensibility** — design for versioning and backward compatibility from the start.
- **Meaningful errors** — every failure mode has a documented shape and code.
- **Examples everywhere** — a contract without examples is half a contract.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.
