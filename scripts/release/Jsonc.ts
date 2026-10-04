/** JSONC lexical leniency composed with Schema's JSON parser. */
import { Array, Boolean, Match, Option, Schema, SchemaGetter, String, Tuple } from "effect"

const lexemes = /("(?:[^"\\]|\\[\s\S])*(?:"|\\?$)|\/\/[^\r\n]*|\/\*[\s\S]*?(?:\*\/|$)|[ \t\r\n]+|[\s\S])/
const whitespace = (token: string) => Option.isSome(String.match(/^[ \t\r\n]+$/)(token))
const blockComment = (token: string) => Option.isSome(String.match(/^\/\*[\s\S]*\*\/$/)(token))
const blank = String.replace(/[^\r\n]/g, " ")
const valueEnd = (token: string) =>
  Boolean.or(String.startsWith("\"")(token), Option.isSome(String.match(/^[0-9el}\]]$/)(token)))
const containerEnd = (token: string) => Boolean.or(String.Equivalence(token, "}"), String.Equivalence(token, "]"))

const normalize = (source: string): string => {
  const tokens = Array.map(
    Array.filter(String.split(source, lexemes), String.isNonEmpty),
    (token) =>
      Match.value(token).pipe(
        Match.when(String.startsWith("//"), blank),
        Match.when(blockComment, blank),
        Match.orElse(() => token)
      )
  )
  const preceded = Array.mapAccum(tokens, false, (previousValue, token) =>
    Tuple.make(
      Boolean.match(whitespace(token), { onTrue: () => previousValue, onFalse: () => valueEnd(token) }),
      Tuple.make(token, previousValue)
    ))
  const normalized = Array.mapAccum(
    Array.reverse(preceded[1]),
    false,
    (nextContainer, [token, previousValue]) =>
      Tuple.make(
        Boolean.match(whitespace(token), { onTrue: () => nextContainer, onFalse: () => containerEnd(token) }),
        Boolean.match(Boolean.every(Array.make(previousValue, nextContainer, String.Equivalence(token, ","))), {
          onTrue: () => " ",
          onFalse: () => token
        })
      )
  )
  return Array.join(Array.reverse(normalized[1]), "")
}

/** Preserve quoted strings, invalid syntax and offsets; encoding emits strict JSON. */
export const parse = <S extends Schema.ConstraintCodec<unknown, unknown, never, never>>(schema: S) =>
  Schema.String.pipe(Schema.decodeTo(Schema.fromJsonString(schema), {
    decode: SchemaGetter.transform(normalize),
    encode: SchemaGetter.passthrough()
  }))
