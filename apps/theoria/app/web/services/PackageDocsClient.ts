import { Effect } from "effect"

import type { PackageName } from "@theoria/source-proof/contracts"
import {
  type PackageDocsApiRequestRoute,
  type PackageDocsBundle,
  PackageDocsBundleEnvelope,
  PackageDocsBundleRoute,
  PackageDocsCatalogRoute,
  type PackageDocsCatalogEntry,
  PackageDocsCatalogEnvelope,
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
  decode: PackageDocsDecodeError.fromParseError,
  execution: PackageDocsExecutionError.fromErrorModel,
  request: PackageDocsRequestError.fromMessage
}

const requestPackageDocsRoute = <A, I>({
  route,
  schema
}: {
  readonly route: PackageDocsApiRequestRoute
  readonly schema: typeof PackageDocsCatalogEnvelope | typeof PackageDocsBundleEnvelope | typeof PackageDocsSearchEnvelope
}): Effect.Effect<EnvelopeResponse<A>, PackageDocsError> =>
  EnvelopeTransport.get({
    errors: packageDocsTransportErrors,
    path: route.path(),
    schema
  })

export class PackageDocsClient extends Effect.Service<PackageDocsClient>()("theoria/PackageDocsClient", {
  succeed: {
    catalog: (): Effect.Effect<ReadonlyArray<PackageDocsCatalogEntry>, PackageDocsError> =>
      requestPackageDocsRoute({ route: PackageDocsCatalogRoute.make({}), schema: PackageDocsCatalogEnvelope }).pipe(
        Effect.map(({ data }) => data)
      ),
    bundle: (packageId: PackageName): Effect.Effect<PackageDocsBundle, PackageDocsError> =>
      requestPackageDocsRoute({ route: PackageDocsBundleRoute.fromPackageId(packageId), schema: PackageDocsBundleEnvelope }).pipe(
        Effect.map(({ data }) => data)
      ),
    search: (query: PackageDocsQuery): Effect.Effect<ReadonlyArray<PackageDocsSearchResult>, PackageDocsError> =>
      requestPackageDocsRoute({ route: PackageDocsSearchRoute.fromQuery(query), schema: PackageDocsSearchEnvelope }).pipe(
        Effect.map(({ data }) => data)
      )
  }
}) {}
