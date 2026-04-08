import { Effect, Schema, Stream } from "effect"
import * as Chunk from "effect/Chunk"

import { type EvidenceEvent, EvidenceEvent as EvidenceEventSchema } from "../../../contracts/evidence/stream.js"
import type { Program } from "../../../contracts/presentation/program.js"

import { evidenceEventForStreamElement, type StreamElement } from "./stream-element.js"

export type DemoStreamPhase<R, E = never> = {
  readonly name: string
  readonly events: Effect.Effect<ReadonlyArray<EvidenceEvent>, E, R>
}

export type DemoStreamPlan<R, E = never> = {
  readonly packageName: string
  readonly program: Effect.Effect<Program, E, R>
  readonly summary: string
  readonly phases: ReadonlyArray<DemoStreamPhase<R, E>>
}

export const makeStreamPlan = <R, E = never>(plan: DemoStreamPlan<R, E>): DemoStreamPlan<R, E> => plan

export const EvidenceEventBatch = Schema.Array(EvidenceEventSchema)

export const phaseFromElementStream = <E, R>(
  name: string,
  stream: Stream.Stream<StreamElement, E, R>
): DemoStreamPhase<R, E> => ({
  name,
  events: Stream.runCollect(Stream.map(stream, evidenceEventForStreamElement)).pipe(
    Effect.map(Chunk.toReadonlyArray)
  )
})
