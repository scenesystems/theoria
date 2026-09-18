---
"@scenesystems/sign": minor
---

Redesign the public API around Effect concern namespaces and matching PascalCase subpaths. Remove flat algorithm functions, generic dispatch, obsolete schemas/error barrels, and compatibility paths. Select suites explicitly (`Ed25519.sign`, `Rsa.verify`, `X25519.deriveSharedSecret`, `XWing.encapsulate`); verification always takes an independently selected public key.

Key generation, randomized signing, and encapsulation now require `Entropy.Entropy`. Provide `Entropy.layer` at the host boundary; deterministic signing, verification, agreement, and decapsulation remain entropy-free. Replace `generateEntropy()` with `Entropy.bytes(length)`, `utf8ToBytes` with `Bytes.fromString`, `equalBytes` with `Bytes.equal`, and `toHex` with Effect's `Encoding.encodeHex`.

Models and failures move to their canonical concerns, including `KeyPair.KeyPair`, `Signature.Signature`, `XWing.Encapsulation`, and `Verification.InvalidInput`/`Unavailable`. Preserve cryptographic profiles, wire discriminators, strict admission, independent conformance fixtures, and JWT policy. This is a breaking pre-1.0 minor release; no aliases are retained. See the README for migration and entropy composition examples.
