/**
 * Versioned snapshots of module parameter ownership trees.
 *
 * @since 0.1.0
 */
import { Array as Arr, Effect, Option, Record, Ref, Schema } from "effect"
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

const entryRecord = (entries: ReadonlyArray<SavedState["modules"][number]>) =>
  Effect.reduce(
    entries,
    Record.empty<string, SavedState["modules"][number]["params"]>(),
    (state, entry) =>
      Record.has(state, entry.name)
        ? Effect.fail(
          new SaveLoadError({
            message: `Saved state has duplicate module entry '${entry.name}'`,
            operation: "load"
          })
        )
        : Effect.succeed(Record.set(state, entry.name, entry.params))
  )

const refsRecord = (
  refs: ReadonlyArray<ModuleParamRef>
): Readonly<Record<string, Ref.Ref<SavedState["modules"][number]["params"]>>> =>
  Arr.reduce(
    refs,
    Record.empty<string, Ref.Ref<SavedState["modules"][number]["params"]>>(),
    (state, ref) => Record.set(state, ref.name, ref.params)
  )

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
export const save = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(module: Module<I, O>) =>
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
 * target names. Validated refs are updated sequentially in canonical target
 * order without interruption, so validation failure and cancellation before
 * the write phase leave the tree unchanged.
 *
 * Compatibility is by module name and envelope schema, not object identity or
 * composition alias. Metadata is ignored. Concurrent writes by other effects
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
export const load = <I extends Schema.Struct.Fields, O extends Schema.Struct.Fields>(
  module: Module<I, O>,
  state: unknown
) =>
  Effect.gen(function*() {
    const decoded = yield* decodeSavedState(state)
    const refs = collectModuleParamRefs(module)
    const savedByName = yield* entryRecord(decoded.modules)
    const targetByName = refsRecord(refs)

    yield* Effect.forEach(
      Record.keys(savedByName),
      (savedName) =>
        Record.has(targetByName, savedName)
          ? Effect.void
          : Effect.fail(
            new SaveLoadError({
              message: `Saved state contains unknown module '${savedName}'`,
              operation: "load"
            })
          ),
      { discard: true }
    )

    const updates = yield* Effect.forEach(
      refs,
      (target) =>
        Option.match(Option.fromNullable(savedByName[target.name]), {
          onNone: () =>
            Effect.fail(
              new SaveLoadError({
                message: `Saved state is missing params for module '${target.name}'`,
                operation: "load"
              })
            ),
          onSome: (params) => Effect.succeed({ ref: target.params, params })
        })
    )

    yield* Effect.forEach(
      updates,
      (update) => Ref.set(update.ref, update.params),
      { discard: true }
    ).pipe(Effect.uninterruptible)
  })
