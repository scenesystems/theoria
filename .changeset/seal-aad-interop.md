---
"@scenesystems/seal": minor
---

Add first-class support for associated data to `@scenesystems/seal`.

This lets you bind extra context — such as protocol names, record identifiers, or routing metadata — to encrypted data so that context is authenticated along with the ciphertext without being stored inside it. If the context does not match on the way back out, unsealing fails instead of silently accepting the wrong message.

The release also adds the matching typed failure, examples, and runtime-proof coverage so this authenticated-but-not-encrypted context flow is documented and tested as a normal part of the package.
