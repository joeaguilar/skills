---
name: data-pipeline
description: Design, optimize, or troubleshoot data pipelines / ETL-ELT workflows from requirements — batch, streaming, lambda, kappa; orchestration (Airflow/Prefect/Dagster/dbt), engines (Spark/Flink/Beam), warehouses (Snowflake/BigQuery/Redshift/Databricks), streaming (Kafka/Kinesis/Pub-Sub), and data-quality frameworks (Great Expectations/Deequ/Soda) — producing an end-to-end architecture with DAGs, transforms, validation, and monitoring. Interactive: asks about volume/velocity, freshness SLAs, and failure tolerance first. Trigger when the user types /data-pipeline, or asks to "design an ETL pipeline", "build a data pipeline", "stream data from X to Y", "set up Airflow DAGs", or "ingest into our warehouse". Do NOT trigger for transactional schema design (use /database-schema), for product analytics event tracking (use /analytics-events), or for writing application code.
---

# data-pipeline

Design robust, scalable data movement and transformation. Interactive — **ask before architecting**: sources, volume/velocity/variety, freshness SLAs, processing windows, failure tolerance, compliance.

## Method

1. **Requirements** — the 3 Vs, business SLAs, governance needs.
2. **Architecture** — end-to-end: ingestion → transformation → validation → storage → monitoring. Design for current load and future scale.
3. **Data quality first** — validation, schema-evolution strategy, and lineage built into every stage.
4. **Performance & cost** — partitioning, parallelism, minimized data movement; weigh cost on every choice.
5. **Reliability** — idempotency, checkpointing, retries, circuit breakers, recovery.
6. **Deliver** — DAG definitions, transform logic, deployment + monitoring/alerting config, runbooks.

## What good output includes

- A data-flow description/diagram and technology choices with justifications.
- Code for key components (DAGs, transforms), plus data-quality rules and monitoring queries.
- SLA definitions, cost estimate, and a scalability roadmap.

## Principles

- **Interview before architecting** — freshness and failure tolerance reshape the whole design.
- **Quality and lineage are not add-ons** — bake them into every stage.
- **Idempotent + recoverable** by default.
- **Name the trade-offs** (latency vs cost vs complexity) and offer alternatives.
