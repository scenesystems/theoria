/**
 * Strict canonical-value admission and immutable descriptor snapshots.
 *
 * JavaScript Proxy traps are the explicit reflection boundary. Every reflective
 * operation is attempted once and any failure is closed to `reflection-failure`.
 * Property getters are never evaluated.
 *
 * @internal
 */

import { Array as Arr, Data, Either, HashMap, HashSet, Option, Order, Predicate } from "effect"

import type { CanonicalizationError } from "../schemas/errors.js"
import { CyclicValue, UnsupportedValue } from "../schemas/errors.js"
import { unicodeFault } from "./unicode.js"

export type AdmittedValue =
  | { readonly _tag: "Null" }
  | { readonly _tag: "Boolean"; readonly value: boolean }
  | { readonly _tag: "Number"; readonly value: number }
  | { readonly _tag: "String"; readonly value: string }
  | { readonly _tag: "Array"; readonly identity: object; readonly values: ReadonlyArray<unknown> }
  | {
    readonly _tag: "Record"
    readonly identity: object
    readonly entries: ReadonlyArray<readonly [string, unknown]>
  }

export const AdmittedValue = Data.taggedEnum<AdmittedValue>()

type ObjectClassification =
  | { readonly _tag: "Array"; readonly identity: ReadonlyArray<unknown> }
  | { readonly _tag: "Record"; readonly identity: object }
  | { readonly _tag: "Rejected"; readonly reason: UnsupportedValue["reason"] }

const ObjectClassification = Data.taggedEnum<ObjectClassification>()

type PropertySnapshot =
  | { readonly _tag: "Data"; readonly key: string; readonly value: unknown; readonly enumerable: boolean }
  | { readonly _tag: "Accessor"; readonly key: string; readonly enumerable: boolean }

const PropertySnapshot = Data.taggedEnum<PropertySnapshot>()

const unsupported = (reason: UnsupportedValue["reason"]): Either.Either<never, UnsupportedValue> =>
  Either.left(new UnsupportedValue({ reason }))

const reflectionFailure = (): UnsupportedValue => new UnsupportedValue({ reason: "reflection-failure" })

const reflect = <A>(operation: () => A): Either.Either<A, UnsupportedValue> =>
  Either.try({ try: operation, catch: reflectionFailure })

const classifyObject = (value: object): Either.Either<ObjectClassification, UnsupportedValue> =>
  reflect(() => {
    if (ArrayBuffer.isView(value)) return ObjectClassification.Rejected({ reason: "typed-array" })
    if (value instanceof globalThis.Date) return ObjectClassification.Rejected({ reason: "date" })
    if (value instanceof globalThis.RegExp) return ObjectClassification.Rejected({ reason: "regexp" })
    if (value instanceof globalThis.Map) return ObjectClassification.Rejected({ reason: "map" })
    if (value instanceof globalThis.Set) return ObjectClassification.Rejected({ reason: "set" })
    if (value instanceof globalThis.WeakMap || value instanceof globalThis.WeakSet) {
      return ObjectClassification.Rejected({ reason: "weak-collection" })
    }
    if (value instanceof globalThis.Promise) return ObjectClassification.Rejected({ reason: "promise" })
    if (Arr.isArray(value)) return ObjectClassification.Array({ identity: value })

    const prototype = Reflect.getPrototypeOf(value)
    return prototype === Object.prototype || prototype === null
      ? ObjectClassification.Record({ identity: value })
      : ObjectClassification.Rejected({ reason: "unsupported-prototype" })
  })

const snapshotProperty = (identity: object, key: string): Either.Either<PropertySnapshot, UnsupportedValue> =>
  Either.flatMap(
    reflect(() => Reflect.getOwnPropertyDescriptor(identity, key)),
    (descriptor): Either.Either<PropertySnapshot, UnsupportedValue> =>
      Option.match(Option.fromNullable(descriptor), {
        onNone: () => unsupported("reflection-failure"),
        onSome: (present) =>
          "value" in present
            ? Either.right(
              PropertySnapshot.Data({ key, value: present.value, enumerable: present.enumerable === true })
            )
            : Either.right(PropertySnapshot.Accessor({ key, enumerable: present.enumerable === true }))
      })
  )

const snapshotProperties = (
  identity: object,
  keys: ReadonlyArray<string>
): Either.Either<Array<PropertySnapshot>, UnsupportedValue> =>
  Either.all(Arr.map(keys, (key) => snapshotProperty(identity, key)))

const dataEntries = (snapshots: ReadonlyArray<PropertySnapshot>): Array<readonly [string, unknown]> =>
  Arr.filterMap(
    snapshots,
    PropertySnapshot.$match({
      Data: ({ key, value }) => Option.some<readonly [string, unknown]>([key, value]),
      Accessor: () => Option.none()
    })
  )

const entryOrder: Order.Order<readonly [string, unknown]> = Order.mapInput(
  Order.string,
  ([key]: readonly [string, unknown]) => key
)

