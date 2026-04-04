/**
 * Ensemble runtime orchestration — runs sub-modules, collects outputs, and
 * reduces via the configured strategy.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Option, Record } from "effect"
import type { Schema } from "effect"
import { AllTrialsFailed } from "../../Errors/optimizer.js"
import type { DspError } from "../../Errors/union.js"
import * as Module from "../../Module/index.js"
import type { Module as DspModule } from "../../Module/model.js"
import type { EnsembleOptions, ProgramInput, ProgramOutput } from "./model.js"
import { choosePrograms, resolveSelectionSize } from "./selection.js"
import { majorityVote } from "./vote.js"

const defaultProgramName = (index: number): string => `program-${index + 1}`

const defaultReduceFn = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(options: {
  readonly outputs: ReadonlyArray<ProgramOutput<O>>
  readonly input: ProgramInput<I>
}): Effect.Effect<ProgramOutput<O>, DspError> => majorityVote(options.outputs)

const toComposeSubModules = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  programs: ReadonlyArray<DspModule<I, O>>
): Module.ComposeSubModules =>
  Arr.reduce(
    Arr.map(programs, (program, index) => Data.tuple(defaultProgramName(index), program)),
    Record.empty<string, DspModule<I, O>>(),
    (state, [alias, program]) => Record.set(state, alias, program)
  )

/**
 * Construct an ensemble module that runs each program concurrently, collects
 * their outputs, and reduces them with the configured strategy (defaults to
 * majority vote).
 *
 * Fails with `AllTrialsFailed` when `programs` is empty.
 *
 * @see {@link import("./model.js").EnsembleOptions} for configuration
 * @since 0.1.0
 * @category constructors
 */
export const ensemble = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  options: EnsembleOptions<I, O>
): Effect.Effect<DspModule<I, O>, DspError> =>
  Effect.gen(function*() {
    const lead = yield* Option.match(Arr.head(options.programs), {
      onNone: () =>
        Effect.fail(
          new AllTrialsFailed({
            message: "Optimizer.ensemble requires at least one program",
            trialCount: 0
          })
        ),
      onSome: (program) => Effect.succeed(program)
    })
    const reduceFn = Option.getOrElse(Option.fromNullable(options.reduceFn), () => defaultReduceFn<I, O>)
    const selectedPrograms = choosePrograms({
      programs: options.programs,
      size: resolveSelectionSize(options.programs.length, Option.fromNullable(options.size)),
      seed: Option.getOrElse(Option.fromNullable(options.seed), () => 1)
    })

    return yield* Module.compose({
      name: Option.getOrElse(Option.fromNullable(options.name), () => "ensemble"),
      signature: lead.signature,
      subModules: toComposeSubModules(options.programs),
      forward: ({ input }) =>
        Effect.gen(function*() {
          const outputs = yield* Effect.forEach(
            selectedPrograms,
            (program) => program.forward(input),
            { concurrency: selectedPrograms.length }
          )

          return yield* reduceFn({ input, outputs })
        })
    })
  })
