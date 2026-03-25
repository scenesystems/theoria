---
"@scenesystems/digest": minor
---

Add streaming digest APIs for chunked hashing workflows in Effect applications.

New exports include `digestByteStream`, `digestUtf8Stream`, `digestByteStreamBase64Url`, and `digestByteStreamHex`, enabling incremental hashing over `Stream` inputs while preserving one-shot digest parity and encoded-output consistency.
