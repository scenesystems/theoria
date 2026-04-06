/**
 * Shared report contract for optimization examples.
 *
 * Structured data (summary, events, module-state) is emitted as Custom
 * artifact envelopes through ArtifactSink. The markdown report is derived
 * presentation written directly to disk.
 */
import { FileSystem, Path } from "@effect/platform"
import { Array as Arr, Effect, Option, Schema } from "effect"
import { artifactDirectoryForExample, emitCustomEnvelope, type ExampleArtifacts } from "./output-artifacts.js"

const REPORT_FILE_NAME = "report.md"
const SUMMARY_FILE_NAME = "summary.json"
const EVENTS_FILE_NAME = "events.json"
const MODULE_STATE_FILE_NAME = "module-state.json"

const REPORT_TITLE = "# effect-dsp Optimization Report"

const formatNumber = (value: number): string => value.toFixed(4)

const boolWord = (value: boolean): string =>
  value
    ? "yes"
    : "no"

const objectString = (value: unknown): string => Schema.encodeSync(Schema.parseJson(Schema.Unknown))(value)

const scoreDelta = (baselineScore: number, optimizedScore: number): number => optimizedScore - baselineScore

const instructionChanged = (beforeInstruction: string, afterInstruction: string): boolean =>
  beforeInstruction !== afterInstruction

const lineForOptionalNumber = (label: string, value?: number): string =>
  Option.fromNullable(value).pipe(
    Option.match({
      onNone: () => `| ${label} | n/a |`,
      onSome: (resolved) => `| ${label} | ${resolved} |`
    })
  )

const lineForOptionalBoolean = (label: string, value?: boolean): string =>
  Option.fromNullable(value).pipe(
    Option.match({
      onNone: () => `| ${label} | n/a |`,
      onSome: (resolved) => `| ${label} | ${boolWord(resolved)} |`
    })
  )

export type ExampleOptimizerKind = "copro" | "miprov2" | "gepa" | "study"

export type StandardExampleSummary = Readonly<{
  readonly schemaVersion: "effect-dsp-example-report/v1"
  readonly exampleName: string
  readonly optimizer: ExampleOptimizerKind
  readonly metricName: string
  readonly dataset: Readonly<{
    readonly trainsetSize?: number
    readonly valsetSize?: number
    readonly evalsetSize?: number
  }>
  readonly scores: Readonly<{
    readonly baseline: number
    readonly optimized: number
    readonly delta: number
  }>
  readonly instruction: Readonly<{
    readonly changed?: boolean
    readonly lengthBefore?: number
    readonly lengthAfter?: number
    readonly before?: string
    readonly after?: string
  }>
  readonly demos: Readonly<{
    readonly countBefore?: number
    readonly countAfter?: number
    readonly learnedDuringOptimization?: number
  }>
  readonly optimization: Readonly<{
    readonly eventCount: number
    readonly summary: Readonly<Record<string, unknown>>
    readonly seed?: number
    readonly config?: Readonly<Record<string, unknown>>
  }>
  readonly extras: Readonly<Record<string, unknown>>
}>

export type StandardExampleEvents = Readonly<{
  readonly schemaVersion: "effect-dsp-example-events/v1"
  readonly exampleName: string
  readonly optimizer: ExampleOptimizerKind
  readonly streams: ReadonlyArray<
    Readonly<{
      readonly name: string
      readonly events: unknown
    }>
  >
}>

export type StandardModuleState = Readonly<{
  readonly schemaVersion: "effect-dsp-module-state/v1"
  readonly exampleName: string
  readonly optimizer: ExampleOptimizerKind
  readonly state: unknown
}>

export const STANDARD_REPORT_FILE_NAME = REPORT_FILE_NAME

export const STANDARD_SUMMARY_FILE_NAME = SUMMARY_FILE_NAME

export const STANDARD_EVENTS_FILE_NAME = EVENTS_FILE_NAME

export const STANDARD_MODULE_STATE_FILE_NAME = MODULE_STATE_FILE_NAME

const datasetLines = (dataset: StandardExampleSummary["dataset"]): ReadonlyArray<string> =>
  Arr.make(
    lineForOptionalNumber("Train set size", dataset.trainsetSize),
    lineForOptionalNumber("Validation set size", dataset.valsetSize),
    lineForOptionalNumber("Evaluation set size", dataset.evalsetSize)
  )

