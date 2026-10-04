---
"@scenesystems/seal": minor
---

Migrate authenticated encryption to Effect v4 with `Cipher` and `Envelope` concern namespaces and public subpaths. Provide `Cipher.layer` at the host boundary; `Cipher.generateKey` produces a fresh 32-byte key on each execution.

`Cipher.encrypt` returns schema-backed `Cipher.Encrypted` with separate algorithm, nonce, and ciphertext fields. Ciphertext includes its authentication tag. `Cipher.decrypt(encrypted, key)` validates exact nonce and minimum tag lengths before authenticating. Remove the packed-byte API, including `Envelope.fromBytes` and `Envelope.toBytes`, rather than retain concatenation/slicing adapters.

`Envelope.Envelope` is now an Effect codec between `Cipher.Encrypted` and base64url string fields. `Envelope.encrypt` returns that encoded transport record; `Envelope.decrypt` decodes and authenticates it. Unknown data enters through schema admission. No legacy aliases remain.

Preserve key policy, fresh cryptographic entropy, non-mutating inputs, material-free typed failures, and independent known-answer vectors. Schema validates existing bytes; Effect codecs own transport conversion. No native byte-operation exception or compatibility codec is introduced.
