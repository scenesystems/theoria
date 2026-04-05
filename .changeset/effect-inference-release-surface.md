---
"effect-inference": minor
---

Adds `effect-inference`, an Effect-native provider-blind inference substrate for text and embeddings runtimes.

- adds schema-owned runtime descriptors for requested runtime, resolved route, resolved runtime, and replay-safe runtime evidence
- adds stable route-family support for `OpenAiCompatible`, `OpenAiResponses`, `AnthropicMessages`, and `HuggingFace`
- adds live runtime helpers for Hugging Face, config-driven hosted-provider helpers, and embeddings-capable resolution
- adds `effect-inference/Testing` fixtures and helpers for downstream package contract tests
- documents explicit `v0.1` non-goals around Scene-specific policy, native-root runtime families, and multimodal lanes
