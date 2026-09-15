/**
 * Ensemble runtime orchestration — runs sub-modules, collects outputs, and
 * reduces via the configured strategy.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, Inspectable, Number as Num, Option, Record, String as Str } from "effect"
import type { Schema } from "effect"
import { AllTrialsFailed } from "../../Errors/optimizer.js"
import type { DspError } from "../../Errors/union.js"
import * as Module from "../../Module/index.js"
import type { Module as DspModule } from "../../Module/model.js"
import { type EnsembleOptions, EnsembleReduceOptions } from "./model.js"
import { choosePrograms, ChooseProgramsOptions, resolveSelectionSize } from "./selection.js"
import { majorityVote } from "./vote.js"

const defaultProgramName = (index: number): string =>
  Str.concat("program-", Inspectable.toStringUnknown(Num.increment(index)))

const toComposeSubModules = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, MemberE, MemberR>(
  programs: EnsembleOptions<I, O, MemberE, MemberR>["programs"]
): Module.ComposeSubModules =>
  Arr.reduce(
    Arr.map(programs, (program, index) => Data.tuple(defaultProgramName(index), program)),
    Record.empty<string, DspModule<I, O, MemberE, MemberR>>(),
    (state, [alias, program]) => Record.set(state, alias, program)
  )

/**
 * Constructs a module that concurrently runs a fixed subset and reduces its outputs.
 *
 * @remarks
 * An empty `programs` array fails with `AllTrialsFailed`. Composition may also
 * fail when program names do not form a valid ownership graph. The selected
 * subset and its order remain fixed for the ensemble's lifetime. Selected
 * member and reducer checked failures and service requirements are combined in
 * the returned module without recovery or conversion to defects.
 *
 * @typeParam I - Input fields shared by every program.
 * @typeParam O - Output fields expected from every program and the reducer.
 * @typeParam MemberE - Additional checked failures from selected modules.
 * @typeParam MemberR - Additional services required by selected modules.
 * @typeParam ReducerE - Checked failures from the reducer.
 * @typeParam ReducerR - Services required by the reducer.
 * @param options - Candidate modules, subset controls, identity, and reducer.
 * @returns A composite module using the first program's signature.
 *
 * @see {@link import("./model.js").EnsembleOptions} for configuration
 * @since 0.1.0
 * @category constructors
 */
export const ensemble = <
  I extends Schema.Struct.Fields,
  O extends Schema.Struct.Fields,
  MemberE = never,
  MemberR = never,
  ReducerE = DspError,
  ReducerR = never
>(
  options: EnsembleOptions<I, O, MemberE, MemberR, ReducerE, ReducerR>
): Effect.Effect<DspModule<I, O, MemberE | ReducerE, MemberR | ReducerR>, DspError> =>
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
    const selectedPrograms = choosePrograms(
      new ChooseProgramsOptions({
        programs: options.programs,
        size: resolveSelectionSize(Arr.length(options.programs), Option.fromNullable(options.size)),
        seed: Option.getOrElse(Option.fromNullable(options.seed), () => 1)
      })
    )

    return yield* Module.compose<I, O, MemberE | ReducerE, MemberR | ReducerR>({
      name: Option.getOrElse(Option.fromNullable(options.name), () => "ensemble"),
      signature: lead.signature,
      subModules: toComposeSubModules(options.programs),
      forward: ({ input }) =>
        Effect.gen(function*() {
          const outputs = yield* Effect.forEach(
            selectedPrograms,
            (program) => program.forward(input),
            { concurrency: Arr.length(selectedPrograms) }
          )

          return yield* Option.match(Option.fromNullable(options.reduceFn), {
            onNone: () => majorityVote(outputs, lead.signature.outputSchema),
            onSome: (reduceFn) => reduceFn(new EnsembleReduceOptions({ input, outputs }))
          })
        })
    })
  })
