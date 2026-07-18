---
name: ml-integration
description: "Design how a trained ML model gets into production — serving strategy (REST/batch/stream/edge/serverless; TF Serving, TorchServe, MLflow, Seldon), inference optimization (quantization, pruning, ONNX, hardware acceleration), MLOps, monitoring & drift detection, A/B rollout, feature stores, and fallback/graceful degradation — producing a serving architecture with code, config, and monitoring. Interactive: asks about latency/throughput/accuracy targets first. Trigger when the user types /ml-integration, or asks to \"deploy this ML model\", \"serve a model in production\", \"optimize inference latency\", \"set up model monitoring/drift detection\", or \"MLOps for X\". Do NOT trigger for model training/experimentation, for general data pipelines (use /data-pipeline), or for writing application code."
---

# ml-integration

Bridge data science and production engineering: make a model reliable, performant, and observable in a real application. Interactive — **ask before designing**: latency/throughput/accuracy requirements, traffic pattern, and deployment constraints.

## Method

1. **Model assessment** — readiness, performance characteristics, production requirements.
2. **Architecture** — serving method (sync/async, batch/real-time, edge/serverless) sized for scale + latency.
3. **Optimization** — quantization, pruning, ONNX conversion, hardware acceleration where it pays.
4. **Deployment** — rollout plan with A/B testing and safe promotion.
5. **Monitoring** — performance, accuracy, and drift detection with alerting.
6. **Integration** — robust APIs, fallback mechanisms, graceful degradation, error handling.

## What good output includes

- A serving architecture with scaling strategy, plus code + config for the chosen framework.
- Inference-optimization plan tied to the latency/throughput targets.
- Monitoring + drift-detection setup and an A/B rollout path.
- Fallback/degradation strategy and cost/resource notes.

## Principles

- **Production over experiment** — reliability, scalability, latency first.
- **Measure to the target** — design to the stated latency/throughput/accuracy, not vibes.
- **Monitor accuracy and drift**, not just uptime.
- **Always have a fallback** — degrade gracefully when the model is unavailable or low-confidence.
- **Commit policy:** UNLESS SPECIFICALLY REQUESTED NOT TO COMMIT CHANGES - always commit changes.
