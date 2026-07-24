/** Cooperative JCS Effect execution orchestrator. @internal */

import { Array as Arr, Chunk, Data, Effect, MutableHashSet, MutableList, MutableRef, Option } from "effect"

import { CanonicalByteLimitExceeded, type CanonicalizationError } from "../schemas/errors.js"
import {
  processArrayCheck,
  processArrayFill,
  processDescriptors,
  processSort,
  processSymbols
} from "./jcs-admission-machine.js"
import type { Frame } from "./jcs-model.js"
import { ByteBudget, exceeded, ref, State } from "./jcs-model.js"
import { processClose, processCursor, processKeys, processString, processVisit } from "./jcs-serialization-machine.js"

const BATCH = 512
// Bun 1.3.9 imposes an approximately 1 ms floor on sleep(0). Every-batch host
// turns made the 65,536-point benchmark roughly 8x slower without improving its
// delay gate, so fibers yield every batch while host timers run every 32 batches.
const HOST_YIELD_BATCHES = 32
const CONTROL_TOKENS: ReadonlyArray<number> = Arr.makeBy(BATCH, (index) => index)

export class BoundedCanonicalSegments extends Data.Class<{
  readonly segments: Chunk.Chunk<string>
  readonly canonicalByteLength: number
}> {}

const process = (state: State, frame: Frame): void => {
  if (frame._tag === "Visit") return processVisit(state, frame)
  if (frame._tag === "Symbols") return processSymbols(state, frame)
  if (frame._tag === "Descriptors") return processDescriptors(state, frame)
  if (frame._tag === "ArrayCheck") return processArrayCheck(state, frame)
  if (frame._tag === "ArrayFill") return processArrayFill(state, frame)
  if (frame._tag === "Sort") return processSort(state, frame)
  if (frame._tag === "Keys") return processKeys(state, frame)
  if (frame._tag === "String") return processString(state, frame)
  if (frame._tag === "ArrayCursor" || frame._tag === "RecordCursor") return processCursor(state, frame)
  processClose(state, frame)
}

const stopped = (state: State): boolean =>
  MutableList.isEmpty(state.stack) || Option.isSome(MutableRef.get(state.failure)) || exceeded(state)

const execute = (
  value: unknown,
  maximumBytes: Option.Option<number>
): Effect.Effect<State, CanonicalizationError> =>
  Effect.suspend(() => {
    const batches = ref(0)
    const state = new State({
      stack: MutableList.make({ _tag: "Visit", value }),
      active: MutableHashSet.empty(),
      segments: MutableList.empty(),
      pending: ref(""),
      budget: Option.map(maximumBytes, (maximum) =>
        new ByteBudget({ maximumBytes: maximum, byteLength: ref(0), exceeded: ref(false) })),
      failure: ref(Option.none())
    })
    return Effect.flatMap(
      Effect.iterate(state, {
        while: (current) =>
          !stopped(current),
        body: (current) =>
          Effect.flatMap(
            Effect.sync(() => {
              CONTROL_TOKENS.some(() => {
                if (stopped(current)) return true
                process(current, MutableList.shift(current.stack)!)
                return false
              })
              return current
            }),
            (nextState) =>
              stopped(nextState)
                ? Effect.succeed(nextState)
                : Effect.as(
                  Effect.zipRight(
                    Effect.yieldNow(),
                    Effect.suspend(() => {
                      const next = MutableRef.get(batches) + 1
                      MutableRef.set(batches, next % HOST_YIELD_BATCHES)
                      return next === HOST_YIELD_BATCHES ? Effect.sleep(0) : Effect.void
                    })
                  ),
                  nextState
                )
          )
        // Bun timers require a host boundary in addition to fiber yielding. Amortize that
        // boundary while retaining Effect scheduler cooperation after every fixed-size batch.
      }),
      (current) => {
        const failure = MutableRef.get(current.failure)
        if (Option.isSome(failure)) return Effect.fail(failure.value)
        return Effect.succeed(current)
      }
    )
  })

const segments = (state: State): Chunk.Chunk<string> => {
  const pending = MutableRef.get(state.pending)
  if (pending.length > 0) MutableList.append(state.segments, pending)
  return Chunk.fromIterable(state.segments)
}

export const canonicalizeSegments = (value: unknown): Effect.Effect<Chunk.Chunk<string>, CanonicalizationError> =>
  Effect.map(execute(value, Option.none()), segments)
export const canonicalizeSegmentsWithByteLimit = (
  value: unknown,
  maximumBytes: number
): Effect.Effect<BoundedCanonicalSegments, CanonicalizationError | CanonicalByteLimitExceeded> =>
  Effect.flatMap(execute(value, Option.some(maximumBytes)), (state) =>
    Option.match(state.budget, {
      onNone: () => Effect.dieMessage("bounded canonicalization requires a byte budget"),
      onSome: (budget) =>
        MutableRef.get(budget.exceeded)
          ? new CanonicalByteLimitExceeded({})
          : Effect.succeed(
            new BoundedCanonicalSegments({
              segments: segments(state),
              canonicalByteLength: MutableRef.get(budget.byteLength)
            })
          )
    }))
export const canonicalizeValue = (value: unknown): Effect.Effect<string, CanonicalizationError> =>
  Effect.map(canonicalizeSegments(value), (output) => Chunk.join(output, ""))
