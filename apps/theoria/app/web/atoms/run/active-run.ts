import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { Effect, Fiber, Option } from "effect"

import type { EntryId } from "../../../contracts/entry/id.js"

import type { RunRegistry } from "../run-registry-context.js"

import type { RunSignal } from "./run-signal.js"

export type ActiveRun = {
  readonly token: number
  readonly sequence: number
  readonly fiber: Fiber.RuntimeFiber<void, never>
  readonly signal: RunSignal
}

type RunController = {
  readonly nextToken: number
  readonly active: Option.Option<ActiveRun>
}

const initialRunController: RunController = { nextToken: 1, active: Option.none() }

const runControllerAtom: (id: EntryId) => AtomType.Writable<RunController> = Atom.family((_id: EntryId) =>
  Atom.make(initialRunController).pipe(Atom.keepAlive)
)

const updateRunController = (
  registry: RunRegistry,
  id: EntryId,
  f: (controller: RunController) => RunController
): void => {
  registry.update(runControllerAtom(id), f)
}

const clearActiveRun = (registry: RunRegistry, id: EntryId, token: number): void => {
  updateRunController(registry, id, (controller) =>
    Option.match(controller.active, {
      onNone: () => controller,
      onSome: (active) =>
        active.token === token
          ? {
            ...controller,
            active: Option.none()
          }
          : controller
    }))
}

const activeRun = (registry: RunRegistry, id: EntryId): Option.Option<ActiveRun> =>
  registry.get(runControllerAtom(id)).active

const withActiveRun = <A>(
  registry: RunRegistry,
  id: EntryId,
  onNone: () => A,
  onSome: (active: ActiveRun) => A
): A =>
  Option.match(activeRun(registry, id), {
    onNone,
    onSome
  })

export const allocateRunToken = (registry: RunRegistry, id: EntryId): number => {
  const controller = registry.get(runControllerAtom(id))
  const token = controller.nextToken

  registry.set(runControllerAtom(id), {
    ...controller,
    nextToken: token + 1
  })

  return token
}

export const registerActiveRun = (registry: RunRegistry, id: EntryId, active: ActiveRun): void => {
  updateRunController(registry, id, (controller) => ({ ...controller, active: Option.some(active) }))
}

export const releaseActiveRun = (registry: RunRegistry, id: EntryId, token: number): void => {
  clearActiveRun(registry, id, token)
}

export const activeRunFor = (registry: RunRegistry, id: EntryId): Option.Option<ActiveRun> => activeRun(registry, id)

export const pauseActiveRun = (
  registry: RunRegistry,
  id: EntryId
): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  withActiveRun(
    registry,
    id,
    () => Effect.succeed(Option.none()),
    (active) =>
      active.signal.pause().pipe(
        Effect.map((changed) => (changed ? Option.some(active) : Option.none()))
      )
  )

export const resumeActiveRun = (
  registry: RunRegistry,
  id: EntryId
): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  withActiveRun(
    registry,
    id,
    () => Effect.succeed(Option.none()),
    (active) =>
      active.signal.resume().pipe(
        Effect.map((changed) => (changed ? Option.some(active) : Option.none()))
      )
  )

export const interruptActiveRun = (
  id: EntryId,
  registry: RunRegistry
): Effect.Effect<Option.Option<ActiveRun>, never, never> =>
  withActiveRun(
    registry,
    id,
    () => Effect.succeed(Option.none()),
    (active) =>
      active.signal.markStopping().pipe(
        Effect.zipRight(Fiber.interrupt(active.fiber)),
        Effect.ensuring(
          Effect.sync(() => {
            clearActiveRun(registry, id, active.token)
          })
        ),
        Effect.as(Option.some(active))
      )
  )
