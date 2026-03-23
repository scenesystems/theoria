import { Array as Arr, Data, Effect, Option, Schema } from "effect"
import { readdirSync, readFileSync } from "fs"
import path from "path"
import { fileURLToPath } from "url"

export const GepaFixtureNameSchema = Schema.Literal(
  "gepa.pareto.score-matrix.basic",
  "gepa.pareto.score-matrix.ties",
  "gepa.selection.weights.seed-42",
  "gepa.merge.common-ancestor-cases",
  "gepa.reflect.dataset-shape"
)

export type GepaFixtureName = typeof GepaFixtureNameSchema.Type

export const GepaFixtureManifestSchema = Schema.Struct({
  fixtureSet: Schema.Literal("gepa"),
  version: Schema.Literal(1),
  fixtures: Schema.Array(
    Schema.Struct({
      name: GepaFixtureNameSchema,
      file: Schema.String
    })
  )
})

export type GepaFixtureManifest = typeof GepaFixtureManifestSchema.Type

const ParetoHoldingSchema = Schema.Struct({
  exampleIndex: Schema.Number,
  bestScore: Schema.Number,
  holders: Schema.Array(Schema.Number)
})

const SelectionWeightSchema = Schema.Struct({
  candidateIndex: Schema.Number,
  weight: Schema.Number
})

const SamplingSchema = Schema.Struct({
  seed: Schema.Number,
  draws: Schema.Number,
  tolerance: Schema.Number
})

export const GepaParetoScoreMatrixFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("gepa.pareto.score-matrix.basic", "gepa.pareto.score-matrix.ties"),
  payload: Schema.Struct({
    objectiveDirection: Schema.Literal("maximize"),
    scores: Schema.Array(Schema.Array(Schema.Number)),
    expectedFrontierIndices: Schema.Array(Schema.Number),
    expectedDominatedIndices: Schema.Array(Schema.Number),
    expectedHoldings: Schema.Array(ParetoHoldingSchema),
    expectedSelectionWeights: Schema.Array(SelectionWeightSchema),
    sampling: SamplingSchema
  })
})

export const GepaSelectionWeightsFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("gepa.selection.weights.seed-42"),
  payload: Schema.Struct({
    seed: Schema.Number,
    draws: Schema.Number,
    tolerance: Schema.Number,
    weights: Schema.Array(SelectionWeightSchema),
    expectedProbabilities: Schema.Array(
      Schema.Struct({
        candidateIndex: Schema.Number,
        probability: Schema.Number
      })
    )
  })
})

const MergeCandidateSchema = Schema.Struct({
  candidateId: Schema.String,
  parentIds: Schema.Array(Schema.String),
  predictorInstructions: Schema.Array(
    Schema.Struct({
      predictorName: Schema.String,
      instruction: Schema.String
    })
  )
})

const MergeComparisonSchema = Schema.Struct({
  exampleId: Schema.String,
  parentAScore: Schema.Number,
  parentBScore: Schema.Number
})

export const GepaMergeCommonAncestorFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("gepa.merge.common-ancestor-cases"),
  payload: Schema.Struct({
    seed: Schema.Number,
    parentAId: Schema.String,
    parentBId: Schema.String,
    expectedCommonAncestorId: Schema.String,
    expectedBalancedSubsampleIds: Schema.Array(Schema.String),
    candidates: Schema.Array(MergeCandidateSchema),
    comparisons: Schema.Array(MergeComparisonSchema)
  })
})

const ReflectSampleSchema = Schema.Struct({
  exampleId: Schema.String,
  predictorName: Schema.String,
  inputs: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  generatedOutputs: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  expectedOutput: Schema.Record({ key: Schema.String, value: Schema.Unknown }),
  metricResult: Schema.Struct({
    score: Schema.Number,
    feedback: Schema.optional(Schema.String)
  })
})

export const GepaReflectDatasetFixtureSchema = Schema.Struct({
  fixture: Schema.Literal("gepa.reflect.dataset-shape"),
  payload: Schema.Struct({
    predictorName: Schema.String,
    currentInstruction: Schema.String,
    samples: Schema.Array(ReflectSampleSchema),
    expectedPromptSections: Schema.Array(Schema.String)
  })
})

export const GepaKnownFixtureSchema = Schema.Union(
  GepaParetoScoreMatrixFixtureSchema,
  GepaSelectionWeightsFixtureSchema,
  GepaMergeCommonAncestorFixtureSchema,
  GepaReflectDatasetFixtureSchema
)

export type GepaKnownFixture = typeof GepaKnownFixtureSchema.Type

export class GepaFixtureManifestReadError extends Data.TaggedError("GepaFixtureManifestReadError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export class GepaFixtureDecodeError extends Data.TaggedError("GepaFixtureDecodeError")<{
  readonly path: string
  readonly cause: unknown
}> {}

export class GepaFixtureNotFoundError extends Data.TaggedError("GepaFixtureNotFoundError")<{
  readonly fixture: GepaFixtureName
}> {}

