---
"effect-text": minor
---

Hardens the shipped `effect-text` `v0.2` release surface around one prepare-once, layout-many story.

- lands the runtime-kernel rewrite behind pure prepared-layout projection, including shipped bidi visual ordering, mirrored punctuation, browser-backed parity profiles, and dictionary hyphenation for `en-us`, `en-gb`, `de`, `fr`, and `es`
- ships browser and React companion subpaths with explicit boundary ownership: `effect-text/browser` owns support data, measurement, freshness, and parity helpers; `effect-text/react` owns prepare-identity composition plus pure projection helpers
- integrates seeded `effect-search` studies with `StudySnapshot` artifacts and ordered `StudyEvent` logs, while routing calibration scoring through internal `effect-math` adapters for weighted loss aggregation and summary statistics without leaking those types into the stable package surface
- adds a checked-in release support manifest plus package-owned verification commands so browser coverage, overflow policy, bidi mirror coverage, hyphenation locale claims, benchmark thresholds, README claims, and proof scripts stay aligned
- updates the examples, public API governance, release notes, and Theoria consumer proof so the shipped browser/runtime/experimental story is concrete, test-backed, and release-accurate
