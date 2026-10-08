import { Schema } from "effect"

const version = Schema.String.check(Schema.isPattern(/^3\.12\.\d+$/))

/**
 * Python `repr` text for finite floats; `NaN`, `Infinity` and `-Infinity` for the IEEE edges.
 * The parity test parses each token with `Number.parse` and fails on an unparseable token.
 */
const Float = Schema.String

/** CPython 3.12 builtin `sum` executed by `scripts/fixtures/cpython_sum.py`. */
export const CPythonSumFixture = Schema.Struct({
  fixture: Schema.Literal("cpython-sum"),
  metadata: Schema.Struct({
    generatedAt: Schema.String,
    generator: Schema.Struct({ script: Schema.String }),
    upstream: Schema.Struct({ name: Schema.Literal("cpython"), version })
  }),
  payload: Schema.Struct({
    runtime: Schema.Struct({
      implementation: Schema.Literal("CPython"),
      version,
      platform: Schema.String,
      byteorder: Schema.String,
      PYTHONHASHSEED: Schema.Literal("0"),
      NPY_DISABLE_CPU_FEATURES: Schema.String
    }),
    cases: Schema.NonEmptyArray(Schema.Struct({
      id: Schema.String,
      values: Schema.Array(Float),
      expected: Float
    }))
  })
})