export type GepaFixtureError = GepaFixtureManifestReadError | GepaFixtureDecodeError | GepaFixtureNotFoundError

export const GEPA_FIXTURE_ROOT = new URL("../../fixtures/gepa/", import.meta.url)
export const GEPA_MANIFEST_FILE = "manifest.json"

const GEPA_FIXTURE_ROOT_PATH = fileURLToPath(GEPA_FIXTURE_ROOT)
const decodeJsonUnknown = Schema.decodeUnknown(Schema.parseJson(Schema.Unknown))

const readJsonUnknown = (fileUrl: URL): Effect.Effect<unknown, GepaFixtureDecodeError | GepaFixtureManifestReadError> =>
  Effect.sync(() => readFileSync(fileUrl, "utf8")).pipe(
    Effect.mapError((cause) => new GepaFixtureManifestReadError({ path: fileUrl.toString(), cause })),
    Effect.flatMap((raw) =>
      decodeJsonUnknown(raw).pipe(
        Effect.mapError((cause) => new GepaFixtureDecodeError({ path: fileUrl.toString(), cause }))
      )
    )
  )

export const loadGepaManifest = (
  rootUrl: URL = GEPA_FIXTURE_ROOT,
  manifestFileName: string = GEPA_MANIFEST_FILE
): Effect.Effect<GepaFixtureManifest, GepaFixtureDecodeError | GepaFixtureManifestReadError> =>
  readJsonUnknown(new URL(manifestFileName, rootUrl)).pipe(
    Effect.flatMap((payload) =>
      Schema.decodeUnknown(GepaFixtureManifestSchema)(payload).pipe(
        Effect.mapError((cause) =>
          new GepaFixtureDecodeError({ path: new URL(manifestFileName, rootUrl).toString(), cause })
        )
      )
    )
  )

const loadGepaFixtureByEntry = (
  rootUrl: URL,
  entry: GepaFixtureManifest["fixtures"][number]
): Effect.Effect<GepaKnownFixture, GepaFixtureDecodeError | GepaFixtureManifestReadError> =>
  readJsonUnknown(new URL(entry.file, rootUrl)).pipe(
    Effect.flatMap((payload) =>
      Schema.decodeUnknown(GepaKnownFixtureSchema)(payload).pipe(
        Effect.mapError((cause) => new GepaFixtureDecodeError({ path: new URL(entry.file, rootUrl).toString(), cause }))
      )
    ),
    Effect.flatMap((fixture) =>
      fixture.fixture === entry.name
        ? Effect.succeed(fixture)
        : Effect.fail(
          new GepaFixtureDecodeError({
            path: new URL(entry.file, rootUrl).toString(),
            cause: `Fixture name mismatch: expected ${entry.name}, received ${fixture.fixture}`
          })
        )
    )
  )

const resolveFixtureEntry = (
  manifest: GepaFixtureManifest,
  fixtureName: GepaFixtureName
): Effect.Effect<GepaFixtureManifest["fixtures"][number], GepaFixtureNotFoundError> =>
  Option.match(Arr.findFirst(manifest.fixtures, (entry) => entry.name === fixtureName), {
    onNone: () => Effect.fail(new GepaFixtureNotFoundError({ fixture: fixtureName })),
    onSome: (entry) => Effect.succeed(entry)
  })

export const loadGepaFixture = (
  fixtureName: GepaFixtureName,
  rootUrl: URL = GEPA_FIXTURE_ROOT
): Effect.Effect<GepaKnownFixture, GepaFixtureError> =>
  loadGepaManifest(rootUrl).pipe(
    Effect.flatMap((manifest) => resolveFixtureEntry(manifest, fixtureName)),
    Effect.flatMap((entry) => loadGepaFixtureByEntry(rootUrl, entry))
  )

export const validateGepaFixtureManifest = (
  rootUrl: URL = GEPA_FIXTURE_ROOT,
  manifestFileName: string = GEPA_MANIFEST_FILE
): Effect.Effect<void, GepaFixtureError> =>
  loadGepaManifest(rootUrl, manifestFileName).pipe(
    Effect.flatMap((manifest) =>
      Effect.forEach(manifest.fixtures, (entry) => loadGepaFixtureByEntry(rootUrl, entry), { discard: true })
    )
  )

const listJsonFiles = (rootPath: string, prefix: string): ReadonlyArray<string> => {
  const directory = prefix === "" ? rootPath : path.join(rootPath, prefix)

  return Arr.flatMap(readdirSync(directory, { withFileTypes: true }), (entry) => {
    const relativePath = prefix === "" ? entry.name : `${prefix}/${entry.name}`

    return entry.isDirectory()
      ? listJsonFiles(rootPath, relativePath)
      : entry.name.endsWith(".json")
      ? Arr.make(relativePath)
      : Arr.empty<string>()
  })
}

export const listGepaFixtureJsonFiles = (
  rootPath: string = GEPA_FIXTURE_ROOT_PATH
): Effect.Effect<ReadonlyArray<string>> => Effect.sync(() => listJsonFiles(rootPath, ""))