const instructionLines = (instruction: StandardExampleSummary["instruction"]): ReadonlyArray<string> =>
  Arr.make(
    lineForOptionalBoolean("Instruction changed", instruction.changed),
    lineForOptionalNumber("Instruction length before", instruction.lengthBefore),
    lineForOptionalNumber("Instruction length after", instruction.lengthAfter)
  )

const demoLines = (demos: StandardExampleSummary["demos"]): ReadonlyArray<string> =>
  Arr.make(
    lineForOptionalNumber("Demo count before", demos.countBefore),
    lineForOptionalNumber("Demo count after", demos.countAfter),
    lineForOptionalNumber("Demos learned during optimization", demos.learnedDuringOptimization)
  )

const summaryLines = (summary: StandardExampleSummary): ReadonlyArray<string> =>
  Arr.make(
    REPORT_TITLE,
    "",
    `## Example: ${summary.exampleName}`,
    "",
    "## Core Outcome",
    "",
    "| Metric | Value |",
    "| --- | --- |",
    `| Optimizer | ${summary.optimizer} |`,
    `| Metric name | ${summary.metricName} |`,
    `| Baseline score | ${formatNumber(summary.scores.baseline)} |`,
    `| Optimized score | ${formatNumber(summary.scores.optimized)} |`,
    `| Score delta | ${formatNumber(summary.scores.delta)} |`,
    "",
    "## Dataset",
    "",
    "| Item | Value |",
    "| --- | --- |",
    ...datasetLines(summary.dataset),
    "",
    "## Instructions",
    "",
    "| Item | Value |",
    "| --- | --- |",
    ...instructionLines(summary.instruction),
    "",
    "## Demonstrations",
    "",
    "| Item | Value |",
    "| --- | --- |",
    ...demoLines(summary.demos),
    "",
    "## Events",
    "",
    "| Item | Value |",
    "| --- | --- |",
    `| Event count | ${summary.optimization.eventCount} |`,
    lineForOptionalNumber("Seed", summary.optimization.seed),
    "",
    "## Persistence",
    "",
    `Artifacts are written to \`${
      artifactDirectoryForExample(summary.exampleName)
    }\` using standardized files: \`${REPORT_FILE_NAME}\`, \`${SUMMARY_FILE_NAME}\`, \`${EVENTS_FILE_NAME}\`, \`${MODULE_STATE_FILE_NAME}\`.`
  )

export const makeStandardSummary = (options: {
  readonly exampleName: string
  readonly optimizer: ExampleOptimizerKind
  readonly metricName: string
  readonly baselineScore: number
  readonly optimizedScore: number
  readonly eventCount: number
  readonly optimizationSummary: Readonly<Record<string, unknown>>
  readonly seed?: number
  readonly optimizationConfig?: Readonly<Record<string, unknown>>
  readonly trainsetSize?: number
  readonly valsetSize?: number
  readonly evalsetSize?: number
  readonly instructionBefore?: string
  readonly instructionAfter?: string
  readonly demoCountBefore?: number
  readonly demoCountAfter?: number
  readonly demosLearnedDuringOptimization?: number
  readonly extras?: Readonly<Record<string, unknown>>
}): StandardExampleSummary => {
  const dataset: StandardExampleSummary["dataset"] = {
    ...Option.fromNullable(options.trainsetSize).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (trainsetSize) => ({ trainsetSize })
      })
    ),
    ...Option.fromNullable(options.valsetSize).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (valsetSize) => ({ valsetSize })
      })
    ),
    ...Option.fromNullable(options.evalsetSize).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (evalsetSize) => ({ evalsetSize })
      })
    )
  }

  const instructionChangedOption = Option.fromNullable(options.instructionBefore).pipe(
    Option.flatMap((beforeInstruction) =>
      Option.fromNullable(options.instructionAfter).pipe(
        Option.map((afterInstruction) => instructionChanged(beforeInstruction, afterInstruction))
      )
    )
  )

  const instruction: StandardExampleSummary["instruction"] = {
    ...instructionChangedOption.pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (changed) => ({ changed })
      })
    ),
    ...Option.fromNullable(options.instructionBefore).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (before) => ({ before, lengthBefore: before.length })
      })
    ),
    ...Option.fromNullable(options.instructionAfter).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (after) => ({ after, lengthAfter: after.length })
      })
    )
  }

  const demos: StandardExampleSummary["demos"] = {
    ...Option.fromNullable(options.demoCountBefore).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (countBefore) => ({ countBefore })
      })
    ),
    ...Option.fromNullable(options.demoCountAfter).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (countAfter) => ({ countAfter })
      })
    ),
    ...Option.fromNullable(options.demosLearnedDuringOptimization).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (learnedDuringOptimization) => ({ learnedDuringOptimization })
      })
    )
  }

  const optimization: StandardExampleSummary["optimization"] = {
    eventCount: options.eventCount,
    summary: options.optimizationSummary,
    ...Option.fromNullable(options.seed).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (seed) => ({ seed })
      })
    ),
    ...Option.fromNullable(options.optimizationConfig).pipe(
      Option.match({
        onNone: () => ({}),
        onSome: (config) => ({ config })
      })
    )
  }

  return {
    schemaVersion: "effect-dsp-example-report/v1",
    exampleName: options.exampleName,
    optimizer: options.optimizer,
    metricName: options.metricName,
    dataset,
    scores: {
      baseline: options.baselineScore,
      optimized: options.optimizedScore,
      delta: scoreDelta(options.baselineScore, options.optimizedScore)
    },
    instruction,
    demos,
    optimization,
    extras: options.extras ?? {}
  }
}

