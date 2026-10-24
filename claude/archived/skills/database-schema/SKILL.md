---
name: database-schema
description: "Design, review, or optimize a database schema from requirements — normalization (1NF–BCNF) and strategic denormalization, SQL vs NoSQL choice (PostgreSQL/MySQL/MongoDB/Redis/Elasticsearch/Cassandra), indexing & partitioning, constraints, migrations — producing DDL + an ERD with rationale. Interactive: asks about data volume, access/query patterns, and performance needs first. Trigger when the user types /database-schema, or asks to \"design a database schema\", \"model these entities\", \"should this be SQL or NoSQL\", \"optimize this schema/indexes\", or \"plan a migration\". Do NOT trigger for ETL/data-processing pipelines (use /data-pipeline), for API request/response contracts (use /api-contract-designer), or for writing application code."
---

# database-schema

Design the data layer from requirements. Interactive — **ask before modeling**: data volume, read/write access patterns, query shapes, consistency and performance needs, growth trajectory.

## Method

1. **Requirements** — data types, volumes, access patterns, SLAs. Clarify the unknowns that change the model.
2. **Entity modeling** — core entities, attributes, relationships with correct cardinality.
3. **Schema design** — apply normalization, then denormalize deliberately for known hot paths.
4. **Optimization** — indexes matched to query patterns, partitioning, caching layers.
5. **Deliver** — DDL with comments, an ERD (Mermaid when useful), sample inserts + common queries, a migration/versioning approach.

## What good output includes

- Complete DDL for the chosen engine, with constraints (PK/FK/UNIQUE/CHECK).
- Index recommendations justified by expected queries.
- Multiple technology options when the choice is live (SQL vs document vs KV), with trade-offs.
- Audit-trail / soft-delete handling and edge cases (nullability, dedupe, time).

## Principles

- **Interview before you model** — volume and query patterns drive everything.
- **Normalize, then denormalize on purpose** — never accidentally.
- **Index for the queries you'll actually run**, not speculatively.
- **Present trade-offs** when several designs are viable; let the user choose informed.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.
