import { Atom } from "@effect-atom/atom"
import type { Atom as AtomType } from "@effect-atom/atom"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Effect } from "effect"
import { useCallback } from "react"

import { appRuntime } from "./runtime.js"

// ---------------------------------------------------------------------------
// Spring animation authority — reusable spring-interpolated 0→1 animation.
//
// `Spring.make(config)` returns per-key atom families for progress and
// target. The spring loop runs inline via Effect.sleep stepping, yielding
// to React each frame. Non-concurrent mode per key means a new target
// interrupts the running loop and picks up from current progress/velocity.
// ---------------------------------------------------------------------------

const frameMs = 16

type SpringConfig = {
  readonly stiffness: number
  readonly damping: number
  readonly restThreshold?: number
}

type SpringState = {
  readonly progress: number
  readonly velocity: number
  readonly target: number
}

const resting: SpringState = { progress: 0, velocity: 0, target: 0 }

const stepSpring = (state: SpringState, config: SpringConfig): SpringState => {
  const threshold = config.restThreshold ?? 0.005
  const force = config.stiffness * (state.target - state.progress)
  const nextVelocity = (state.velocity + force) * config.damping
  const nextProgress = state.progress + nextVelocity
  const settled = Math.abs(nextVelocity) < threshold &&
    Math.abs(state.target - nextProgress) < threshold

  return settled
    ? { progress: state.target, velocity: 0, target: state.target }
    : { progress: nextProgress, velocity: nextVelocity, target: state.target }
}

export class Spring {
  static make(config: SpringConfig): Spring {
    const stateAtom: (id: string) => AtomType.Writable<SpringState> = Atom.family(
      (_id: string) => Atom.make(resting)
    )

    const springLoop = (
      registry: AtomType.FnContext["registry"],
      id: string
    ): Effect.Effect<void, never, never> =>
      Effect.gen(function*() {
        const current = registry.get(stateAtom(id))

        if (current.velocity === 0 && current.progress === current.target) {
          return
        }

        const next = stepSpring(current, config)
        registry.set(stateAtom(id), next)

        if (next.velocity === 0 && next.progress === next.target) {
          return
        }

        yield* Effect.sleep(`${frameMs} millis`)
        yield* springLoop(registry, id)
      })

    const setTargetAtom = Atom.family((id: string) =>
      appRuntime.fn(
        Effect.fnUntraced(function*(target: number, ctx: AtomType.FnContext) {
          const prev = ctx.registry.get(stateAtom(id))
          ctx.registry.set(stateAtom(id), { ...prev, target })
          yield* springLoop(ctx.registry, id)
        })
      )
    )

    const progressAtom: (id: string) => AtomType.Atom<number> = Atom.family(
      (id: string) => Atom.make((get) => get(stateAtom(id)).progress)
    )

    return new Spring({ progressAtom, setTargetAtom })
  }

  constructor(private readonly atoms: Spring.Shape) {}

  progressAtom(id: string): AtomType.Atom<number> {
    return this.atoms.progressAtom(id)
  }

  setTargetAtom(id: string): AtomType.Writable<unknown, number> {
    return this.atoms.setTargetAtom(id)
  }
}

export namespace Spring {
  export interface Shape {
    readonly progressAtom: (id: string) => AtomType.Atom<number>
    readonly setTargetAtom: (id: string) => AtomType.Writable<unknown, number>
  }
}

// ---------------------------------------------------------------------------
// useSpringLift — hook for pointer-driven spring animation.
//
// Returns `progress` (0→1) and pointer event handlers. Attach handlers to
// the element via onPointerEnter/onPointerLeave props.
// ---------------------------------------------------------------------------

type SpringLift = {
  readonly progress: number
  readonly onPointerEnter: () => void
  readonly onPointerLeave: () => void
}

type SpringMotion = {
  readonly progress: number
  readonly setTarget: (target: number) => void
}

/**
 * Hook for pointer-driven spring animation on a keyed element.
 *
 * ```tsx
 * const { progress, onPointerEnter, onPointerLeave } = useSpringLift(spring, id)
 * <div onPointerEnter={onPointerEnter} onPointerLeave={onPointerLeave}
 *      style={{ transform: `translateY(${-progress * 3}px)` }} />
 * ```
 *
 * @since 0.1.0
 */
export const useSpringLift = (spring: Spring, id: string): SpringLift => {
  const { progress, setTarget } = useSpringMotion(spring, id)

  const onPointerEnter = useCallback(() => setTarget(1), [setTarget])
  const onPointerLeave = useCallback(() => setTarget(0), [setTarget])

  return { progress, onPointerEnter, onPointerLeave }
}

/**
 * Hook for directly driving a keyed spring animation.
 *
 * @since 0.1.0
 */
export const useSpringMotion = (spring: Spring, id: string): SpringMotion => {
  const progress = useAtomValue(spring.progressAtom(id))
  const setTarget = useAtomSet(spring.setTargetAtom(id))

  const setSpringTarget = useCallback((target: number) => setTarget(target), [setTarget])

  return { progress, setTarget: setSpringTarget }
}
