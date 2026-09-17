/** Native JSON scalar encoding and canonical collection traversal. @internal */

import {
  Array as Arr,
  Boolean as B,
  Chunk,
  type Data,
  Either,
  Match,
  MutableHashSet,
  Number as N,
  Option,
  Predicate,
  Record,
  Schema,
  String as Str
} from "effect"

import { CyclicValue, UnsupportedValue } from "../../CanonicalJson.js"
import { InvalidUnicode } from "../../Utf8.js"
import { unicodeFault } from "../utf8.js"
import { Ancestor, emit, fail, Frame, push, type State } from "./state.js"

const encodeScalar = Schema.encodeUnknownEither(
  Schema.parseJson(Schema.Union(Schema.Null, Schema.Boolean, Schema.JsonNumber, Schema.String))
)
const isNaN = Predicate.and(Predicate.isNumber, Predicate.not(Schema.is(Schema.NonNaN)))
const isFinite = Schema.is(Schema.JsonNumber)
const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff })

const reject = <E>(state: State<E>, reason: UnsupportedValue["reason"]): void =>
  fail(state, new UnsupportedValue({ reason }))

const open = <E>(state: State<E>, identity: object, token: string, cursor: Frame): void => {
  const ancestor = new Ancestor({ identity })
  B.match(MutableHashSet.has(state.active, ancestor), {
    onTrue: () => fail(state, new CyclicValue()),
    onFalse: () => {
      MutableHashSet.add(state.active, ancestor)
      emit(state, token)
      push(state, cursor)
    }
  })
}

const startString = <E>(state: State<E>, text: string, suffix: string): void => {
  emit(state, "\"")
  push(state, Frame.String({ text, at: 0, suffix }))
}

const visit = <E>(state: State<E>, value: unknown): void =>
  Match.value(value).pipe(
    Match.when(Predicate.isUndefined, () => reject(state, "undefined")),
    Match.when(Predicate.isBigInt, () => reject(state, "bigint")),
    Match.when(Predicate.isFunction, () => reject(state, "function")),
    Match.when(Predicate.isSymbol, () => reject(state, "symbol")),
    Match.when(Predicate.isDate, () => reject(state, "date")),
    Match.when(Predicate.isRegExp, () => reject(state, "regexp")),
    Match.when(Predicate.isUint8Array, () => reject(state, "typed-array")),
    Match.when(Predicate.isMap, () => reject(state, "map")),
    Match.when(Predicate.isSet, () => reject(state, "set")),
    Match.when(Predicate.isPromise, () => reject(state, "promise")),
    Match.when(isNaN, () => reject(state, "nan")),
    Match.when(Predicate.and(Predicate.isNumber, Predicate.not(isFinite)), () => reject(state, "non-finite-number")),
    Match.when(Predicate.isString, (text) => startString(state, text, "")),
    Match.when(Arr.isArray, (identity) => open(state, identity, "[", Frame.Array({ identity, at: 0 }))),
    Match.when(Predicate.isRecord, (identity) =>
      open(
        state,
        identity,
        "{",
        Frame.Record({
          identity,
          keys: Chunk.fromIterable(Arr.sort(Record.keys(identity), Str.Order)),
          at: 0
        })
      )),
    Match.orElse((scalar) =>
      Either.match(encodeScalar(scalar), {
        onLeft: () => reject(state, "unsupported-value"),
        onRight: (encoded) => emit(state, encoded)
      })
    )
  )

const processString = <E>(state: State<E>, frame: Data.TaggedEnum.Value<Frame, "String">): void =>
  B.match(N.Equivalence(frame.at, Str.length(frame.text)), {
    onTrue: () => emit(state, Str.concat("\"", frame.suffix)),
    onFalse: () => {
      // Keep the native scalar encoder bounded without splitting a surrogate pair.
      const limit = N.min(N.sum(frame.at, 1_024), Str.length(frame.text))
      const end = B.match(Option.exists(Str.charCodeAt(frame.text, N.decrement(limit)), isHighSurrogate), {
        onTrue: () => N.min(N.increment(limit), Str.length(frame.text)),
        onFalse: () => limit
      })
      const text = Str.slice(frame.at, end)(frame.text)
      Option.match(unicodeFault(text), {
        onSome: (error) =>
          fail(state, new InvalidUnicode({ kind: error.kind, codeUnitIndex: N.sum(frame.at, error.codeUnitIndex) })),
        onNone: () =>
          Either.match(encodeScalar(text), {
            onLeft: () => reject(state, "unsupported-value"),
            onRight: (encoded) => {
              emit(state, Str.slice(1, -1)(encoded))
              push(state, Frame.String({ text: frame.text, at: end, suffix: frame.suffix }))
            }
          })
      })
    }
  })

export const process = <E>(state: State<E>, frame: Frame): void =>
  Frame.$match(frame, {
    Visit: ({ value }) => visit(state, value),
    String: (value) => processString(state, value),
    Close: ({ identity, token }) => {
      emit(state, token)
      MutableHashSet.remove(state.active, new Ancestor({ identity }))
    },
    Array: ({ identity, at }) =>
      Option.match(Arr.get(identity, at), {
        onNone: () => push(state, Frame.Close({ identity, token: "]" })),
        onSome: (value) =>
          B.match(Predicate.hasProperty(identity, at), {
            onFalse: () => reject(state, "sparse-array"),
            onTrue: () => {
              B.match(N.greaterThan(at, 0), { onTrue: () => emit(state, ","), onFalse: () => undefined })
              push(state, Frame.Array({ identity, at: N.increment(at) }))
              push(state, Frame.Visit({ value }))
            }
          })
      }),
    Record: ({ identity, keys, at }) =>
      Option.match(Chunk.get(keys, at), {
        onNone: () => push(state, Frame.Close({ identity, token: "}" })),
        onSome: (key) => {
          B.match(N.greaterThan(at, 0), { onTrue: () => emit(state, ","), onFalse: () => undefined })
          push(state, Frame.Record({ identity, keys, at: N.increment(at) }))
          push(state, Frame.Visit({ value: Option.getOrThrow(Record.get(identity, key)) }))
          startString(state, key, ":")
        }
      })
  })
