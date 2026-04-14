import { Effect, Schema } from "effect"
import * as Experimental from "effect-dsp/experimental"

import { ConsumerArtifact } from "../consumer-artifact.js"
import { WorkflowHookup } from "../workflow-hookup.js"

import { OpenAgentTraceCatalog, OpenAgentTraceRegistryEntry, OpenAgentTraceRequestError } from "./study-material.js"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))
const ampThreadImportHost = "ampcode.com"
const ampThreadImportPrefixDescription = "https://ampcode.com/threads/... or https://ampcode.com/v2/..."

export const canonicalAmpThreadSourceUrl = (threadId: AmpThreadImportRequest["threadId"]): string =>
  `https://ampcode.com/threads/${threadId}`

const supportedPath = (pathname: string): boolean => pathname.startsWith("/threads/") || pathname.startsWith("/v2/")

const threadIdFromPathname = (pathname: string): string =>
  pathname.split("/").filter((segment) => segment.length > 0).at(-1) ?? ""

const invalidInputError = (input: string): OpenAgentTraceRequestError =>
  OpenAgentTraceRequestError.fromMessage(
    `Paste an Amp thread id or supported ${ampThreadImportPrefixDescription} URL. Received: ${input}`
  )

const parseUrl = (input: string): Effect.Effect<URL, OpenAgentTraceRequestError> =>
  Effect.try({
    try: () => new URL(input),
    catch: () => invalidInputError(input)
  }).pipe(
    Effect.flatMap((url) =>
      url.protocol !== "https:" || url.hostname !== ampThreadImportHost || !supportedPath(url.pathname)
        ? Effect.fail(invalidInputError(input))
        : Effect.succeed(url)
    )
  )

const decodeThreadId = (
  input: string
): Effect.Effect<AmpThreadImportRequest["threadId"], OpenAgentTraceRequestError> =>
  Schema.is(Experimental.OpenAgentTrace.AmpThreadId)(input)
    ? Effect.succeed(input)
    : Effect.fail(invalidInputError(input))

export class AmpThreadImportRequest extends Schema.Class<AmpThreadImportRequest>("AmpThreadImportRequest")({
  sourceUrl: NonEmptyString,
  threadId: Experimental.OpenAgentTrace.AmpThreadId
}) {}

export class AmpThreadImportPayload extends Schema.Class<AmpThreadImportPayload>("AmpThreadImportPayload")({
  consumerArtifact: ConsumerArtifact,
  registryEntry: OpenAgentTraceRegistryEntry,
  workflowHookup: WorkflowHookup
}) {
  static single(registryEntry: OpenAgentTraceRegistryEntry): AmpThreadImportPayload {
    return AmpThreadImportPayload.make({
      consumerArtifact: registryEntry.consumerArtifact,
      registryEntry,
      workflowHookup: registryEntry.workflowHookup
    })
  }

  catalog(): OpenAgentTraceCatalog {
    return OpenAgentTraceCatalog.fromParts({
      consumerArtifacts: [this.consumerArtifact],
      registry: [this.registryEntry],
      workflowHookups: [this.workflowHookup]
    })
  }
}

export const canonicalizeAmpThreadImportRequest = (
  request: AmpThreadImportRequest
): AmpThreadImportRequest =>
  AmpThreadImportRequest.make({
    sourceUrl: canonicalAmpThreadSourceUrl(request.threadId),
    threadId: request.threadId
  })

export const RequestJson = Schema.parseJson(AmpThreadImportRequest)
export const encodeRequestJson = Schema.encodeSync(RequestJson)

export const requestFromInput = (
  input: string
): Effect.Effect<AmpThreadImportRequest, OpenAgentTraceRequestError> => {
  const trimmed = input.trim()

  if (trimmed.length === 0) {
    return Effect.fail(OpenAgentTraceRequestError.fromMessage("Paste an Amp thread id or URL before importing."))
  }

  return trimmed.startsWith("http://") || trimmed.startsWith("https://")
    ? parseUrl(trimmed).pipe(
      Effect.flatMap((url) =>
        decodeThreadId(threadIdFromPathname(url.pathname)).pipe(
          Effect.map((threadId) =>
            AmpThreadImportRequest.make({
              sourceUrl: canonicalAmpThreadSourceUrl(threadId),
              threadId
            })
          )
        )
      )
    )
    : decodeThreadId(trimmed).pipe(
      Effect.map((threadId) =>
        AmpThreadImportRequest.make({
          sourceUrl: canonicalAmpThreadSourceUrl(threadId),
          threadId
        })
      )
    )
}
