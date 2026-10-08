---
name: researching-effect
description: Resolves Effect API and integration questions using version-aligned sources. Use when an API is unfamiliar or library behavior is uncertain.
---

# Researching Effect

1. Establish the installed version and public exports. Find a relevant consumer,
   then read the API declaration; do not treat existing usage as proof of correctness.
2. For unresolved behavior, read the matching implementation and tests. Check
   vendored version alignment before relying on it. Search for the specific API
   rather than loading entire guides or unrelated upstream instructions.
3. Check laziness, error and requirement channels, resource ownership, and
   interruption behavior against the intended use.
4. For implementation changes, run a focused typecheck and relevant behavioral
   tests. Add a regression case only for behavior not already covered, not a new
   harness to certify API usage. Do not hide mismatches with assertions,
   suppressions, or private imports.

If the needed capability cannot be found in Effect public APIs, report the gap.
Do not substitute native operations or introduce an exception.
