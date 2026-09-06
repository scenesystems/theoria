---
"@scenesystems/effect-search": minor
---

Artifact persistence fails loud. `ArtifactSink.emit`, `StudyStorage`, `EventPublisher.publish`, `readEnvelopeLog`, `ObjectiveTrialRuntime.report` and `requestStop`, `InterruptionSnapshotSink`, and the study runtime that calls them carry `ArtifactStorageError` (`operation: "write" | "read"`, `path`, `detail`) in the typed error channel instead of discarding filesystem and encoding failures. A study whose envelope log cannot be written now fails with that error; previously it completed with a silently truncated log. `ArtifactStorageError` is a member of `StudyErrorSchema` and `SearchErrorSchema`. `ObjectiveTrialRuntime.report` is typed `InvalidObjectiveReport | ArtifactStorageError` instead of `unknown`.

`readEnvelopeLog` is strict: every non-blank line must decode as an artifact envelope, and any that does not, including a torn final line left by a crash mid-append, fails the read with an `ArtifactStorageError` naming the line and the decoding issues. Previously invalid lines were skipped without notice. A log that does not exist yet still reads as empty. A study resumed from a torn or corrupt log therefore fails with `ArtifactStorageError` rather than silently continuing from a partial history.

An `ArtifactStorageError` raised while an objective reports through `ObjectiveTrialRuntime.report` or `requestStop` is the study's failure, not the trial's: it is not wrapped in `TrialError`, not retried by the trial retry schedule, and fails the study with the write error intact.

The trial retry loop decides on the whole cause of an attempt, not its first typed failure. An attempt is retried only when its cause is nothing but trial failures; a cause that also carries a storage error, a defect, or an interruption passes through intact and unretried, and an exhausted schedule fails with the last attempt's complete cause. A failed trial whose cause holds more than a single trial failure, such as an objective failure followed by a finalizer defect, or alongside an interruption, records a `TrialError` whose `cause` is that whole cause rather than the first failure alone.

A trial whose objective exceeds `trialTimeout` is `Cancelled` only when its interrupted fiber exits with nothing but that interruption. Anything else the objective died from on its way out, such as a rejected report a cleanup finalizer escalated with `orDie`, now finalizes the trial as `Failed` with that cause instead of being discarded as a timeout.

`Study` exports `EventPublisher`, whose type already appeared in `ExecuteRequest`.

The checkpoint written when a study fails or is interrupted runs uninterruptibly with a typed error channel: a checkpoint that cannot be written is sequenced after the study's own cause in the `Exit`, so typed handlers see the study's failure and the lost recovery point is not hidden.

`TerminalSink.supportsAnsi` is `Effect<boolean>`: a capability probe that can fail is resolved by the caller, and the reporter no longer falls back to plain text on an unobserved failure.

These widen public error types, which is a breaking change under 0.x semver, hence a minor release.

`Pareto.objectiveHoldingWeights` is removed. It was an exact alias of `objectiveFrontierWeights`, which remains the single frontier-weight entrypoint; callers rename the import.

`SearchSpace.unsafeMake` and `SearchSpace.unsafeMakeConditional` are removed. `SearchSpace.make` and `SearchSpace.makeConditional` are the only constructors; an invalid declaration is an `InvalidSearchSpace` in the error channel, never a defect raised through a synchronous runtime. The experimental scenario fixtures follow: `makeSlotSpace`, `makePromptCategoricalSpace`, `makeMixedOptimizerSpace`, `makeRandomTrainingSpace`, `makeLogLearningRateSpace`, and `makeLinearTreeConditionalSpace` return that Effect, and their config decoders (`decodeSlotConfig`, `decodePromptCategoricalConfig`, `decodeMixedOptimizerConfig`, `decodeRandomTrainingConfig`, `decodeLogLearningRateConfig`, `decodeLinearTreeConditionalConfig`) are `Schema.decodeUnknown` Effects; the throwing variants and the `*Effect`-suffixed duplicates are gone.
