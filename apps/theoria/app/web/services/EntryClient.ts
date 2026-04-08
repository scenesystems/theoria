import { Effect, Option, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import { type PackageVersions, PackageVersionsEnvelope } from "../../contracts/capability/package-versions.js"
import { DemoDecodeError, type DemoError, DemoExecutionError, DemoRequestError } from "../../contracts/demo-error.js"
import type { EntryId } from "../../contracts/entry/id.js"
import { type EntryRunRequest } from "../../contracts/entry/registry.js"
import { EntryRunRequest as EntryRunRequestSchema } from "../../contracts/entry/registry.js"
import type { Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import { type ProgramPreview, ProgramPreviewEnvelope } from "../../contracts/presentation/program-preview.js"
import { type RunData, RunEnvelope } from "../../contracts/study/run.js"

const formatParseError = (error: ParseResult.ParseError): string => ParseResult.TreeFormatter.formatErrorSync(error)

const EntryRunRequestJson = Schema.parseJson(EntryRunRequestSchema)
const encodeEntryRunRequestJson = Schema.encodeSync(EntryRunRequestJson)

type SuccessEnvelopeData<A> = {
  readonly data: A
  readonly meta: Metadata
}

type DecodedEnvelope<A> =
  | { readonly ok: true; readonly meta: Metadata; readonly data: A }
  | { readonly ok: false; readonly meta: Metadata; readonly error: ErrorModel }

const fetchJson = ({
  body,
  method,
  path
}: {
  readonly body: Option.Option<string>
  readonly method: "GET" | "POST"
  readonly path: string
}) =>
  Effect.tryPromise({
    try: () =>
      fetch(path, {
        method,
        headers: {
          accept: "application/json",
          ...Option.match(body, {
            onNone: () => ({}),
            onSome: () => ({ "content-type": "application/json" })
          })
        },
        ...Option.match(body, {
          onNone: () => ({}),
          onSome: (resolvedBody) => ({ body: resolvedBody })
        })
      }),
    catch: (cause) => new DemoRequestError({ message: String(cause) })
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => new DemoRequestError({ message: String(cause) })
      })
    )
  )

const requestDecodedEnvelope = <A, I>({
  body,
  method,
  path,
  schema
}: {
  readonly body: Option.Option<string>
  readonly method: "GET" | "POST"
  readonly path: string
  readonly schema: Schema.Schema<DecodedEnvelope<A>, I>
}) =>
  fetchJson({ body, method, path }).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((error) => new DemoDecodeError({ message: formatParseError(error) }))
      )
    )
  )

const requestEnvelope = <A, I>({
  body,
  method,
  path,
  schema
}: {
  readonly body: Option.Option<string>
  readonly method: "GET" | "POST"
  readonly path: string
  readonly schema: Schema.Schema<DecodedEnvelope<A>, I>
}): Effect.Effect<SuccessEnvelopeData<A>, DemoError> =>
  requestDecodedEnvelope({ body, method, path, schema }).pipe(
    Effect.flatMap((envelope) =>
      envelope.ok
        ? Effect.succeed({
          data: envelope.data,
          meta: envelope.meta
        })
        : Effect.fail(
          new DemoExecutionError({
            code: envelope.error.code,
            message: envelope.error.message,
            retryable: envelope.error.retryable
          })
        )
    )
  )

export const entryRunPath = (id: EntryId): string => `/api/entries/${id}/run`
export const entryPreloadPath = (id: EntryId): string => `/api/entries/${id}/preload`
export const entryStreamPath = (id: EntryId): string => `/api/entries/${id}/stream`

export class EntryClient extends Effect.Service<EntryClient>()("theoria/EntryClient", {
  succeed: {
    run: (request: EntryRunRequest): Effect.Effect<RunData, DemoError> =>
      requestEnvelope({
        body: Option.some(encodeEntryRunRequestJson(request)),
        method: "POST",
        path: entryRunPath(request.draft.entryId),
        schema: RunEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    runWithMeta: (request: EntryRunRequest): Effect.Effect<SuccessEnvelopeData<RunData>, DemoError> =>
      requestEnvelope({
        body: Option.some(encodeEntryRunRequestJson(request)),
        method: "POST",
        path: entryRunPath(request.draft.entryId),
        schema: RunEnvelope
      }),
    preload: (id: EntryId): Effect.Effect<ProgramPreview, DemoError> =>
      requestEnvelope({
        body: Option.none(),
        method: "GET",
        path: entryPreloadPath(id),
        schema: ProgramPreviewEnvelope
      }).pipe(Effect.map(({ data }) => data)),
    versions: (): Effect.Effect<PackageVersions, DemoError> =>
      requestEnvelope({
        body: Option.none(),
        method: "GET",
        path: "/api/versions/packages",
        schema: PackageVersionsEnvelope
      }).pipe(Effect.map(({ data }) => data))
  }
}) {}
