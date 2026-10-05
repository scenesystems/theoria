---
"@scenesystems/effect-study": minor
"@scenesystems/effect-search": minor
"@scenesystems/effect-dsp": minor
---

Provide fixed-input settled evaluation and serialized, awaited observations with native Effect failure and service channels. Expected evaluator failures remain trial data; defects, interruption, and observer failures terminate execution. Retained evidence never assigns grades or confirms remote cancellation.

Use run-bound `StudyStorage.open` recordings with stable append identities, optimistic cursors, definition identity, and checkpoint-plus-tail replay. Memory and strict single-writer filesystem stores retain caller codec services. Persistence and artifact delivery expose `PersistenceError.Failure`, distinguishing codec, backend, identity, cursor, and definition failures. Search storage specializes this recording protocol, and Search/DSP consumers retain infrastructure failures in their Effect channels.

Reserve artifact identities with a restored next sequence or caller-owned allocator. Allocation and payload delivery are separate; retries retain identity, gaps remain valid, and awaited fanout is sequential and non-transactional. `ArtifactContext.make`, `layer`, and `nextId` carry allocation failures.

Inspect `History.costs` for reported totals and counts of reported, missing, and invalid costs. Each trial contributes its current evidence once; known zero is distinct from missing cost. Runnable examples demonstrate caller grading and incomplete recording reconstruction without domain dependencies or external execution policy.
