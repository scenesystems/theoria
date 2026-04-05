/**
 * Internal authority for resolved-route provenance metadata.
 *
 * @since 0.1.0
 */
import { Match, Option } from "effect"

import type { DesiredRuntimeDescriptor } from "../contracts/DesiredRuntimeDescriptor.js"
import type { ExecutionRoute } from "../contracts/ExecutionRoute.js"
import { type ResolvedRouteDescriptor, ResolvedRouteProvenanceVersion } from "../contracts/ResolvedRouteDescriptor.js"
import { explicitProviderFromSelectionPolicy } from "../contracts/RouteSelectionPolicy.js"

/** @since 0.1.0 */
export const testingSelectionReason = "testing-static-resolution"

const selectionReasonForRoute = (route: ExecutionRoute): string =>
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

const selectedProviderForRoute = (route: ExecutionRoute): Option.Option<string> =>
  Match.value(route.family).pipe(
    Match.when("OpenAiResponses", () => Option.some("openai")),
    Match.when("AnthropicMessages", () => Option.some("anthropic")),
    Match.when("HuggingFace", () => explicitProviderFromSelectionPolicy(Option.fromNullable(route.selectionPolicy))),
    Match.orElse(() => Option.none())
  )

/**
 * Projects live route-resolution provenance from the requested descriptor and
 * selected execution route.
 *
 * @since 0.1.0
 */
export const makeLiveResolvedRouteDescriptor = (
  descriptor: DesiredRuntimeDescriptor,
  route: ExecutionRoute
): ResolvedRouteDescriptor => ({
  route,
  providerModel: descriptor.artifact.modelRef,
  runtimeFlavor: route.runtimeFlavorHint,
  selectionReason: selectionReasonForRoute(route),
  schemaVersion: ResolvedRouteProvenanceVersion,
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
