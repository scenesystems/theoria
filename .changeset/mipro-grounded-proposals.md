---
"@scenesystems/effect-dsp": minor
---

MIPROv2 uses dataset summaries, program descriptions and teacher-generated demonstrations to propose instructions, following DSPy 3.4.0's recorded proposal sequence. Proposal zero is generated before being replaced by the original instruction. Settings and rollout IDs control proposal generation and caching.

Program descriptions use `Module.Structure` predictor paths and signature text. Predictor descriptions include effective instructions and field metadata in a JSON document. They omit the input/output field list used by DSPy's Python signature representation, so these prompts are not byte-identical to upstream.

Breaking: `MIPROv2.Options.tipVocabulary` and `MIPROv2.TipVocabulary` are removed; `tipAwareProposer` draws upstream tips from the shared seeded stream. `MIPROv2Candidates.InstructionCandidate.cacheBustMarker` is removed; proposals carry `rolloutId` instead. No aliases are provided.

Persisted demonstrations require an `augmented` boolean; the constructor defaults it to false. Only teacher-generated evidence sets it to true. Demonstration equivalence still compares encoded inputs and outputs. Direct `ParameterSet` imports can round-trip this demonstration shape.
