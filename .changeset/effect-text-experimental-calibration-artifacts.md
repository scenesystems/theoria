---
"effect-text": minor
---

Adds prepared text handles, richer layout APIs, browser helpers, and experimental calibration tools.

- adds prepared text handles and expands the pure layout API with cursor stepping, streaming line projection, variable-width layout, fit-vs-paint handling, and width-only reprojection
- improves Unicode and line breaking with deterministic segmentation fallback, bidi visual ordering, mirrored punctuation, and overflow precedence of `hard-break -> soft-hyphen -> dictionary-hyphen -> explicit-break -> grapheme-fallback`
- adds dictionary hyphenation for `en-us`, `en-gb`, `de`, `fr`, and `es`, including locale fallback and explicit soft-hyphen precedence
- adds `effect-text/browser` with canvas measurement layers, font-readiness helpers, support-manifest data, parity utilities, and checked-in parity artifacts for `canvas-monospace` and `canvas-system-ui`
- adds `effect-text/react` helpers for prepare identity and pure prepared-layout projection
- expands `Experimental.Calibration` with seeded `effect-search` studies, `StudySnapshot` artifacts, ordered `StudyEvent` logs, canonical calibration fixtures, and `effect-math`-backed scoring
- refreshes the README, examples, and generated docs to match the new browser, React, hyphenation, and calibration features
