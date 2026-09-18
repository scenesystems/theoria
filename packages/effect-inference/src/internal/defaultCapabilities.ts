/**
 * Conservative capability defaults by runtime route and flavor.
 *
 * @since 0.1.0
 */
import { Match, Option, Schema } from "effect"

import { Capabilities } from "../Capabilities.js"
import { defaultFlavor, type Flavor, Route } from "../Route.js"

const Options = Schema.Struct({
  route: Schema.optionalWith(Route, { exact: true }),
  overrides: Schema.optionalWith(Schema.partialWith(Capabilities, { exact: true }), { exact: true })
})

const hostedOpenAiCompatibleCapabilities: Capabilities = {
  textGeneration: true,
  embeddings: true,
  streaming: true,
  toolCalling: true,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const selfHostedCompatibleCapabilities: Capabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: false,
  multimodalInput: false
}

const openAiResponsesCapabilities: Capabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: true,
  structuredOutput: "strict",
  usageReporting: true,
  multimodalInput: false
}

const anthropicMessagesCapabilities: Capabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: true,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const huggingFaceRoutedCapabilities: Capabilities = {
  textGeneration: true,
  embeddings: true,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const huggingFaceEndpointCapabilities: Capabilities = {
  textGeneration: true,
  embeddings: true,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: true,
  multimodalInput: false
}

const huggingFaceTgiEndpointCapabilities: Capabilities = {
  textGeneration: true,
  embeddings: false,
  streaming: true,
  toolCalling: false,
  structuredOutput: "best-effort",
  usageReporting: false,
  multimodalInput: false
}

const capabilitiesForCompatibleFlavor = (runtimeFlavor: Flavor): Capabilities =>
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

const runtimeFlavorForRoute = (route: Route): Flavor =>
  Option.fromNullable(route.runtimeFlavorHint).pipe(Option.getOrElse(() => defaultFlavor))

const capabilitiesForHuggingFaceEndpoint = (route: Route): Capabilities =>
  Match.value(runtimeFlavorForRoute(route)).pipe(
    Match.when("tgi", () => huggingFaceTgiEndpointCapabilities),
    Match.when("unknown", () => huggingFaceEndpointCapabilities),
    Match.when("vllm", () => huggingFaceEndpointCapabilities),
    Match.when("ollama", () => huggingFaceEndpointCapabilities),
    Match.when("lm-studio", () => huggingFaceEndpointCapabilities),
    Match.exhaustive
  )

const capabilitiesForHuggingFaceRoute = (
  route: Route
): Capabilities =>
  Match.value(route.serveMode).pipe(
    Match.when("routed-marketplace", () => huggingFaceRoutedCapabilities),
    Match.when("hosted-api", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.when("dedicated-endpoint", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.when("self-hosted", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.when("local-runtime", () => capabilitiesForHuggingFaceEndpoint(route)),
    Match.exhaustive
  )

const capabilitiesForRoute = (route: Route): Capabilities =>
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
export const defaultCapabilities = (
  options?: typeof Options.Type
): Capabilities => {
  const route = Option.fromNullable(options).pipe(
    Option.flatMap((resolvedOptions) => Option.fromNullable(resolvedOptions.route))
  )
  const overrides = Option.fromNullable(options).pipe(
    Option.flatMap((resolvedOptions) => Option.fromNullable(resolvedOptions.overrides))
  )

  const baseCapabilities = Option.match(route, {
    onNone: () => capabilitiesForCompatibleFlavor(defaultFlavor),
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
