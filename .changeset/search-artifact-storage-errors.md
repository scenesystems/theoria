---
"@scenesystems/effect-search": patch
---

Artifact persistence fails loud. `ArtifactSink.emit`, `StudyStorage`, `EventPublisher.publish`, `readEnvelopeLog` and the study runtime that calls them carry a new `ArtifactStorageError` (`operation: "write" | "read"`, `path`, `detail`) in the typed error channel instead of discarding filesystem and encoding failures. A study whose envelope log cannot be written now fails with that error; previously it completed with a silently truncated log. `ArtifactStorageError` is a member of `StudyErrorSchema` and `SearchErrorSchema`.

A log that does not exist yet still reads as empty, and torn or schema-invalid lines are still skipped as crash residue. The checkpoint written when a study fails or is interrupted runs uninterruptibly with a typed error channel: a checkpoint that cannot be written is sequenced after the study's own cause in the `Exit`, so typed handlers see the study's failure and the lost recovery point is not hidden.
