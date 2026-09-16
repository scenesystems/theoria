---
"@scenesystems/effect-text": minor
---

Redesign the public API around Text, TextMeasurer, MeasurementCache, Hyphenation,
CanvasTextMeasurer, CanvasProfile, PreparationKey, and Calibration. Each concern
has matching root namespace and PascalCase subpath imports. Remove the previous
Browser, React, contracts, and experimental entrypoints rather than retaining
compatibility aliases.

Use Text.summary for aggregate geometry, Text.lines for materialized lines,
Text.layout for both, and Text.nextLine, Text.stream, and Text.ranges for incremental
projections. Supply native Context services and Layers for measurement and
hyphenation. PreparationKey owns structural preparation identity and font revision
invalidation. Calibration owns profile evaluation and resumable optimization.

Preserve scoped measurement caching and cancellation semantics, Unicode grapheme
boundaries, and dictionary hyphenation. Correct canvas emoji compensation for
graphemes containing combining marks. Migrate examples and the Theoria application
to the canonical APIs.
