---
"@scenesystems/seal": minor
---

Teach sealed envelopes how to carry lightweight key-selection hints.

This release adds optional metadata such as `keyId` and `keyVersion` so applications doing key rotation or multi-key lookup can tell which key an envelope was meant for without changing the encrypted payload itself.

Existing envelopes continue to unseal as before, and the docs now show the intended transport and rotation workflow for teams that need to manage more than one active key.
