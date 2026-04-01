---
"effect-dsp": patch
---

Align `effect-dsp` cache SQL wiring with the current shared cache surface from `effect-search`.

- rename the exported SQL cache layer from `DspCacheSqlite` to `DspCacheSql`
- delegate SQL-backed cache storage through `SchemaCacheSql`, which now accepts a caller-provided `SqlClient` layer instead of a SQLite directory helper
