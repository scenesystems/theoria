---
"@scenesystems/sign": patch
---

`mlDsa65SignHedged` admits and copies its inputs when the Effect executes. An input that cannot be read — a detached `ArrayBuffer`, a proxy that raises on property access — fails with `SigningFailed` (`reason: "invalid input"`) instead of throwing while the Effect is being constructed, matching the direct verification functions.
