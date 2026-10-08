import { Schema } from "effect"

const metadata = Schema.Struct({
  generatedAt: Schema.String,
  generator: Schema.Struct({ script: Schema.String }),
  upstream: Schema.Struct({ name: Schema.Literals(["cpython", "numpy"]), version: Schema.String })
})

export const CPythonRandomFixture = Schema.Struct({
  fixture: Schema.Literal("cpython-random"),
  metadata,
  payload: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      seed: Schema.String,
      random: Schema.Array(Schema.Finite),
      bits: Schema.Array(Schema.Struct({ k: Schema.Int, value: Schema.String })),
      below: Schema.Array(Schema.Struct({ n: Schema.String, values: Schema.Array(Schema.String) })),
      integers: Schema.Array(Schema.Struct({ a: Schema.Int, b: Schema.Int, values: Schema.Array(Schema.Int) })),
      choices: Schema.Array(Schema.String),
      shuffles: Schema.Array(Schema.Array(Schema.Int)),
      samples: Schema.Array(Schema.Struct({ n: Schema.Int, k: Schema.Int, value: Schema.Array(Schema.Int) })),
      tail: Schema.Array(Schema.Finite)
    }))
  })
})

export const NumPyRandomFixture = Schema.Struct({
  fixture: Schema.Literal("numpy-random"),
  metadata,
  payload: Schema.Struct({
    cases: Schema.Array(Schema.Struct({
      seed: Schema.Int,
      random: Schema.Array(Schema.Finite),
      batches: Schema.Array(Schema.Struct({ size: Schema.Int, values: Schema.Array(Schema.Finite) })),
      uniform: Schema.Array(
        Schema.Struct({ low: Schema.Finite, high: Schema.Finite, values: Schema.Array(Schema.Finite) })
      ),
      choices: Schema.Array(Schema.Struct({ p: Schema.Array(Schema.Finite), values: Schema.Array(Schema.Int) })),
      boundaries: Schema.Array(Schema.Struct({
        p: Schema.Array(Schema.Finite),
        accepted: Schema.Boolean,
        values: Schema.Array(Schema.Int)
      })),
      tail: Schema.Array(Schema.Finite)
    }))
  })
})
