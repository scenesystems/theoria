/** Native JSON scalar encoding and canonical collection traversal. @internal */

import {
  Array as Arr,
  Boolean as B,
  type Data,
  Equivalence,
  Match,
  MutableHashSet,
  MutableRef,
  Number as N,
  Option,
  Predicate,
  Record,
  Result,
  Schema,
  String as Str
} from "effect"

import { CyclicValue, UnsupportedValue } from "../../CanonicalJson.js"
import { InvalidUnicode } from "../../Utf8.js"
import { unicodeFault } from "../utf8.js"
import { emit, fail, Frame, push, type State } from "./state.js"

const encodeScalar = Schema.encodeUnknownResult(
  Schema.fromJsonString(Schema.Union([Schema.Null, Schema.Boolean, Schema.Finite, Schema.String]))
)
const encodeString = Schema.encodeResult(Schema.fromJsonString(Schema.String))
const isNaN = Predicate.and(Predicate.isNumber, (value: number) => !Equivalence.strictEqual<number>()(value, value))
const isFinite = Schema.is(Schema.Finite)
const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff })
// Quotes, backslashes, lone surrogates, and code points below U+0020 require
// Schema escaping or the precise Unicode error validator. Valid pairs do not match.
const needsStringEncoding = /["\\\ud800-\udfff]|[^\u0020-\u{10ffff}]/u

const reject = <E>(state: State<E>, reason: UnsupportedValue["reason"]): void => {
  fail(state, new UnsupportedValue({ reason }))
}

const open = <E>(state: State<E>, identity: object, token: string, cursor: Frame): void => {
  const ancestor = state.identity(identity)
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
  B.match(Str.length(text) <= 1_024 && Option.isNone(Str.search(text, needsStringEncoding)), {
    onTrue: () => emit(state, Str.concat(Str.concat("\"", text), Str.concat("\"", suffix))),
    onFalse: () => {
      emit(state, "\"")
      const frame = Frame.String({ text, at: 0, suffix })
      B.match(N.isLessThanOrEqualTo(Str.length(text), 1_024) && Option.isNone(MutableRef.get(state.failure)), {
        onTrue: () => processString(state, frame),
        onFalse: () => push(state, frame)
      })
    }
  })
}

const makeVisit = <E>(state: State<E>): (value: unknown) => void =>
  Match.type<unknown>().pipe(
    Match.when(Predicate.isString, (text) => startString(state, text, "")),
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
    Match.when(
      Arr.isArray,
      (identity) => open(state, identity, "[", Frame.Array({ identity, at: MutableRef.make(0) }))
    ),
    Match.when(Predicate.isObject, (identity) =>
      open(
        state,
        identity,
        "{",
        Frame.Record({
          identity,
          keys: Arr.sort(Record.keys(identity), Str.Order),
          at: MutableRef.make(0)
        })
      )),
    Match.orElse((scalar) =>
      Result.match(encodeScalar(scalar), {
        onFailure: () => reject(state, "unsupported-value"),
        onSuccess: (encoded) => emit(state, encoded)
      })
    )
  )

const processString = <E>(state: State<E>, frame: Data.TaggedEnum.Value<Frame, "String">): void =>
  B.match(N.Equivalence(frame.at, Str.length(frame.text)), {
    onTrue: () => emit(state, Str.concat("\"", frame.suffix)),
    onFalse: () => {
      // Keep the native scalar encoder bounded without splitting a surrogate pair.
      const limit = N.min(N.sum(frame.at, 1_024), Str.length(frame.text))
      const end = B.match(
        limit < Str.length(frame.text) &&
          Option.exists(Str.charCodeAt(frame.text, N.decrement(limit)), isHighSurrogate),
        {
          onTrue: () => N.min(N.increment(limit), Str.length(frame.text)),
          onFalse: () => limit
        }
      )
      const text = Str.slice(frame.at, end)(frame.text)
      const finish = (content: string): void => {
        emit(state, content)
        B.match(N.Equivalence(end, Str.length(frame.text)) && Option.isNone(MutableRef.get(state.failure)), {
          onTrue: () => emit(state, Str.concat("\"", frame.suffix)),
          onFalse: () => push(state, Frame.String({ text: frame.text, at: end, suffix: frame.suffix }))
        })
      }
      return Option.match(Str.search(text, needsStringEncoding), {
        // In Unicode mode valid pairs do not match. No matching character means
        // both well-formed Unicode and JSON content requiring no escaping.
        onNone: () => finish(text),
        onSome: () =>
          Option.match(unicodeFault(text), {
            onSome: (error) =>
              fail(
                state,
                new InvalidUnicode({ kind: error.kind, codeUnitIndex: N.sum(frame.at, error.codeUnitIndex) })
              ),
            onNone: () =>
              Result.match(encodeString(text), {
                onFailure: () => reject(state, "unsupported-value"),
                onSuccess: (encoded) => finish(Str.slice(1, -1)(encoded))
              })
          })
      })
    }
  })

export const makeProcessor = <E>(state: State<E>): (frame: Frame) => void => {
  const visit = makeVisit(state)
  return Frame.$match({
    Visit: ({ value }) => visit(value),
    String: (value) => processString(state, value),
    Close: ({ identity, token }) => {
      emit(state, token)
      MutableHashSet.remove(state.active, state.identity(identity))
    },
    Array: (frame) => {
      const identity = frame.identity
      const at = MutableRef.getAndIncrement(frame.at)
      return (
        Option.match(Arr.get(identity, at), {
          onNone: () => push(state, Frame.Close({ identity, token: "]" })),
          onSome: (value) =>
            B.match(Predicate.hasProperty(identity, at), {
              onFalse: () => reject(state, "sparse-array"),
              onTrue: () => {
                B.match(N.isGreaterThan(at, 0), { onTrue: () => emit(state, ","), onFalse: () => undefined })
                push(state, frame)
                return B.match(Option.isNone(MutableRef.get(state.failure)), {
                  onTrue: () => visit(value),
                  onFalse: () => undefined
                })
              }
            })
        })
      )
    },
    Record: (frame) => {
      const { identity, keys } = frame
      const at = MutableRef.getAndIncrement(frame.at)
      return Option.match(Arr.get(keys, at), {
        onNone: () => push(state, Frame.Close({ identity, token: "}" })),
        onSome: (key) => {
          B.match(N.isGreaterThan(at, 0), { onTrue: () => emit(state, ","), onFalse: () => undefined })
          push(state, frame)
          const value = Option.getOrThrow(Record.get(identity, key))
          B.match(Str.length(key) <= 1_024, {
            onTrue: () => {
              startString(state, key, ":")
              B.match(Option.isNone(MutableRef.get(state.failure)), {
                onTrue: () => visit(value),
                onFalse: () => undefined
              })
            },
            onFalse: () => {
              push(state, Frame.Visit({ value }))
              startString(state, key, ":")
            }
          })
        }
      })
    }
  })
}
