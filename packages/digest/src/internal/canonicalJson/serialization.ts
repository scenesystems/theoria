/** Native JSON scalar encoding and canonical collection traversal. @internal */

import * as Arr from "effect/Array"
import * as B from "effect/Boolean"
import type * as Data from "effect/Data"
import * as Equivalence from "effect/Equivalence"
import * as Match from "effect/Match"
import * as MutableHashMap from "effect/MutableHashMap"
import * as MutableHashSet from "effect/MutableHashSet"
import * as MutableList from "effect/MutableList"
import * as MutableRef from "effect/MutableRef"
import * as N from "effect/Number"
import * as Option from "effect/Option"
import * as Predicate from "effect/Predicate"
import * as Record from "effect/Record"
import * as Result from "effect/Result"
import * as Schema from "effect/Schema"
import * as SchemaCompiler from "effect/schema/SchemaCompiler"
import * as SchemaParser from "effect/SchemaParser"
import * as Str from "effect/String"
import * as Struct from "effect/Struct"

import { CyclicValue, UnsupportedValue } from "../../CanonicalJson.js"
import { InvalidUnicode } from "../../Utf8.js"
import { unicodeFault } from "../utf8.js"
import { emit, fail, Frame, push, type State } from "./state.js"

const encodeScalar = Schema.encodeUnknownResult(
  Schema.fromJsonString(Schema.Union([Schema.Null, Schema.Boolean, Schema.Finite, Schema.String]))
)
const encodeString = Schema.encodeResult(Schema.fromJsonString(Schema.String))
// Intrinsic view classification also covers cross-realm and future typed arrays,
// without reading user properties, Symbol.toStringTag, or Hash/Equal hooks.
const viewPredicate = (value: unknown): value is ArrayBufferView => ArrayBuffer.isView(value)
const BufferView = Schema.declare(viewPredicate)
// The boolean compiler operation avoids allocating a Schema issue for every
// ordinary object. It is exactly the declaration predicate, with no AST interpretation.
SchemaCompiler.set(BufferView.ast, {
  is: viewPredicate,
  decodeEffect: SchemaParser.decodeUnknownEffect(BufferView)
})
const isBufferView = Schema.is(BufferView)
const isNaN = Predicate.and(Predicate.isNumber, (value: number) => !Equivalence.strictEqual<number>()(value, value))
const isFinite = Schema.is(Schema.Finite)
const isHighSurrogate = N.between({ minimum: 0xd800, maximum: 0xdbff })
// Quotes, backslashes, lone surrogates, and code points below U+0020 require
// Schema escaping or the precise Unicode error validator. Valid pairs do not match.
const needsStringEncoding = /["\\\ud800-\udfff]|[^\u0020-\u{10ffff}]/u
const unsafeCharacter = Str.match(needsStringEncoding)
const concat = Str.ReducerConcat.combine

const reject = <E>(state: State<E>, reason: UnsupportedValue["reason"]): void => {
  fail(state, new UnsupportedValue({ reason }))
}

const open = <E>(state: State<E>, identity: object, token: string, cursor: Frame): void => {
  const ancestor = state.identity(identity)
  if (MutableHashSet.has(state.active, ancestor)) return fail(state, new CyclicValue())
  MutableHashSet.add(state.active, ancestor)
  emit(state, token)
  push(state, cursor)
}

const startString = <E>(state: State<E>, text: string, suffix: string): void => {
  if (N.isLessThanOrEqualTo(Str.length(text), 1_024) && Option.isNone(unsafeCharacter(text))) {
    return emit(state, concat(concat("\"", text), suffix))
  }
  emit(state, "\"")
  const frame = Frame.String({ text, at: 0, suffix })
  if (N.isLessThanOrEqualTo(Str.length(text), 1_024) && Option.isNone(MutableRef.get(state.failure))) {
    processString(state, frame)
  } else {
    push(state, frame)
  }
}

const makeVisit = <E>(state: State<E>): (value: unknown) => void => {
  const visit = Match.type<unknown>().pipe(
    Match.when(Predicate.isUndefined, () => reject(state, "undefined")),
    Match.when(Predicate.isBigInt, () => reject(state, "bigint")),
    Match.when(Predicate.isFunction, () => reject(state, "function")),
    Match.when(Predicate.isSymbol, () => reject(state, "symbol")),
    Match.when(Predicate.isDate, () => reject(state, "date")),
    Match.when(Predicate.isRegExp, () => reject(state, "regexp")),
    Match.when(isBufferView, () => reject(state, "typed-array")),
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
  return (value) => {
    if (Predicate.isString(value)) startString(state, value, "\"")
    else visit(value)
  }
}

const processString = <E>(state: State<E>, frame: Data.TaggedEnum.Value<Frame, "String">): void =>
  B.match(N.Equivalence(frame.at, Str.length(frame.text)), {
    onTrue: () => emit(state, frame.suffix),
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
          onTrue: () => emit(state, frame.suffix),
          onFalse: () => push(state, Frame.String({ text: frame.text, at: end, suffix: frame.suffix }))
        })
      }
      return Option.match(unsafeCharacter(text), {
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
  const keyCache = MutableHashMap.empty<string, string>()
  const startKey = (key: string): void => {
    const cached = MutableHashMap.get(keyCache, key)
    if (Option.isSome(cached)) return emit(state, cached.value)
    if (Option.isNone(unsafeCharacter(key))) {
      const quoted = concat(concat("\"", key), "\":")
      if (N.isGreaterThanOrEqualTo(MutableHashMap.size(keyCache), 128)) MutableHashMap.clear(keyCache)
      MutableHashMap.set(keyCache, key, quoted)
      emit(state, quoted)
    } else {
      startString(state, key, "\":")
    }
  }
  return Frame.$match({
    Visit: ({ value }) => {
      MutableList.take(state.stack)
      visit(value)
    },
    String: (value) => {
      MutableList.take(state.stack)
      processString(state, value)
    },
    Close: ({ identity, token }) => {
      MutableList.take(state.stack)
      emit(state, token)
      MutableHashSet.remove(state.active, state.identity(identity))
    },
    Array: (frame) => {
      const identity = frame.identity
      const at = MutableRef.getAndIncrement(frame.at)
      const value = Arr.get(identity, at)
      if (Option.isNone(value)) {
        MutableList.take(state.stack)
        return push(state, Frame.Close({ identity, token: "]" }))
      }
      if (!Predicate.hasProperty(identity, at)) return reject(state, "sparse-array")
      if (N.isGreaterThan(at, 0)) emit(state, ",")
      if (Option.isNone(MutableRef.get(state.failure))) visit(value.value)
    },
    Record: (frame) => {
      const { identity, keys } = frame
      const at = MutableRef.getAndIncrement(frame.at)
      if (N.isGreaterThanOrEqualTo(at, keys.length)) {
        MutableList.take(state.stack)
        return push(state, Frame.Close({ identity, token: "}" }))
      }
      const key = Arr.getUnsafe(keys, at)
      if (N.isGreaterThan(at, 0)) emit(state, ",")
      // keys is our own-key snapshot; the input graph must remain stable.
      const value = Struct.get(identity, key)
      if (N.isLessThanOrEqualTo(Str.length(key), 1_024)) {
        startKey(key)
        if (Option.isNone(MutableRef.get(state.failure))) visit(value)
      } else {
        push(state, Frame.Visit({ value }))
        startString(state, key, "\":")
      }
    }
  })
}
