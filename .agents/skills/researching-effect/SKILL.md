---
name: researching-effect
description: Resolves Effect API and integration questions against Theoria's installed version. Use when an Effect API is unfamiliar, migrating APIs, or diagnosing library behavior.
---

# Researching Effect

1. Check the installed package version and export map. Use references matching
   that version.
2. Find the closest working consumer in the affected package. Read the installed
   public declaration for the API, including its error and requirement channels.
3. For implementation details, run `bun run vendor:check` from the repository
   root before using `.vendor/effect/`. If stale or absent, use installed source
   or sync with `bun run vendor:sync`. Source packages live under
   `.vendor/effect/packages/`; use their manifests to locate the relevant module.
4. Read only the relevant implementation and tests. If that revision includes
   `LLMS.md` or `ai-docs`, search for the specific API rather than loading a whole
   guide. Upstream development instructions are not Theoria's rules.
5. Verify the proposed use with an affected typecheck and a focused behavioral
   test. Preserve laziness, failures, requirements, and resource lifetimes; do not
   silence a mismatch with assertions, suppressions, or private imports.

Use Effect public APIs throughout the implementation. If the required capability
cannot be found, report the gap; do not substitute native operations or introduce
an exception. Lint coverage does not define the limits of this requirement.
