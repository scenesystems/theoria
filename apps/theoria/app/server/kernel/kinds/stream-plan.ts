import type { PackageName } from "@theoria/source-proof/contracts"
import { Effect, Option, Schema, Stream } from "effect"
import * as Chunk from "effect/Chunk"

import { type EvidenceEvent, EvidenceEvent as EvidenceEventSchema } from "../../../contracts/evidence/stream.js"
import type { Program } from "../../../contracts/presentation/program.js"

import type { Lane } from "./policy.js"
import { evidenceEventForStreamElement, type StreamElement } from "./stream-element.js"

export type DemoStreamPhase<R, E = never> = {
  readonly lane?: Lane
  readonly name: string
  readonly events: Effect.Effect<ReadonlyArray<EvidenceEvent>, E, R>
}

export type DemoStreamPlan<R, E = never> = {
  readonly packageName: PackageName
  readonly program: Effect.Effect<Program, E, R>
  readonly summary: string
  readonly phases: ReadonlyArray<DemoStreamPhase<R, E>>
}

export const EvidenceEventBatch = Schema.Array(EvidenceEventSchema)

export const phaseFromElementStream = <E, R>(
  name: string,
  stream: Stream.Stream<StreamElement, E, R>,
  lane?: Lane
): DemoStreamPhase<R, E> => {
  const events = Stream.runCollect(Stream.map(stream, evidenceEventForStreamElement)).pipe(
    Effect.map(Chunk.toReadonlyArray)
  )

  return Option.fromNullable(lane).pipe(
    Option.match({
      onNone: () => ({ name, events }),
      onSome: (resolvedLane) => ({ lane: resolvedLane, name, events })
    })
  )
}
