---
"@scenesystems/effect-search": minor
---

Artifact persistence fails loud. `ArtifactSink.emit`, `StudyStorage`, `EventPublisher.publish`, `readEnvelopeLog`, `ObjectiveTrialRuntime.report` and `requestStop`, `InterruptionSnapshotSink`, and the study runtime that calls them carry `ArtifactStorageError` (`operation: "write" | "read"`, `path`, `detail`) in the typed error channel instead of discarding filesystem and encoding failures. A study whose envelope log cannot be written now fails with that error; previously it completed with a silently truncated log. `ArtifactStorageError` is a member of `StudyErrorSchema` and `SearchErrorSchema`. `ObjectiveTrialRuntime.report` is typed `InvalidObjectiveReport | ArtifactStorageError` instead of `unknown`.

`readEnvelopeLog` tolerates exactly one torn line, the final one, because an append-only log interrupted mid-write legitimately ends that way. An undecodable line anywhere before the end is corruption and fails the read with an `ArtifactStorageError` naming the line; previously every invalid line was skipped without notice. A log that does not exist yet still reads as empty.

The checkpoint written when a study fails or is interrupted runs uninterruptibly with a typed error channel: a checkpoint that cannot be written is sequenced after the study's own cause in the `Exit`, so typed handlers see the study's failure and the lost recovery point is not hidden.

`TerminalSink.supportsAnsi` is `Effect<boolean>`: a capability probe that can fail is resolved by the caller, and the reporter no longer falls back to plain text on an unobserved failure.

These widen public error types, which is a breaking change under 0.x semver, hence a minor release.