export const makeStandardReportMarkdown = (summary: StandardExampleSummary): string => summaryLines(summary).join("\n")

export const makeStandardEvents = (options: {
  readonly exampleName: string
  readonly optimizer: ExampleOptimizerKind
  readonly streams: ReadonlyArray<
    Readonly<{
      readonly name: string
      readonly events: unknown
    }>
  >
}): StandardExampleEvents => ({
  schemaVersion: "effect-dsp-example-events/v1",
  exampleName: options.exampleName,
  optimizer: options.optimizer,
  streams: options.streams
})

export const makeStandardModuleState = (options: {
  readonly exampleName: string
  readonly optimizer: ExampleOptimizerKind
  readonly state: unknown
}): StandardModuleState => ({
  schemaVersion: "effect-dsp-module-state/v1",
  exampleName: options.exampleName,
  optimizer: options.optimizer,
  state: options.state
})

const writeReportMarkdown = (directory: string, summary: StandardExampleSummary) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const reportPath = path.join(directory, REPORT_FILE_NAME)
    yield* fileSystem.writeFileString(reportPath, makeStandardReportMarkdown(summary))
    return reportPath
  })

/**
 * Writes standard artifacts for optimization examples.
 *
 * Envelopes emitted via `emitCustomEnvelope` are the authority — the raw file
 * writes (report.md, summary.json, events.json, module-state.json) are derived
 * convenience for interactive development. Remove raw writes when envelope
 * reader infrastructure is available.
 *
 * @since 0.0.0
 * @category utils
 */
export const writeStandardArtifacts = (options: {
  readonly summary: StandardExampleSummary
  readonly artifacts: ExampleArtifacts
  readonly events: StandardExampleEvents
  readonly moduleState: StandardModuleState
}) =>
  Effect.gen(function*() {
    const envelopeBase = {
      optimizer: options.summary.optimizer,
      metricName: options.summary.metricName,
      exampleName: options.summary.exampleName
    }

    yield* emitCustomEnvelope({
      ...envelopeBase,
      payload: { kind: "summary", data: objectString(options.summary) }
    })

    yield* emitCustomEnvelope({
      ...envelopeBase,
      payload: { kind: "events", data: objectString(options.events) }
    })

    yield* emitCustomEnvelope({
      ...envelopeBase,
      payload: { kind: "module-state", data: objectString(options.moduleState) }
    })

    const fileSystem = yield* FileSystem.FileSystem
    const path = yield* Path.Path
    const reportsDir = options.artifacts.reportsDir

    yield* fileSystem.makeDirectory(reportsDir, { recursive: true }).pipe(
      Effect.catchAll(() => Effect.void)
    )

    const reportPath = yield* writeReportMarkdown(reportsDir, options.summary)

    const summaryPath = path.join(reportsDir, SUMMARY_FILE_NAME)
    yield* fileSystem.writeFileString(summaryPath, objectString(options.summary))

    const eventsPath = path.join(reportsDir, EVENTS_FILE_NAME)
    yield* fileSystem.writeFileString(eventsPath, objectString(options.events))

    const moduleStatePath = path.join(reportsDir, MODULE_STATE_FILE_NAME)
    yield* fileSystem.writeFileString(moduleStatePath, objectString(options.moduleState))

    return Arr.make(reportPath, summaryPath, eventsPath, moduleStatePath)
  })
