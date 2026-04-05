/**
 * Internal default capability helpers shared by the initial runtime skeleton.
 *
 * @since 0.1.0
 */
import { Match, Option } from "effect"

import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import type { RuntimeCapabilities } from "../contracts/RuntimeCapabilities.js"
import { defaultRuntimeFlavor, type RuntimeFlavor } from "../contracts/RuntimeFlavor.js"

const hostedOpenAiCompatibleCapabilities: RuntimeCapabilities = {
  textGeneration: true,
  embeddings: true,
  streaming: true,
  toolCalling: true,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const selfHostedCompatibleCapabilities: RuntimeCapabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: false,
  multimodalInput: false
}

const openAiResponsesCapabilities: RuntimeCapabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: true,
  structuredOutput: "strict",
  usageReporting: true,
  multimodalInput: false
}

const anthropicMessagesCapabilities: RuntimeCapabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: true,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const huggingFaceRoutedCapabilities: RuntimeCapabilities = {
  textGeneration: true,
  embeddings: true,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const huggingFaceEndpointCapabilities: RuntimeCapabilities = {
  textGeneration: true,
  embeddings: true,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const huggingFaceTgiEndpointCapabilities: RuntimeCapabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: false,
  multimodalInput: false
}

const capabilitiesForCompatibleFlavor = (runtimeFlavor: RuntimeFlavor): RuntimeCapabilities =>
  Match.value(runtimeFlavor).pipe(
    Match.when("ollama", () => ({
      ...selfHostedCompatibleCapabilities,
      toolCalling: true,
      usageReporting: true
    })),
    Match.orElse(() => selfHostedCompatibleCapabilities)
  )

const capabilitiesForHuggingFaceRoute = (
  route: ExecutionRoute
): RuntimeCapabilities =>
  Match.value(route.serveMode).pipe(
    Match.when("routed-marketplace", () => huggingFaceRoutedCapabilities),
    Match.orElse(() =>
      Match.value(route.runtimeFlavorHint ?? defaultRuntimeFlavor()).pipe(
        Match.when("tgi", () => huggingFaceTgiEndpointCapabilities),
        Match.orElse(() => huggingFaceEndpointCapabilities)
      )
    )
  )

const capabilitiesForRoute = (route: ExecutionRoute): RuntimeCapabilities =>
  Match.value(route.family).pipe(
    Match.when("OpenAiCompatible", () =>
      Match.value(route.serveMode).pipe(
        Match.when("hosted-api", () => hostedOpenAiCompatibleCapabilities),
        Match.when("routed-marketplace", () => hostedOpenAiCompatibleCapabilities),
        Match.when("dedicated-endpoint", () => hostedOpenAiCompatibleCapabilities),
        Match.when("self-hosted", () =>
          capabilitiesForCompatibleFlavor(route.runtimeFlavorHint ?? defaultRuntimeFlavor())),
        Match.when("local-runtime", () =>
          capabilitiesForCompatibleFlavor(route.runtimeFlavorHint ?? defaultRuntimeFlavor())),
        Match.exhaustive
      )),
    Match.when("OpenAiResponses", () =>
      openAiResponsesCapabilities),
    Match.when("AnthropicMessages", () =>
      anthropicMessagesCapabilities),
    Match.when("HuggingFace", () =>
      capabilitiesForHuggingFaceRoute(route)),
    Match.exhaustive
  )

/**
 * Conservative capability defaults derived from stable route family, serve
 * mode, runtime flavor, and explicit overrides until live adapters report real
 * capability truth.
 *
 * @since 0.1.0
 */
export const defaultRuntimeCapabilities = (options?: {
  readonly route?: ExecutionRoute
  readonly overrides?: {
    readonly textGeneration?: boolean
    readonly embeddings?: boolean
    readonly streaming?: boolean
    readonly toolCalling?: boolean
    readonly structuredOutput?: RuntimeCapabilities["structuredOutput"]
    readonly usageReporting?: boolean
    readonly multimodalInput?: boolean
    readonly maxContextTokens?: number
  }
}): RuntimeCapabilities => {
  const route = Option.fromNullable(options).pipe(
    Option.flatMap((resolvedOptions) => Option.fromNullable(resolvedOptions.route))
  )
  const overrides = Option.fromNullable(options).pipe(
    Option.flatMap((resolvedOptions) => Option.fromNullable(resolvedOptions.overrides))
  )

  const baseCapabilities = Option.match(route, {
    onNone: () => capabilitiesForCompatibleFlavor(defaultRuntimeFlavor()),
    onSome: (resolvedRoute) => capabilitiesForRoute(resolvedRoute)
  })

  return Option.match(overrides, {
    onNone: () => baseCapabilities,
    onSome: (resolvedOverrides) => ({
      ...baseCapabilities,
      ...resolvedOverrides
    })
  })
}
