---
"effect-search": minor
---

Make long-running optimization studies easier to inspect, pause, and recover.

This release adds clearer diagnostics around what samplers and studies are doing, along with stronger recovery support for work that stretches across many trials or long evaluation windows. It improves the package’s ability to keep track of pending work, resume from saved state, and preserve the useful context you need when a study is restarted.

It also improves the public recovery story for ask/tell-style workflows, so teams running evaluation loops outside the package can reconnect to an in-flight search more safely.
