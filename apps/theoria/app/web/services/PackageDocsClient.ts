import type { Schema } from "effect"
import { Effect } from "effect"
import type * as ParseResult from "effect/ParseResult"

import type { PackageName } from "@theoria/source-proof/contracts"
import type { FailureEnvelope, Metadata } from "../../contracts/envelope.js"
import type { ErrorModel } from "../../contracts/error.js"
import {
  type PackageDocsApiRequestRoute,
  type PackageDocsBundle,
  PackageDocsBundleEnvelope,
  PackageDocsBundleRoute,
  type PackageDocsCatalogEntry,
  PackageDocsCatalogEnvelope,
  PackageDocsCatalogRoute,
  PackageDocsDecodeError,
  type PackageDocsError,
  PackageDocsExecutionError,
  type PackageDocsQuery,
  PackageDocsRequestError,
  PackageDocsSearchEnvelope,
  type PackageDocsSearchResult,
  PackageDocsSearchRoute
} from "../../contracts/presentation/package-docs.js"
import { type EnvelopeResponse, EnvelopeTransport } from "./EnvelopeTransport.js"

const packageDocsTransportErrors = {
  decode: (error: ParseResult.ParseError): PackageDocsError => PackageDocsDecodeError.fromParseError(error),
  execution: (error: ErrorModel): PackageDocsError => PackageDocsExecutionError.fromErrorModel(error),
  request: (message: string): PackageDocsError => PackageDocsRequestError.fromMessage(message)
}

const requestPackageDocsRoute = <A, I>({
  route,
  schema
}: {
  readonly route: PackageDocsApiRequestRoute
  readonly schema: Schema.Schema<{ readonly ok: true; readonly data: A; readonly meta: Metadata } | FailureEnvelope, I>
}): Effect.Effect<EnvelopeResponse<A>, PackageDocsError> =>
  EnvelopeTransport.get({
    errors: packageDocsTransportErrors,
    path: route.path(),
    schema
  })

export class PackageDocsClient extends Effect.Service<PackageDocsClient>()("theoria/PackageDocsClient", {
  succeed: {
    catalog: (): Effect.Effect<ReadonlyArray<PackageDocsCatalogEntry>, PackageDocsError> =>
      requestPackageDocsRoute({ route: PackageDocsCatalogRoute.catalog(), schema: PackageDocsCatalogEnvelope }).pipe(
        Effect.map(({ data }) => data)
      ),
    bundle: (packageId: PackageName): Effect.Effect<PackageDocsBundle, PackageDocsError> =>
      requestPackageDocsRoute({
        route: PackageDocsBundleRoute.fromPackageId(packageId),
        schema: PackageDocsBundleEnvelope
      }).pipe(
        Effect.map(({ data }) => data)
      ),
    search: (query: PackageDocsQuery): Effect.Effect<ReadonlyArray<PackageDocsSearchResult>, PackageDocsError> =>
      requestPackageDocsRoute({ route: PackageDocsSearchRoute.fromQuery(query), schema: PackageDocsSearchEnvelope })
        .pipe(
          Effect.map(({ data }) => data)
        )
  }
}) {}
