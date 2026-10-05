import { expect } from "@effect/vitest"
import * as Module from "@scenesystems/effect-dsp/Module"
import { ModuleParameters } from "@scenesystems/effect-dsp/ModuleParameters"
import { Array as Arr, Effect, Graph, HashMap, Ref, Schema } from "effect"

/** Checks all reachable parameter refs on success, failure, defect and interruption. */
export const assertNoMutation = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, ME, MR, A, E, R>(
  module: Module.Module<I, O, ME, MR>,
  effect: Effect.Effect<A, E, R>
) => {
  const refs = Arr.prepend(
    Arr.map(
      Arr.fromIterable(Graph.nodes(Module.nodeGraph(HashMap.values(module.subModules)))),
      ([, node]) => node.params
    ),
    module.params
  )
  const snapshot = Effect.forEach(
    refs,
    (ref) => Ref.get(ref).pipe(Effect.flatMap(Schema.encodeEffect(Schema.fromJsonString(ModuleParameters))))
  ).pipe(Effect.orDie)
  return Effect.acquireUseRelease(snapshot, () => effect, (before) =>
    snapshot.pipe(Effect.map((after) => {
      expect(after).toEqual(before)
    })))
}
