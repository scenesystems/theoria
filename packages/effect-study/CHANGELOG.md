# @scenesystems/effect-study

## 0.1.0

### Minor Changes

- [#118](https://github.com/scenesystems/theoria/pull/118) [`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc) Thanks [@aridyckovsky](https://github.com/aridyckovsky)! - Extract reusable evaluation, trial history, stop controls, scoped event streams, and schema-driven artifact persistence into `@scenesystems/effect-study`. Search retains optimization policies; DSP streams and fixed-profile text calibration consume the shared package directly.

  Require Effect v4 across study, search, DSP, and text. Preserve evaluator, objective, callback, stream, and codec failure and service channels rather than materializing them synchronously. Filesystem study and optimization storage requires Effect's `FileSystem` and `Path` services; schema reads and writes retain their independent decoding and encoding requirements. Stateful layers use `Layer.fresh`, so each acquisition allocates independent state; provide one acquired layer around operations that must share a run.

  `History.trials` is an Effect `HashMap`; use `History.values` for trial-number order. `StudyStorage.makeMemory` is an Effect: yield it or use `StudyStorage.layerMemory`. Instantiate exported option classes with `new`, including `new ArtifactContext.Options(...)` and `new StudyStorage.FileSystemOptions(...)`.

  Redesign study and search around canonical public concern modules with matching root namespaces and package subpaths. This is a breaking pre-1.0 API migration: replace the previous contracts, error barrels, nested public modules, and forwarding declarations rather than retaining compatibility aliases. Migrate DSP and text consumers to the redesigned APIs.

  Preserve buffered completion events and release interrupted search-state mutations without blocking subsequent work. Replacing a trial now replaces its recorded cost instead of counting it twice.

  Derive recursive custom artifact payloads from Schema without changing their public types. Preserve all string keys, including `__proto__`, when encoding and decoding nested payload records.

### Patch Changes

- Updated dependencies [[`e93d2f9`](https://github.com/scenesystems/theoria/commit/e93d2f9db068bebf89b1e516bff1a3e2929656fc)]:
  - @scenesystems/digest@0.7.0
