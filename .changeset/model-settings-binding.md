---
"@scenesystems/effect-lm": minor
"@scenesystems/effect-dsp": minor
"@scenesystems/effect-inference": minor
---

Add provider-independent model settings, semantic roles, and scoped model binding. Predictors apply their settings and invocation overrides to text and structured calls; ReAct applies predictor settings to tool calls. Optimizer model calls carry teacher, proposer, and critic roles. Mock language models and the reference recorder retain settings and rollout identity.

Hosted inference adds `ModelBinder.layer`, which selects `TextProvider.Runtime`s by role with task fallback and maps settings to provider configuration without replacing omitted defaults. Unsupported supplied settings fail with `AiError.InvalidRequestError` before transport runs: OpenAI Responses rejects stop and seed, Anthropic Messages rejects seed, and OpenRouter supports all declared settings. The direct `TextProvider` language-model layer applies the same contract to configured defaults: an unsupported default makes every operation of that layer fail with `InvalidRequestError` before HTTP instead of being silently dropped.
