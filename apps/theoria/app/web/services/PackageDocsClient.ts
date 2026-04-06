import { Effect, Schema } from "effect"
import * as ParseResult from "effect/ParseResult"

import type { PackageName } from "@theoria/source-proof"
import type { Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import {
  type PackageDocsBundle,
  packageDocsBundleApiPath,
  PackageDocsBundleEnvelope,
  packageDocsCatalogApiPath,
  type PackageDocsCatalogEntry,
  PackageDocsCatalogEnvelope,
  PackageDocsDecodeError,
  type PackageDocsError,
  PackageDocsExecutionError,
  type PackageDocsQuery,
  PackageDocsRequestError,
  packageDocsSearchApiPath,
  PackageDocsSearchEnvelope,
  type PackageDocsSearchResult
} from "../../contracts/package-docs.js"

const formatParseError = (error: ParseResult.ParseError): string => ParseResult.TreeFormatter.formatErrorSync(error)

type SuccessEnvelopeData<A> = {
  readonly data: A
  readonly meta: Metadata
}

type DecodedEnvelope<A> =
  | { readonly ok: true; readonly meta: Metadata; readonly data: A }
  | { readonly ok: false; readonly meta: Metadata; readonly error: ErrorModel }

const fetchJson = (path: string) =>
  Effect.tryPromise({
    try: () =>
      fetch(path, {
        method: "GET",
        headers: {
          accept: "application/json"
        }
      }),
    catch: (cause) => new PackageDocsRequestError({ message: String(cause) })
  }).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) => new PackageDocsRequestError({ message: String(cause) })
      })
    )
  )

const requestEnvelope = <A, I>(
  path: string,
  schema: Schema.Schema<DecodedEnvelope<A>, I>
): Effect.Effect<SuccessEnvelopeData<A>, PackageDocsError> =>
  fetchJson(path).pipe(
    Effect.flatMap((json) =>
      Schema.decodeUnknown(schema)(json).pipe(
        Effect.mapError((error) => new PackageDocsDecodeError({ message: formatParseError(error) }))
      )
    ),
    Effect.flatMap((envelope) =>
      envelope.ok
        ? Effect.succeed({
          data: envelope.data,
          meta: envelope.meta
        })
        : Effect.fail(
          new PackageDocsExecutionError({
            code: envelope.error.code,
            message: envelope.error.message,
            retryable: envelope.error.retryable
          })
        )
    )
  )

export class PackageDocsClient extends Effect.Service<PackageDocsClient>()("theoria/PackageDocsClient", {
  succeed: {
    catalog: (): Effect.Effect<ReadonlyArray<PackageDocsCatalogEntry>, PackageDocsError> =>
      requestEnvelope(packageDocsCatalogApiPath(), PackageDocsCatalogEnvelope).pipe(Effect.map(({ data }) => data)),
    bundle: (packageId: PackageName): Effect.Effect<PackageDocsBundle, PackageDocsError> =>
      requestEnvelope(packageDocsBundleApiPath(packageId), PackageDocsBundleEnvelope).pipe(
        Effect.map(({ data }) => data)
      ),
    search: (query: PackageDocsQuery): Effect.Effect<ReadonlyArray<PackageDocsSearchResult>, PackageDocsError> =>
      requestEnvelope(packageDocsSearchApiPath(query), PackageDocsSearchEnvelope).pipe(Effect.map(({ data }) => data))
  }
}) {}