const snapshotRecord = (
  identity: object,
  keys: ReadonlyArray<string>
): Either.Either<AdmittedValue, CanonicalizationError> =>
  Either.flatMap(
    snapshotProperties(identity, keys),
    (snapshots): Either.Either<AdmittedValue, CanonicalizationError> => {
      if (Arr.some(snapshots, PropertySnapshot.$is("Accessor"))) return unsupported("accessor-property")
      if (Arr.some(snapshots, ({ enumerable }) => !enumerable)) return unsupported("non-enumerable-property")

      const entries = Arr.sort(dataEntries(snapshots), entryOrder)
      const invalidKey = Arr.findFirst(entries, ([key]) => Option.isSome(unicodeFault(key)))
      return Option.match(invalidKey, {
        onNone: () => Either.right(AdmittedValue.Record({ identity, entries })),
        onSome: ([key]) =>
          Option.match(unicodeFault(key), {
            onNone: () => unsupported("reflection-failure"),
            onSome: Either.left
          })
      })
    }
  )

const descriptorEntry = (snapshot: PropertySnapshot): readonly [string, PropertySnapshot] => [
  snapshot.key,
  snapshot
]

const isArrayIndexBelow = (key: string, length: number): boolean => {
  const index = Number(key)
  return Number.isInteger(index) && index >= 0 && index < length && `${index}` === key
}

const snapshotArray = (
  identity: ReadonlyArray<unknown>,
  keys: ReadonlyArray<string>
): Either.Either<AdmittedValue, CanonicalizationError> =>
  Either.flatMap(snapshotProperties(identity, keys), (snapshots) => {
    if (Arr.some(snapshots, PropertySnapshot.$is("Accessor"))) return unsupported("accessor-property")

    const descriptors = HashMap.fromIterable(Arr.map(snapshots, descriptorEntry))
    const length = HashMap.get(descriptors, "length").pipe(
      Option.flatMap(PropertySnapshot.$match({
        Data: ({ value }) => Predicate.isNumber(value) ? Option.some<number>(value) : Option.none<number>(),
        Accessor: () => Option.none<number>()
      }))
    )
    if (Option.isNone(length)) return unsupported("reflection-failure")

    const nonEnumerableIndex = Arr.some(
      snapshots,
      ({ enumerable, key }) => isArrayIndexBelow(key, length.value) && !enumerable
    )
    if (nonEnumerableIndex) return unsupported("non-enumerable-property")
    const indexCount = Arr.filter(keys, (key) => isArrayIndexBelow(key, length.value)).length
    if (indexCount < length.value) return unsupported("sparse-array")
    if (keys.length !== length.value + 1) return unsupported("array-extra-property")

    const expectedKeys = Arr.makeBy(length.value, (index) => `${index}`)
    const values = Arr.filterMap(expectedKeys, (key) =>
      HashMap.get(descriptors, key).pipe(
        Option.flatMap(PropertySnapshot.$match({
          Data: ({ value }) => Option.some(value),
          Accessor: () => Option.none()
        }))
      ))
    return Either.right(AdmittedValue.Array({ identity, values }))
  })

const snapshotContainer = (
  classification: Data.TaggedEnum.Value<ObjectClassification, "Array" | "Record">,
  active: HashSet.HashSet<object>
): Either.Either<AdmittedValue, CanonicalizationError> =>
  Either.flatMap(reflect(() => Reflect.ownKeys(classification.identity)), (ownKeys) => {
    if (Arr.some(ownKeys, Predicate.isSymbol)) return unsupported("symbol-property")
    return Either.flatMap(reflect(() => HashSet.has(active, classification.identity)), (isActive) => {
      if (isActive) return Either.left(new CyclicValue())

      const keys = Arr.filter(ownKeys, Predicate.isString)
      return ObjectClassification.$match(classification, {
        Array: ({ identity }) => snapshotArray(identity, keys),
        Record: ({ identity }) => snapshotRecord(identity, keys),
        Rejected: ({ reason }) => unsupported(reason)
      })
    })
  })

const admitObject = (
  value: object,
  active: HashSet.HashSet<object>
): Either.Either<AdmittedValue, CanonicalizationError> =>
  Either.flatMap(
    classifyObject(value),
    ObjectClassification.$match({
      Array: (classification) => snapshotContainer(classification, active),
      Record: (classification) => snapshotContainer(classification, active),
      Rejected: ({ reason }) => unsupported(reason)
    })
  )

/** @internal */
export const admitValue = (
  value: unknown,
  active: HashSet.HashSet<object>
): Either.Either<AdmittedValue, CanonicalizationError> => {
  if (value === null) return Either.right(AdmittedValue.Null())
  if (Predicate.isUndefined(value)) return unsupported("undefined")
  if (Predicate.isBoolean(value)) return Either.right(AdmittedValue.Boolean({ value }))
  if (Predicate.isString(value)) {
    return Option.match(unicodeFault(value), {
      onNone: () => Either.right(AdmittedValue.String({ value })),
      onSome: Either.left
    })
  }
  if (Predicate.isNumber(value)) {
    if (Number.isNaN(value)) return unsupported("nan")
    return Number.isFinite(value)
      ? Either.right(AdmittedValue.Number({ value }))
      : unsupported("non-finite-number")
  }
  if (Predicate.isBigInt(value)) return unsupported("bigint")
  if (Predicate.isFunction(value)) return unsupported("function")
  if (Predicate.isSymbol(value)) return unsupported("symbol")
  return admitObject(value, active)
}
