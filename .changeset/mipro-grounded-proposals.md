---
"@scenesystems/effect-dsp": minor
---

Align MIPROv2 grounded instruction proposals with DSPy 3.4.0: cached dataset summaries, program and predictor descriptions, augmented demonstration rotation, awareness flags, and a shared CPython stream for tips and rollout IDs. Generate proposal zero before preserving the original instruction. Replace cache-marker and cyclic-tip options with grounded proposer settings and recorded rollout partitions.

Program-aware proposals use a bounded, language-native prompt representation. The program description input is derived from Module.Structure predictor paths and signature text, not Python source. The DescribeModule `module` input is a JSON document with the predictor's canonical path, name, signature description, effective instructions and effective field prefix/description overrides, read through parameter overlays. It does not reproduce DSPy's Python `Predict(inputs) -> outputs` rendering or list the signature's input and output fields, and prompts are not byte-identical to upstream.

Breaking: `MIPROv2.Options.tipVocabulary` and `MIPROv2.TipVocabulary` are removed; `tipAwareProposer` draws upstream tips from the shared seeded stream. `MIPROv2Candidates.InstructionCandidate.cacheBustMarker` is removed; proposals carry `rolloutId` instead. No aliases are provided.

Persist `Demonstration.augmented` as a required boolean with constructor default false, marking only teacher-generated evidence true. Demonstration equivalence remains encoded input/output based. Direct ParameterSet imports support round-tripping the new demonstration shape without an initialization cycle.
