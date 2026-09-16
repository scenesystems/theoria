/**
 * Internal construction of resolved-route provenance metadata.
 *
 * @since 0.1.0
 */
import { Match, Option } from "effect"

import { provenanceVersion, type Resolved, type Route, selectedProvider } from "../Route.js"
import type { RuntimeRequest } from "../RuntimeRequest.js"

const selectionReasonForRoute = (route: Route): string =>
  Match.value(route.family).pipe(
    Match.when("OpenAiCompatible", () => "openai-compatible-live"),
    Match.when("OpenAiResponses", () => "openai-responses-direct"),
    Match.when("AnthropicMessages", () => "anthropic-messages-direct"),
    Match.when("HuggingFace", () =>
      Match.value(route.serveMode).pipe(
        Match.when("routed-marketplace", () => "hugging-face-routed-live"),
        Match.orElse(() => "hugging-face-endpoint-live")
      )),
    Match.exhaustive
  )

const selectedProviderForRoute = (route: Route): Option.Option<string> =>
  Match.value(route.family).pipe(
    Match.when("OpenAiResponses", () => Option.some("openai")),
    Match.when("AnthropicMessages", () => Option.some("anthropic")),
    Match.when("HuggingFace", () => selectedProvider(Option.fromNullable(route.selectionPolicy))),
    Match.orElse(() => Option.none())
  )

/**
 * Projects live route-resolution provenance from the requested descriptor and
 * selected execution route.
 *
 * @since 0.1.0
 */
export const make = (
  request: RuntimeRequest,
  route: Route
): Resolved => ({
  route,
  providerModel: request.model.modelRef,
  runtimeFlavor: route.runtimeFlavorHint,
  selectionReason: selectionReasonForRoute(route),
  schemaVersion: provenanceVersion,
  ...Option.fromNullable(route.deploymentId).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (selectedDeployment) => ({ selectedDeployment })
    })
  ),
  ...selectedProviderForRoute(route).pipe(
    Option.match({
      onNone: () => ({}),
      onSome: (selectedProvider) => ({ selectedProvider })
    })
  )
})
