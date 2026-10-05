/**
 * Effective leaf-predictor snapshots and validated installation.
 * @since 0.1.0
 */
import { Array as Arr, Boolean, Effect, Option, Record, Schema } from "effect"
import { SaveLoadError } from "../../DspError.js"
import { install, SavedState } from "../../Module.js"
import type { Module } from "../../Module.js"
import { predictors } from "../../ModuleGraph.js"
import * as ParameterSet from "../../ParameterSet.js"

/**
 * Reads effective parameters, including bound defaults and invocation overlays.
 * Shared leaves are stored once under their canonical path; non-predictor roots
 * have no persistence entry. Optional caller metadata is omitted.
 * @since 0.1.0
 * @category constructors
 */
export const save = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module<I, O, E, R>
) => ParameterSet.snapshot(module).pipe(Effect.map((parameters) => new SavedState({ parameters })))

/**
 * Validates every predictor path and demonstration before explicit installation.
 * Unknown paths (including non-predictor roots), missing paths, and invalid
 * demonstrations fail without writing any ref. Metadata does not affect loading.
 * Installation is uninterruptible; concurrent explicit installations are not coordinated.
 * @since 0.1.0
 * @category constructors
 */
export const load = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module<I, O, E, R>,
  state: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* Schema.decodeUnknownEffect(SavedState)(state).pipe(
      Effect.mapError(() => new SaveLoadError({ message: "Saved state failed schema validation", operation: "load" }))
    )
    const targets = Arr.fromIterable(predictors(module))
    yield* Effect.forEach(Record.keys(decoded.parameters), (id) =>
      Effect.fail(
        new SaveLoadError({
          message: `Saved state contains unknown predictor path '${id}'`,
          operation: "load"
        })
      ).pipe(Effect.when(Effect.succeed(Boolean.not(Arr.some(targets, (entry) => entry.path === id))))))
    yield* Effect.forEach(targets, (target) =>
      Option.match(Record.get(decoded.parameters, target.path), {
        onNone: () =>
          Effect.fail(
            new SaveLoadError({
              message: `Saved state is missing parameters for predictor '${target.path}'`,
              operation: "load"
            })
          ),
        onSome: (parameters) =>
          Effect.forEach(parameters.demos, target.demonstrationCodec.decode, { discard: true }).pipe(
            Effect.mapError(() =>
              new SaveLoadError({
                message: `Saved demonstrations do not match predictor '${target.path}'`,
                operation: "load"
              })
            )
          )
      }))
    yield* install(module, decoded.parameters)
  })
