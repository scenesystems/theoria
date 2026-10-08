# effect-dsp

- DSP programs require native `effect/ai` services. Callers supply their
  implementations, including layers constructed by `effect-inference`.
- Each optimizer owns its options, lifecycle events, and operations; do not add an
  umbrella Optimizer namespace. Search owns samplers and optimization results;
  study owns generic lifecycle, persistence, and artifact delivery.
- Preserve generic Effect error and requirement channels in module `forward`,
  metrics, reducers, and optimizer callbacks.
- Demonstration replay validates through `Demonstration.Codec` compiled from the
  destination signature. Trace payloads use the lossless `Payload` codec and retain
  native AI usage.
- Public MIPROv2 concerns use that spelling; private paths use `miprov2`.
