---
"@scenesystems/sign": minor
---

Redesign the public API around Effect concern namespaces and matching PascalCase subpaths. Remove flat algorithm functions, generic dispatch, obsolete schemas/error barrels, and compatibility paths. Select suites explicitly (`Ed25519.sign`, `Rsa.verify`, `X25519.deriveSharedSecret`, `XWing.encapsulate`); verification always takes an independently selected public key.

Key generation, randomized signing, and encapsulation now require `Entropy.Entropy`. Provide `Entropy.layer` at the host boundary; deterministic signing, verification, agreement, and decapsulation remain entropy-free. Replace `generateEntropy()` with `Entropy.bytes(length)`, `utf8ToBytes` with `Bytes.fromString`, `equalBytes` with `Bytes.equal`, and `toHex` with `Hex.encode` from `effect/encoding`.

Models and failures move to their canonical concerns, including `KeyPair.KeyPair`, `Signature.Signature`, `XWing.Encapsulation`, and `Verification.InvalidInput`/`Unavailable`. Preserve cryptographic profiles, wire discriminators, strict admission, independent conformance fixtures, and JWT policy. This is a breaking pre-1.0 minor release; no aliases are retained. See the README for migration and entropy composition examples.

`Bytes.fromString` now returns an Effect and performs lazy UTF-8 encoding with a fresh allocation on every execution. `Bytes.collect` explicitly provides bounded buffered collection for byte streams, preserving upstream failures, requirements, interruption, and finalization while enforcing the inclusive 8,192-byte verification policy before traversing each chunk. It does not incrementally sign or alter signature modes.

Require Effect v4. Zero-argument key generators are lazy Effect values rather than functions; yield them without `()`, with fresh entropy drawn on every execution. Use v4 Schema codecs and lift encoding Results with `Effect.fromResult`. JWT application codecs retain their decoding services and interruption behavior. Byte-backed models preserve reference-sensitive equality and hashing instead of adopting v4's default structural byte comparison.

`Entropy.GenerationFailed.length` now represents non-finite requests as `"NaN"`, `"Infinity"`, or `"-Infinity"`; finite requests remain numbers. Invalid requests stay typed failures with JSON-safe diagnostics and strict numeric schemas.
