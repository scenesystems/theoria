---
"@scenesystems/seal": minor
---

Teach sealed envelopes how to carry lightweight key-selection hints.

This release adds optional metadata such as `keyId` and `keyVersion` so applications doing key rotation or multi-key lookup can tell which key an envelope was meant for without changing the encrypted payload itself.
