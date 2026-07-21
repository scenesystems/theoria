---
"effect-search": minor
---

Adopt the strict digest 0.3 text and error contracts for cache fingerprinting.

- Replace the re-exported `FingerprintUnsupportedValue` with the closed, package-owned `RuntimeFingerprintError` for runtime-only value rejection.
- Propagate digest's `InvalidUnicode` directly from runtime fingerprint text encoding instead of replacement-encoding malformed UTF-16.
- Continue exposing digest's `CanonicalizationError` directly from durable JCS fingerprint operations.
