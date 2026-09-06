/** Strict, single-shot reflection helpers for cooperative JCS admission. @internal */
import { Array as Arr, Data, Either, Option, Predicate } from "effect"

import type { InvalidUnicode, UnsupportedValue } from "../schemas/errors.js"
import { UnsupportedValue as Unsupported } from "../schemas/errors.js"

export type Primitive =
  | { readonly _tag: "Null" }
  | { readonly _tag: "Boolean"; readonly value: boolean }
  | { readonly _tag: "Number"; readonly value: number }
  | { readonly _tag: "String"; readonly value: string }
  | { readonly _tag: "Object"; readonly value: object }

export const Primitive = Data.taggedEnum<Primitive>()

export type Container =
  | { readonly _tag: "Array"; readonly identity: ReadonlyArray<unknown> }
  | { readonly _tag: "Record"; readonly identity: object }

export const Container = Data.taggedEnum<Container>()

/** One own-property descriptor read, captured once for the admission machine. */
export class Snapshot extends Data.Class<{
  readonly key: string
  readonly enumerable: boolean
  readonly value: unknown
}> {}

export type DescriptorSnapshot =
  | { readonly _tag: "Accessor"; readonly enumerable: boolean }
  | { readonly _tag: "Data"; readonly snapshot: Snapshot }

export const DescriptorSnapshot = Data.taggedEnum<DescriptorSnapshot>()

const unsupported = (reason: UnsupportedValue["reason"]): Unsupported => new Unsupported({ reason })

export const reflect = <A>(operation: () => A): Either.Either<A, Unsupported> =>
  Either.try({ try: operation, catch: () => unsupported("reflection-failure") })

export const classifyPrimitive = (value: unknown): Either.Either<Primitive, Unsupported | InvalidUnicode> => {
  if (Predicate.isNull(value)) return Either.right(Primitive.Null())
  if (Predicate.isUndefined(value)) return Either.left(unsupported("undefined"))
  if (Predicate.isBoolean(value)) return Either.right(Primitive.Boolean({ value }))
  if (Predicate.isString(value)) return Either.right(Primitive.String({ value }))
  if (Predicate.isNumber(value)) {
    if (Number.isNaN(value)) return Either.left(unsupported("nan"))
    return Number.isFinite(value)
      ? Either.right(Primitive.Number({ value }))
      : Either.left(unsupported("non-finite-number"))
  }
  if (Predicate.isBigInt(value)) return Either.left(unsupported("bigint"))
  if (Predicate.isFunction(value)) return Either.left(unsupported("function"))
  if (Predicate.isSymbol(value)) return Either.left(unsupported("symbol"))
  return Either.right(Primitive.Object({ value }))
}

export const classifyContainer = (value: object): Either.Either<Container, Unsupported> =>
  reflect(() => {
    if (ArrayBuffer.isView(value)) return unsupported("typed-array")
    if (value instanceof Date) return unsupported("date")
    if (value instanceof RegExp) return unsupported("regexp")
    if (value instanceof Map) return unsupported("map")
    if (value instanceof Set) return unsupported("set")
    if (value instanceof WeakMap || value instanceof WeakSet) {
      return unsupported("weak-collection")
    }
    if (value instanceof Promise) return unsupported("promise")
    if (Arr.isArray(value)) return Container.Array({ identity: value })
    const prototype = Reflect.getPrototypeOf(value)
    if (prototype !== Object.prototype && !Predicate.isNull(prototype)) return unsupported("unsupported-prototype")
    return Container.Record({ identity: value })
  }).pipe(Either.flatMap((result) => result instanceof Unsupported ? Either.left(result) : Either.right(result)))

export const ownKeys = (identity: object): Either.Either<ReadonlyArray<PropertyKey>, Unsupported> =>
  reflect(() => Reflect.ownKeys(identity))

const ownDescriptor = (identity: object, key: PropertyKey): Either.Either<PropertyDescriptor, Unsupported> =>
  Either.flatMap(
    reflect(() => Reflect.getOwnPropertyDescriptor(identity, key)),
    (descriptor) =>
      Option.match(Option.fromNullable(descriptor), {
        onNone: () => Either.left(unsupported("reflection-failure")),
        onSome: Either.right
      })
  )

export const descriptorShape = (identity: object, key: PropertyKey) =>
  Either.map(ownDescriptor(identity, key), (descriptor) => ({
    accessor: !("value" in descriptor),
    enumerable: descriptor.enumerable === true
  }))

export const snapshot = (identity: object, key: string): Either.Either<DescriptorSnapshot, Unsupported> =>
  Either.map(ownDescriptor(identity, key), (descriptor) => {
    const enumerable = descriptor.enumerable === true
    return "value" in descriptor
      ? DescriptorSnapshot.Data({ snapshot: new Snapshot({ key, enumerable, value: descriptor.value }) })
      : DescriptorSnapshot.Accessor({ enumerable })
  })

export const rejection = unsupported
