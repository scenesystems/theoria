---
"@scenesystems/effect-dsp": minor
---

Add stable predictor paths, shared predictors, trainable and frozen parameters, immutable parameter snapshots, scoped execution overlays, bound programs, and explicit parameter installation. Introduce the generic Optimized.Result contract for algorithm-specific reports.

Modules and predictors expose their parameter references as `parameters`; bound program defaults use `boundParameters`. Cache requests use `parameters` and cache keys use `parametersHash`.

Breaking: the module structure vocabulary is renamed without aliases. `Module.Node` is now `Module.Structure` (`moduleId` → `id`, `params` → `parameters`, `NodeSignature` → `Signature.Text`); `Module.Declaration` is now `Module.SubModule` (`declaredId`/`child` → `name`/`module`); `Module.nodeGraph` is now `Module.structure`; `Module.Registration` (tag `ModuleRegistration`) is now `Module.Discovered` (tag `ModuleDiscovered`); `Module.NodeSignature` is removed; `ComposeForwardContext.subModuleNodes` is now `subModules`.

Composition rejects empty/dotted aliases, colliding canonical paths and conflicting bound defaults for one shared predictor with CompositionError. Equivalent defaults are accepted independently of alias order; outer bound maps resolve any alias of a predictor. Immutable parameter updates omit absent generation settings rather than producing undefined-valued cache identity fields.
