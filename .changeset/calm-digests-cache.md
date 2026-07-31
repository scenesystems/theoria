---
"@scenesystems/digest": patch
---

Allow dense arrays carrying own non-enumerable symbol-keyed data metadata to retain the exact RFC 8785 canonical text and bytes of undecorated arrays. Symbol accessors, enumerable array symbols, record symbols, and string-keyed array extras remain rejected.
