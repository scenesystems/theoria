---
"@scenesystems/digest": minor
---

Add the branded `UnicodeScalar` Schema and `fromUnicodeScalar(number): Effect<string, ParseError>`. Construct one scalar through native Effect APIs, preserving U+FEFF and supplementary characters without normalization. Reject surrogates, non-integers, and values outside U+0000–U+10FFFF. XML entity syntax and character restrictions remain caller responsibilities.

Move shared Unicode validation, UTF-8 byte counting, and streamed surrogate handling to native Effect APIs while preserving absolute error indices, chunk-independent results, interruption, and finalization.
