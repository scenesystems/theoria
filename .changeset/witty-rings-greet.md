---
"@scenesystems/digest": minor
---

Add streaming digest APIs for chunked hashing workflows in Effect applications.

New exports include `digestByteStream`, `digestUtf8Stream`, `digestUtf8StreamBase64Url`, `digestUtf8StreamHex`, `digestByteStreamBase64Url`, and `digestByteStreamHex`, enabling incremental hashing over `Stream` inputs while preserving one-shot digest parity and encoded-output consistency.

This release also adds `DigestStreaming` and `DigestStreamingLive` so streaming helpers can be injected via Effect layers, and ensures repeated execution of the same streaming digest effect remains safe.
