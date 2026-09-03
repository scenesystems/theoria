---
"@scenesystems/effect-math": patch
---

Add scalar helpers to `Numeric`: `isFinite`, `min`, `max`, `abs`, `sqrt`, `pi`, `sin`, `cos`, `log10`, `pow`, `round`, `floor`, `ceil`, and `truncate`. `floor`, `ceil`, and `truncate` compute through `BigDecimal` for finite inputs and return non-finite inputs unchanged.
