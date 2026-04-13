---
"effect-inference": minor
---

Expand `effect-inference` from runtime provenance for individual model calls into a reusable workflow record system for larger agent and evaluation pipelines.

This release adds a shared contract family for describing workflow runs, sessions, execution records, evaluation reports, graph views, and score summaries. The goal is to make it easier for downstream apps to save, compare, replay, and explain full workflow outcomes without tying that data to one provider or one application.

It also rounds out the package documentation and release proofs so this workflow layer is something other packages can depend on confidently, not just an internal experiment.
