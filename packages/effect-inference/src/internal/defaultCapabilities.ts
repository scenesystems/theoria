/**
 * Internal default capability helpers shared by the initial runtime skeleton.
 *
 * @since 0.1.0
 */
import { Match, Option, Schema } from "effect"

import { type ExecutionRoute, ExecutionRouteSchema } from "../contracts/ExecutionRoute.js"
import { type RuntimeCapabilities, RuntimeCapabilitiesSchema } from "../contracts/RuntimeCapabilities.js"
import { defaultRuntimeFlavor, type RuntimeFlavor } from "../contracts/RuntimeFlavor.js"

const DefaultRuntimeCapabilitiesOptions = Schema.Struct({
  route: Schema.optionalWith(ExecutionRouteSchema, { exact: true }),
  overrides: Schema.optionalWith(Schema.partialWith(RuntimeCapabilitiesSchema, { exact: true }), { exact: true })
})

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
    Match.when("unknown", () => selfHostedCompatibleCapabilities),
    Match.when("vllm", () => selfHostedCompatibleCapabilities),
    Match.when("tgi", () => selfHostedCompatibleCapabilities),
    Match.when("lm-studio", () => selfHostedCompatibleCapabilities),
    Match.exhaustive
  )

const runtimeFlavorForRoute = (route: ExecutionRoute): RuntimeFlavor =>
  Option.fromNullable(route.runtimeFlavorHint).pipe(Option.getOrElse(defaultRuntimeFlavor))

const capabilitiesForHuggingFaceEndpoint = (route: ExecutionRoute): RuntimeCapabilities =>
  Match.value(runtimeFlavorForRoute(route)).pipe(
    Match.when("tgi", () => huggingFaceTgiEndpointCapabilities),
    Match.when("unknown", () => huggingFaceEndpointCapabilities),
    Match.when("vllm", () => huggingFaceEndpointCapabilities),
    Match.when("ollama", () => huggingFaceEndpointCapabilities),
    Match.when("lm-studio", () => huggingFaceEndpointCapabilities),
    Match.exhaustive
  )

const capabilitiesForHuggingFaceRoute = (
  route: ExecutionRoute
): RuntimeCapabilities =>
  Match.value(route.serveMode).pipe(
    Match.when("routed-marketplace", () => huggingFaceRoutedCapabilities),
    Match.when("hosted-api", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.when("dedicated-endpoint", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.when("self-hosted", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.when("local-runtime", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.exhaustive
  )

const capabilitiesForRoute = (route: ExecutionRoute): RuntimeCapabilities =>
  Match.value(route.family).pipe(
    Match.when("OpenAiCompatible", () =>
      Match.value(route.serveMode).pipe(
        Match.when("hosted-api", () => hostedOpenAiCompatibleCapabilities),
        Match.when("routed-marketplace", () => hostedOpenAiCompatibleCapabilities),
        Match.when("dedicated-endpoint", () => hostedOpenAiCompatibleCapabilities),
        Match.when("self-hosted", () => capabilitiesForCompatibleFlavor(runtimeFlavorForRoute(route))),
        Match.when("local-runtime", () => capabilitiesForCompatibleFlavor(runtimeFlavorForRoute(route))),
        Match.exhaustive
      )),
    Match.when("OpenAiResponses", () => openAiResponsesCapabilities),
    Match.when("AnthropicMessages", () => anthropicMessagesCapabilities),
    Match.when("HuggingFace", () => capabilitiesForHuggingFaceRoute(route)),
    Match.exhaustive
  )

/**
 * Conservative capability defaults derived from stable route family, serve
 * mode, runtime flavor, and explicit overrides until live adapters report real
 * capability truth.
 *
 * @since 0.1.0
 */
export const defaultRuntimeCapabilities = (
  options?: typeof DefaultRuntimeCapabilitiesOptions.Type
): RuntimeCapabilities => {
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
