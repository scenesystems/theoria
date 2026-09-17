import { BunRuntime } from "@effect/platform-bun"
import {
  Array as Arr,
  Boolean,
  Config,
  ConfigError,
  ConfigProvider,
  Console,
  Effect,
  Inspectable,
  Match,
  Option,
  pipe,
  Schema,
  String
} from "effect"

import { program as huggingFaceRoutedRuntimeProgram } from "../examples/02-hugging-face-routed-runtime.js"
import { program as runtimeConfigDecodingProgram } from "../examples/03-runtime-config-decoding.js"
import { program as huggingFaceEndpointRuntimeProgram } from "../examples/04-hugging-face-endpoint-runtime.js"
import { InvalidRuntimeConfig } from "../src/InferenceError.js"

const LiveExampleName = Schema.Literal(
  "runtime-config-decoding",
  "hugging-face-routed-runtime",
  "hugging-face-endpoint-runtime"
)
type LiveExampleName = typeof LiveExampleName.Type

const defaultExamples = LiveExampleName.literals

const defaultConfigProvider = ConfigProvider.fromEnv().pipe(ConfigProvider.constantCase)

const parseSelection = (value: string) => {
  const names = pipe(
    String.split(",")(value),
    Arr.map(String.trim),
    Arr.filter(String.isNonEmpty)
  )

  return Effect.forEach(names, (name) =>
    Match.value(name).pipe(
      Match.when("runtime-config-decoding", () => Effect.succeed<LiveExampleName>("runtime-config-decoding")),
      Match.when("hugging-face-routed-runtime", () => Effect.succeed<LiveExampleName>("hugging-face-routed-runtime")),
      Match.when(
        "hugging-face-endpoint-runtime",
        () => Effect.succeed<LiveExampleName>("hugging-face-endpoint-runtime")
      ),
      Match.orElse(() =>
        Effect.fail(
          ConfigError.InvalidData(
            [],
            "Unsupported EFFECT_INFERENCE_LIVE_EXAMPLES entry. Use runtime-config-decoding, hugging-face-routed-runtime, or hugging-face-endpoint-runtime."
          )
        )
      )
    ))
}

const exampleConfig = Effect.gen(function*() {
  const enabled = yield* Config.withDefault(Config.boolean("effectInferenceRunLiveExamples"), false)
  const selection = yield* Config.option(Config.string("effectInferenceLiveExamples"))
  const selectedExamples = yield* Option.match(selection, {
    onNone: () => Effect.succeed(defaultExamples),
    onSome: parseSelection
  })

  return { enabled, selectedExamples }
}).pipe(Effect.withConfigProvider(defaultConfigProvider))

const programForExample = (exampleName: LiveExampleName): Effect.Effect<unknown, unknown, never> =>
  Match.value(exampleName).pipe(
    Match.when("runtime-config-decoding", () => runtimeConfigDecodingProgram),
    Match.when("hugging-face-routed-runtime", () => huggingFaceRoutedRuntimeProgram),
    Match.when("hugging-face-endpoint-runtime", () => huggingFaceEndpointRuntimeProgram),
    Match.exhaustive
  )

const runExample = (exampleName: LiveExampleName) =>
  Effect.gen(function*() {
    yield* Console.log(`Running ${exampleName}`)
    yield* programForExample(exampleName)
    yield* Console.log(`Completed ${exampleName}`)
  })

const main = exampleConfig.pipe(
  Effect.mapError((error) => new InvalidRuntimeConfig({ reason: Inspectable.toStringUnknown(error) })),
  Effect.flatMap(({ enabled, selectedExamples }) =>
    Boolean.match(enabled, {
      onTrue: () => Effect.forEach(selectedExamples, runExample, { discard: true }),
      onFalse: () =>
        Console.log(
          "Skipping live example verification. Set EFFECT_INFERENCE_RUN_LIVE_EXAMPLES=true to execute selected live examples."
        )
    })
  )
)

BunRuntime.runMain(main)
