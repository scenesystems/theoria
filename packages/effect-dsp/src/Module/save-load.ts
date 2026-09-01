/**
 * Module parameter persistence via Schema-serializable envelopes.
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
 * Snapshot module and sub-module parameters into a `SavedState` envelope.
 * Walks the parameter ownership tree in its canonical order and reads each
 * Ref. The resulting version-1 envelope omits metadata.
 *
 * @typeParam I - Root module input fields.
 * @typeParam O - Root module output fields.
 * @param module - Root of the parameter tree to snapshot.
 * @returns A version-1 snapshot in canonical parameter-tree order.
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
 * Accepts a version-1 {@link SavedState} or an unknown value that decodes as one. Before writing, it validates the envelope
 * and rejects duplicate names, unknown names, and missing target names. Refs
 * are then updated sequentially in canonical target order.
 * Compatibility is by module name and envelope schema, not object identity or
 * composition alias. Fails with `SaveLoadError` when validation or name-set
 * matching fails.
 *
 * @typeParam I - Root module input fields.
 * @typeParam O - Root module output fields.
 * @param module - Target parameter tree.
 * @param state - Candidate serialized envelope.
 * @returns An Effect that completes after all target Refs are updated.
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

    yield* Effect.forEach(
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
          onSome: (params) => Ref.set(target.params, params)
        }),
      { discard: true }
    )
  })
