/** Typed GEPA configuration checks that precede checkpoint replay and component reflection. @internal */
import { Array as Arr, Boolean, Data, Effect, Function, Number as Num, Option, Schema, String } from "effect"
import type { Chunk } from "effect"
import { GEPAError } from "../../DspError.js"
import { ParetoSnapshot, type State } from "../../GEPA.js"
import type * as Predictor from "../../Predictor.js"
import { deriveParetoKernelSnapshot } from "./frontier.js"

/** Program and dataset facts a checkpoint must agree with. @internal */
export class CheckpointContext extends Data.Class<{
  readonly trainable: ReadonlyArray<Predictor.Path>
  readonly frozen: ReadonlyArray<Predictor.Path>
  readonly trainsetSize: number
  readonly valsetSize: number
}> {}

const ensure = (valid: boolean, reason: GEPAError["reason"], message: () => string) =>
  Effect.succeed(valid).pipe(
    Effect.filterOrFail(Function.identity, () => new GEPAError({ reason, message: message() })),
    Effect.asVoid
  )
const invalidState = (valid: boolean, message: () => string) => ensure(valid, "invalid-state", message)
const within = (value: number, size: number) =>
  Boolean.and(Num.isGreaterThanOrEqualTo(value, 0), Num.isLessThan(value, size))
const names = (candidate: State["candidates"][number]) =>
  Arr.map(candidate.predictorInstructions, (entry) => entry.predictorName)
const describe = (paths: ReadonlyArray<string>) => Arr.join(paths, ", ")

/** Component selectors may name only trainable predictors of the selected parent. @internal */
export const validateComponents = (
  components: Chunk.Chunk<Predictor.Path>,
  trainable: ReadonlyArray<Predictor.Path>,
  frozen: ReadonlyArray<Predictor.Path>
) =>
  Effect.forEach(
    components,
    (path) =>
      ensure(Arr.contains(trainable, path), "invalid-options", () =>
        Boolean.match(Arr.contains(frozen, path), {
          onFalse: () => `componentSelector returned unknown predictor path ${path}`,
          onTrue: () => `componentSelector returned frozen predictor path ${path}`
        })),
    { discard: true }
  )

/**
 * Rejects a checkpoint whose candidates, score vectors, cursors, coverage front
 * or minibatch schedule cannot belong to this module and these datasets.
 * Runs before either RNG is restored or any example is evaluated.
 * @internal
 */
export const validateCheckpoint = (state: State, context: CheckpointContext) =>
  Effect.gen(function*() {
    const candidateIds = Arr.map(state.candidates, (candidate) => candidate.candidateId)
    yield* invalidState(Arr.isReadonlyArrayNonEmpty(state.candidates), () => "Checkpoint contains no candidates")
    yield* invalidState(
      Num.Equivalence(Arr.length(Arr.dedupe(candidateIds)), Arr.length(candidateIds)),
      () => "Checkpoint candidate identifiers must be unique"
    )
    yield* Effect.forEach(state.candidates, (candidate, index) =>
      Effect.gen(function*() {
        const frozen = Arr.filter(names(candidate), (name) => Arr.contains(context.frozen, name))
        yield* invalidState(
          Arr.isReadonlyArrayEmpty(frozen),
          () =>
            `Checkpoint candidate ${candidate.candidateId} carries instructions for frozen predictors ${
              describe(frozen)
            }`
        )
        yield* invalidState(
          Arr.makeEquivalence(String.Equivalence)(names(candidate), context.trainable),
          () =>
            `Checkpoint candidate ${candidate.candidateId} predictors [${
              describe(names(candidate))
            }] do not match the module's trainable predictors [${describe(context.trainable)}]`
        )
        yield* Effect.forEach(candidate.parentIds, (parentId) =>
          invalidState(
            Option.exists(
              Arr.findFirstIndex(candidateIds, (id) => String.Equivalence(id, parentId)),
              (parent) => Num.isLessThan(parent, index)
            ),
            () =>
              `Checkpoint candidate ${candidate.candidateId} names parent ${parentId}, which is not an earlier candidate`
          ), { discard: true })
      }), { discard: true })
    yield* invalidState(
      Num.Equivalence(Arr.length(state.scoreVectors), Arr.length(state.candidates)),
      () => "Checkpoint must hold exactly one validation score vector per candidate"
    )
    yield* invalidState(
      Arr.every(state.scoreVectors, (vector) => Num.Equivalence(Arr.length(vector), context.valsetSize)),
      () => `Checkpoint score vectors must cover all ${context.valsetSize} validation examples`
    )
    yield* invalidState(
      Boolean.and(
        Num.Equivalence(Arr.length(state.componentCursors), Arr.length(state.candidates)),
        Arr.every(state.componentCursors, (cursor) => within(cursor, Num.max(1, Arr.length(context.trainable))))
      ),
      () => "Checkpoint must hold one in-range round-robin cursor per candidate"
    )
    yield* invalidState(
      Schema.toEquivalence(ParetoSnapshot)(state.paretoSnapshot, deriveParetoKernelSnapshot(state.scoreVectors)),
      () => "Checkpoint coverage front was not derived from its score vectors"
    )
    yield* invalidState(
      Boolean.and(
        Num.Equivalence(state.batch.trainsetSize, context.trainsetSize),
        Arr.every(state.batch.shuffled, (index) => within(index, context.trainsetSize))
      ),
      () => `Checkpoint minibatch schedule does not belong to a ${context.trainsetSize}-example training set`
    )
  })
