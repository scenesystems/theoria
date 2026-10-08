/**
 * Effective bound defaults for predictors reached through module declarations.
 *
 * A bound map applies to its whole subtree and is keyed by predictor identity:
 * a value stored under any path that reaches a predictor is that predictor's
 * default at that level, and the outermost level carrying a value wins. Below
 * the outermost such level, every path to a shared predictor must project the
 * same effective default; otherwise the projection is inconsistent.
 *
 * @since 0.7.0
 */
import { Array as Arr, Boolean, Data, Equal, Equivalence, HashMap, Option, Order, Record, String as Str } from "effect"
import type { Ref } from "effect"
import type { Structure } from "../../../Module.js"
import type { ModuleParameters } from "../../../ModuleParameters.js"
import type { ParameterSet } from "../../../ParameterSet.js"

/**
 * One predictor with every declaration path reaching it and its effective default.
 * `value` is the first projected default in path order; `consistent` is false
 * when another path or same-level key projects a different default.
 * @since 0.7.0
 * @category models
 */
export class Effective extends Data.Class<{
  readonly parameters: Ref.Ref<ModuleParameters>
  readonly name: string
  readonly paths: Arr.NonEmptyReadonlyArray<string>
  readonly value: Option.Option<ModuleParameters>
  readonly consistent: boolean
}> {}

const predictorIdentity = Equivalence.strictEqual<Ref.Ref<ModuleParameters>>()
const defaultEquivalence = Option.makeEquivalence(Equal.asEquivalence<ModuleParameters>())
const aliasOrder = Order.mapInput(Order.String, (entry: readonly [string, Structure]) => entry[0])

/**
 * Caller-local declarations in path order, falling back to identity-keyed children.
 * @since 0.7.0
 * @category combinators
 */
export const sortedDeclarations = (module: Structure): ReadonlyArray<readonly [string, Structure]> =>
  Arr.sort(
    Record.toEntries(
      Option.getOrElse(
        Option.fromUndefinedOr(module.declarations),
        () => Record.fromEntries(HashMap.toEntries(module.subModules))
      )
    ),
    aliasOrder
  )

const merge = (entries: ReadonlyArray<Effective>): ReadonlyArray<Effective> =>
  Arr.reduce(
    entries,
    Arr.empty<Effective>(),
    (merged, entry) =>
      Option.match(Arr.findFirstIndex(merged, (existing) => predictorIdentity(existing.parameters, entry.parameters)), {
        onNone: () => Arr.append(merged, entry),
        onSome: (index) =>
          Arr.map(merged, (existing, position) =>
            Boolean.match(position === index, {
              onFalse: () => existing,
              onTrue: () =>
                new Effective({
                  parameters: existing.parameters,
                  name: existing.name,
                  paths: Arr.appendAll(existing.paths, entry.paths),
                  value: existing.value,
                  consistent: existing.consistent && entry.consistent && defaultEquivalence(existing.value, entry.value)
                })
            }))
      })
  )

/**
 * Resolves the declarations below `path`, merging alternate paths to one predictor.
 * @since 0.7.0
 * @category combinators
 */
export const resolveDeclarations = (
  path: string,
  declarations: ReadonlyArray<readonly [string, Structure]>
): ReadonlyArray<Effective> =>
  merge(Arr.flatMap(declarations, ([alias, child]) => resolve(child, Arr.join(Arr.make(path, alias), "."))))

/**
 * Resolves every predictor below `module`, whose own path is `path`.
 * @since 0.7.0
 * @category combinators
 */
export const resolve = (module: Structure, path: string): ReadonlyArray<Effective> => {
  const bound = Option.getOrElse(Option.fromUndefinedOr(module.boundParameters), (): ParameterSet => ({}))
  const local = (entryPath: string) => Str.concat(module.name, Str.slice(Str.length(path))(entryPath))
  return Arr.map(
    Arr.match(sortedDeclarations(module), {
      onEmpty: () =>
        Arr.make(
          new Effective({
            parameters: module.parameters,
            name: module.name,
            paths: Arr.make(path),
            value: Option.none(),
            consistent: true
          })
        ),
      onNonEmpty: (declarations) => resolveDeclarations(path, declarations)
    }),
    (entry) =>
      Arr.match(Arr.flatMap(entry.paths, (entryPath) => Option.toArray(Record.get(bound, local(entryPath)))), {
        onEmpty: () => entry,
        onNonEmpty: (values) =>
          new Effective({
            parameters: entry.parameters,
            name: entry.name,
            paths: entry.paths,
            value: Option.some(Arr.headNonEmpty(values)),
            consistent: Arr.every(values, (value) => Equal.equals(value, Arr.headNonEmpty(values)))
          })
      })
  )
}
