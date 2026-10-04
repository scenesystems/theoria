/**
 * Ensemble runtime orchestration — runs sub-modules, collects outputs, and
 * reduces via the configured strategy.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Inspectable, Number as Num, Option, Record, String as Str, Tuple } from "effect"
import type { Schema } from "effect"
import type { DspError } from "../../DspError.js"
import { AllTrialsFailed } from "../../DspError.js"
import { type Options as EnsembleOptions, ReduceOptions } from "../../Ensemble.js"
import * as Module from "../../Module.js"
import type { Module as DspModule } from "../../Module.js"
import { choosePrograms, ChooseProgramsOptions, resolveSelectionSize } from "./selection.js"
import { majorityVote } from "./vote.js"

const defaultProgramName = (index: number): string =>
  Str.concat("program-", Inspectable.toStringUnknown(Num.increment(index)))

const toComposeSubModules = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, MemberE, MemberR>(
  programs: EnsembleOptions<I, O, MemberE, MemberR>["programs"]
): Module.ComposeSubModules =>
  Arr.reduce(
    Arr.map(Arr.fromIterable(programs), (program, index) => Tuple.make(defaultProgramName(index), program)),
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
 * @see {@link import("../../Ensemble.js").Options} for configuration
 * @since 0.1.0
 * @category constructors
 */
export const make = <
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
    const programs = Arr.fromIterable(options.programs)
    const lead = yield* Effect.fromOption(Arr.head(programs), () =>
      new AllTrialsFailed({ message: "Ensemble.make requires at least one program", trialCount: 0 }))
    const selectedPrograms = choosePrograms(
      new ChooseProgramsOptions({
        programs,
        size: resolveSelectionSize(Arr.length(programs), Option.fromNullishOr(options.size)),
        seed: Option.getOrElse(Option.fromNullishOr(options.seed), () =>
          1)
      })
    )

    return yield* Module.compose<I, O, MemberE | ReducerE, MemberR | ReducerR>(
      new Module.ComposeOptions({
        name: Option.getOrElse(Option.fromNullishOr(options.name), () => "ensemble"),
        signature: lead.signature,
        subModules: toComposeSubModules(programs),
        forward: ({ input }) =>
          Effect.gen(function*() {
            const outputs = yield* Effect.forEach(
              selectedPrograms,
              (program) => program.forward(input),
              { concurrency: Arr.length(selectedPrograms) }
            )

            return yield* Option.match(Option.fromNullishOr(options.reduceFn), {
              onNone: () => majorityVote(outputs, lead.signature.outputSchema),
              onSome: (reduceFn) => reduceFn(new ReduceOptions({ input, outputs }))
            })
          })
      })
    )
  })
