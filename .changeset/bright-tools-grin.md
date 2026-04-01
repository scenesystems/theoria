---
"effect-search": patch
---

Harden advanced sampler determinism and shared SQL cache integration in `effect-search`.

- preserve GP-BO deterministic replay by consuming seeded RNG draws only for Thompson sampling and by reusing a single Cholesky factor during posterior construction
- replace the SQLite-runtime-specific `SchemaCacheSqlite` helper with `SchemaCacheSql`, which accepts a caller-provided `SqlClient` layer for shared cache storage
- keep advanced sampler fixture verification wired into the committed Optuna parity suite so cache and sampler regressions are caught together
