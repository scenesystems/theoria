/**
 * Versioned snapshots of module parameter ownership trees.
 *
 * @since 0.1.0
 */
import { Array as Arr, Data, Effect, HashMap, Option, Ref, Schema } from "effect"
import type { ModuleParams } from "../contracts/ModuleParams.js"
import { SaveLoadError } from "../Errors/save-load.js"
import { collectModuleParamRefs, type ModuleParamRef } from "../internal/module-params.js"
import type { Module } from "./model.js"
import { SavedState } from "./model.js"

const decodeSavedState = (input: unknown) =>
  Schema.decodeUnknown(SavedState)(input).pipe(
    Effect.mapError(
      () =>
        new SaveLoadError({
          message: "Saved state failed schema validation",
          operation: "load"
        })
    )
  )

const entryRecord = (entries: SavedState["modules"]) =>
  Effect.reduce(
    entries,
    HashMap.empty<string, ModuleParams>(),
    (state, entry) =>
      Effect.if(HashMap.has(state, entry.name), {
        onTrue: () =>
          Effect.fail(
            new SaveLoadError({
              message: Arr.join(Arr.make("Saved state has duplicate module entry '", entry.name, "'"), ""),
              operation: "load"
            })
          ),
        onFalse: () => Effect.succeed(HashMap.set(state, entry.name, entry.params))
      })
  )

const refsRecord = (refs: Iterable<ModuleParamRef>) =>
  Effect.reduce(
    refs,
    HashMap.empty<string, Ref.Ref<ModuleParams>>(),
    (state, ref) =>
      Effect.if(HashMap.has(state, ref.name), {
        onTrue: () =>
          Effect.fail(
            new SaveLoadError({
              message: Arr.join(Arr.make("Multiple target module owners share name '", ref.name, "'"), ""),
              operation: "load"
            })
          ),
        onFalse: () => Effect.succeed(HashMap.set(state, ref.name, ref.params))
      })
  )

class ParameterUpdate extends Data.Class<{
  readonly ref: Ref.Ref<ModuleParams>
  readonly params: ModuleParams
}> {}

/**
 * Reads the root and owned child parameters into a version-1 snapshot.
 *
 * @remarks
 * Traversal is depth-first, with siblings sorted by module name. Each Ref is
 * read separately, so callers must prevent concurrent parameter updates when
 * they require a point-in-time snapshot of the complete tree. The result omits
 * metadata.
 *
 * @typeParam I - Root module input fields.
 * @typeParam O - Root module output fields.
 * @param module - Root of the parameter tree to snapshot.
 * @returns Current parameter values in canonical ownership order.
 *
 * @see {@link load}
 * @see {@link SavedState}
 *
 * @since 0.1.0
 * @category constructors
 */
export const save = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module<I, O, E, R>
) =>
  Effect.gen(function*() {
    const refs = collectModuleParamRefs(module)
    const modules = yield* Effect.forEach(refs, (entry) =>
      Ref.get(entry.params).pipe(
        Effect.map((params) => ({
          name: entry.name,
          params
        }))
      ))

    return new SavedState({
      version: 1,
      modules
    })
  })

/**
 * Restores a module parameter tree from saved state.
 *
 * @remarks
 * Accepts a version-1 {@link SavedState} or an unknown value that decodes as
 * one. Before writing, it rejects duplicate names, unknown names, and missing
 * target names, and validates every demo against its destination's encoded
 * schemas, rejecting excess fields. Validated refs are updated in canonical target
 * order without interruption, so validation failure and cancellation before
 * the write phase leave the tree unchanged.
 *
 * Compatibility is by module name, envelope, and demonstration schemas, not
 * object identity or composition alias. Metadata is ignored. Concurrent writes by other effects
 * are not coordinated.
 *
 * @typeParam I - Root module input fields.
 * @typeParam O - Root module output fields.
 * @param module - Target parameter tree.
 * @param state - Candidate serialized envelope.
 * @returns Completion after every target Ref contains its matching saved value.
 *
 * @see {@link save}
 * @see {@link SavedState}
 *
 * @since 0.1.0
 * @category constructors
 */
export const load = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields, E, R>(
  module: Module<I, O, E, R>,
  state: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeSavedState(state)
    const refs = collectModuleParamRefs(module)
    const savedByName = yield* entryRecord(decoded.modules)
    const targetByName = yield* refsRecord(refs)

    yield* Effect.forEach(
      HashMap.keys(savedByName),
      (savedName) =>
        Effect.if(HashMap.has(targetByName, savedName), {
          onTrue: () => Effect.void,
          onFalse: () =>
            Effect.fail(
              new SaveLoadError({
                message: Arr.join(Arr.make("Saved state contains unknown module '", savedName, "'"), ""),
                operation: "load"
              })
            )
        }),
      { discard: true }
    )

    const updates = yield* Effect.forEach(
      refs,
      (target) =>
        Option.match(HashMap.get(savedByName, target.name), {
          onNone: () =>
            Effect.fail(
              new SaveLoadError({
                message: Arr.join(Arr.make("Saved state is missing params for module '", target.name, "'"), ""),
                operation: "load"
              })
            ),
          onSome: (params) =>
            Effect.forEach(params.demos, target.demoContract.decode, { discard: true }).pipe(
              Effect.mapError(() =>
                new SaveLoadError({
                  message: Arr.join(Arr.make("Saved demonstrations do not match module '", target.name, "'"), ""),
                  operation: "load"
                })
              ),
              Effect.as(new ParameterUpdate({ ref: target.params, params }))
            )
        })
    )

    yield* Effect.forEach(
      updates,
      (update) => Ref.set(update.ref, update.params),
      { discard: true }
    ).pipe(Effect.uninterruptible)
  })
