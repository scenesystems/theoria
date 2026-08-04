# @scenesystems/effect-inference

## 0.2.0

### Minor Changes

- [#49](https://github.com/scenesystems/theoria/pull/49) [`873731c`](https://github.com/scenesystems/theoria/commit/873731ca75aad31ca46fd93d482eabbc0e8239af) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Raise the public Effect peer and provider dependency contracts to the latest stable Effect 3.22-compatible release train.

The scoped identity continues the release history of the former unscoped `effect-inference` package.

## 0.1.0

### Minor Changes

- [#25](https://github.com/scenesystems/theoria/pull/25) [`6d68855`](https://github.com/scenesystems/theoria/commit/6d6885574fba80385055e8b6c01c0b27ade8a05a) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Adds `effect-inference`, an Effect-native provider-blind inference substrate for text and embeddings runtimes.
  - adds schema-owned runtime descriptors for requested runtime, resolved route, resolved runtime, and replay-safe runtime evidence
  - adds stable route-family support for `OpenAiCompatible`, `OpenAiResponses`, `AnthropicMessages`, and `HuggingFace`
  - adds live runtime helpers for Hugging Face, config-driven hosted-provider helpers, and embeddings-capable resolution
  - adds `effect-inference/Testing` fixtures and helpers for downstream package contract tests
  - documents explicit `v0.1` non-goals around Scene-specific policy, native-root runtime families, and multimodal lanes
