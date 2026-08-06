/** Cooperative Effect Schema type-literal interpreter. @internal */

import {
  Array as Arr,
  Effect,
  Either,
  MutableList,
  MutableRef,
  Option,
  ParseResult,
  Predicate,
  Schema,
  SchemaAST
} from "effect"

import {
  type EncodeState,
  failResult,
  getKeysForIndexSignature,
  holdSemanticResult,
  type Parse,
  runAnnotatedTasks,
  type SemanticResult
} from "./schema-encode-model.js"
import {
  orderedRecordOutput,
  parseRecordValue,
  recordErrors,
  recordFailure,
  RecordResultState,
  RecordState,
  scanRecord
} from "./schema-encode-record-state.js"

const computeResult = (
  ast: SchemaAST.TypeLiteral,
  input: Record<PropertyKey, unknown>,
  state: RecordResultState,
  options: SchemaAST.ParseOptions,
  inputKeys: Option.Option<ReadonlyArray<PropertyKey>>,
  expectedKeys: ReadonlyArray<PropertyKey>
): SemanticResult => {
  const errors = recordErrors(state.errors)
  if (Arr.isNonEmptyReadonlyArray(errors)) {
    return failResult(new ParseResult.Composite(ast, input, errors, state.output))
  }
  return Either.right(
    options.propertyOrder === "original"
      ? orderedRecordOutput(
        state.output,
        Option.getOrElse(inputKeys, () => Reflect.ownKeys(input)),
        expectedKeys
      )
      : state.output
  )
}

export const parseRecord = (
  ast: SchemaAST.TypeLiteral,
  input: unknown,
  parse: Parse,
  direction: "Decode" | "Encode",
  options: SchemaAST.ParseOptions,
  cooperation: EncodeState
): Effect.Effect<SemanticResult> => {
  if (ast.propertySignatures.length === 0 && ast.indexSignatures.length === 0) {
    return Effect.succeed(
      Predicate.isNotNullable(input) ? Either.right(input) : failResult(new ParseResult.Type(ast, input))
    )
  }
  if (!Predicate.isRecord(input)) return Effect.succeed(failResult(new ParseResult.Type(ast, input)))

  return Effect.suspend(() => {
    const state = new RecordState()
    const allErrors = options?.errors === "all"
    const expectedKeys = Arr.map(ast.propertySignatures, (property) => property.name)
    const expectedKeysMap: Record<PropertyKey, null> = {}
    Arr.forEach(expectedKeys, (key) => {
      expectedKeysMap[key] = null
    })
    const expectedKey = (key: PropertyKey) => Object.prototype.hasOwnProperty.call(expectedKeysMap, key)
    const excessMode = Option.fromNullable(options.onExcessProperty)
    const inputKeys = Option.flatMap(
      excessMode,
      (mode) => mode === "ignore" ? Option.none() : Option.some(Reflect.ownKeys(input))
    )
    const expectedAst = SchemaAST.Union.make(Arr.appendAll(
      Arr.map(ast.indexSignatures, (signature) => signature.parameter),
      Arr.map(
        expectedKeys,
        (key) => typeof key === "symbol" ? new SchemaAST.UniqueSymbol(key) : new SchemaAST.Literal(key)
      )
    ))
    const expectedSchema = Schema.make<unknown, unknown, never>(expectedAst)

    return Effect.map(
      Effect.gen(function*() {
        yield* Option.match(inputKeys, {
          onNone: () => Effect.void,
          onSome: (keys) =>
            scanRecord(keys.length, state, cooperation, (index) =>
              Effect.sync(() => {
                const key = Arr.unsafeGet(keys, index)
                const parsed = direction === "Decode"
                  ? ParseResult.decode(expectedSchema)(key, options)
                  : ParseResult.encode(expectedSchema)(key, options)
                if (Either.isEither(parsed) && Either.isLeft(parsed)) {
                  Option.match(excessMode, {
                    onNone: () => {},
                    onSome: (mode) => {
                      if (mode === "preserve") state.output[key] = input[key]
                      else {
                        recordFailure(
                          ast,
                          input,
                          state,
                          new ParseResult.Pointer(
                            key,
                            input,
                            new ParseResult.Unexpected(input[key], `is unexpected, expected: ${String(expectedAst)}`)
                          ),
                          allErrors
                        )
                      }
                    }
                  })
                }
              }))
        })

        yield* scanRecord(ast.propertySignatures.length, state, cooperation, (index) => {
          const property = Arr.unsafeGet(ast.propertySignatures, index)
          const key = property.name
          const hasKey = Object.prototype.hasOwnProperty.call(input, key)
          if (!hasKey && property.isOptional) return Effect.void
          if (!hasKey && options?.exact === true) {
            return Effect.sync(() =>
              recordFailure(
                ast,
                input,
                state,
                new ParseResult.Pointer(key, input, new ParseResult.Missing(property)),
                allErrors
              )
            )
          }
          return parseRecordValue(
            ast,
            input,
            state,
            parse,
            property.type,
            key,
            options,
            direction,
            allErrors,
            hasKey ? Option.none() : Option.some(property),
            true
          )
        })

        yield* Effect.forEach(ast.indexSignatures, (signature) =>
          Effect.suspend(() => {
            if (Option.isSome(MutableRef.get(state.failure))) return Effect.void
            const keys = getKeysForIndexSignature(input, signature.parameter)
            return scanRecord(keys.length, state, cooperation, (index) => {
              const key = Arr.unsafeGet(keys, index)
              return Effect.flatMap(parse(signature.parameter, key, direction, options), (parsedKey) =>
                Option.match(Option.fromNullable(ParseResult.eitherOrUndefined(parsedKey)), {
                  onNone: () =>
                    Effect.void,
                  onSome: (synchronous) =>
                    Either.isRight(synchronous)
                      ? parseRecordValue(
                        ast,
                        input,
                        state,
                        parse,
                        signature.type,
                        key,
                        options,
                        direction,
                        allErrors,
                        Option.none(),
                        !expectedKey(key)
                      )
                      : Effect.void
                }))
            })
          }), { discard: true })

        const failure = MutableRef.get(state.failure)
        if (Option.isSome(failure)) return holdSemanticResult(failResult(failure.value))
        if (MutableList.isEmpty(state.tasks)) {
          return holdSemanticResult(computeResult(
            ast,
            input,
            new RecordResultState(Arr.fromIterable(state.errors), state.output),
            options,
            inputKeys,
            expectedKeys
          ))
        }

        const tasks = Arr.fromIterable(state.tasks)
        const initialErrors = Arr.fromIterable(state.errors)
        const initialOutput = { ...state.output }
        return holdSemanticResult(Effect.suspend(() => {
          const runtime = new RecordResultState(Arr.copy(initialErrors), { ...initialOutput })
          return Effect.flatMap(
            runAnnotatedTasks(ast, tasks, (run) => run(runtime)),
            () => computeResult(ast, input, runtime, options, inputKeys, expectedKeys)
          )
        }))
      }),
      (value) => value.result
    )
  })
}
