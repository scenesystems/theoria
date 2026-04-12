import { HttpServerResponse } from "@effect/platform"
import { packageDocsBundle, packageDocsCatalog, searchPackageDocs } from "@theoria/source-proof"
import { Effect, Match, Option } from "effect"

import {
  type PackageDocsApiFailurePresentation,
  packageDocsApiRouteFromLocation,
  packageDocsBundleFailurePresentation,
  type PackageDocsBundleSelection,
  PackageDocsBundleSuccessEnvelope,
  PackageDocsCatalogSuccessEnvelope,
  packageDocsRouteFailurePresentation,
  PackageDocsRouteNotFound,
  packageDocsSearchFailurePresentation,
  type PackageDocsSearchSelection,
  PackageDocsSearchSuccessEnvelope
} from "../../contracts/presentation/package-docs.js"
import { PageLocation } from "../../contracts/presentation/page-location.js"
import { PackageDocsInfo } from "../config/package-docs.js"
import { ResponseTiming } from "../kernel/response-timing.js"

const responseHeaders = {
  "cache-control": "no-store"
}

const requestUrlBase = "http://127.0.0.1"

const requestSearch = (rawUrl: string | null): string => new URL(rawUrl ?? "/", requestUrlBase).search

const jsonResponse = (body: unknown, status: number) =>
  HttpServerResponse.json(body, {
    status,
    headers: responseHeaders
  })

const failureResponse = (
  input: {
    readonly failure: PackageDocsApiFailurePresentation
    readonly timing: ResponseTiming
  }
) =>
  Effect.gen(function*() {
    return yield* jsonResponse(
      yield* input.timing.fail({
        code: input.failure.code,
        message: input.failure.message,
        retryable: false
      }),
      input.failure.status
    )
  })

const catalogResponse = (timing: ResponseTiming) =>
  Effect.gen(function*() {
    const info = yield* PackageDocsInfo
    const envelope = PackageDocsCatalogSuccessEnvelope.ok(yield* timing.finish(), packageDocsCatalog(info.corpus))

    return yield* jsonResponse(envelope, 200)
  })

const bundleResponse = (timing: ResponseTiming, selection: PackageDocsBundleSelection) =>
  Match.value(selection).pipe(
    Match.tag("MissingPackageDocsBundlePackage", () =>
      failureResponse({ failure: packageDocsBundleFailurePresentation(selection), timing })),
    Match.tag("PackageDocsBundlePackage", ({ packageId }) =>
      Effect.gen(function*() {
        const info = yield* PackageDocsInfo
        const bundle = packageDocsBundle(info.corpus, packageId)

        if (Option.isNone(bundle)) {
          return yield* failureResponse({ failure: packageDocsBundleFailurePresentation(selection), timing })
        }

        const envelope = PackageDocsBundleSuccessEnvelope.ok(yield* timing.finish(), bundle.value)

        return yield* jsonResponse(envelope, 200)
      })),
    Match.exhaustive
  )

const searchResponse = (timing: ResponseTiming, selection: PackageDocsSearchSelection) =>
  Match.value(selection).pipe(
    Match.tag("MissingPackageDocsSearchQuery", () =>
      failureResponse({ failure: packageDocsSearchFailurePresentation(selection), timing })),
    Match.tag("InvalidPackageDocsSearchPackage", () =>
      failureResponse({ failure: packageDocsSearchFailurePresentation(selection), timing })),
    Match.tag("PackageDocsSearchQuery", ({ query }) =>
      Effect.gen(function*() {
        const info = yield* PackageDocsInfo
        const envelope = PackageDocsSearchSuccessEnvelope.ok(
          yield* timing.finish(),
          searchPackageDocs(info.corpus, query)
        )

        return yield* jsonResponse(envelope, 200)
      })),
    Match.exhaustive
  )

export const packageDocsRoute = (pathname: string, requestId: string, rawUrl: string | null) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const route = Option.getOrElse(
      packageDocsApiRouteFromLocation(PageLocation.fromPathnameSearch(pathname, requestSearch(rawUrl))),
      () => PackageDocsRouteNotFound.make({})
    )

    return yield* Effect.flatten(
      Match.value(route).pipe(
        Match.tag("catalog", () => catalogResponse(timing)),
        Match.tag("bundle", ({ selection }) => bundleResponse(timing, selection)),
        Match.tag("search", ({ selection }) => searchResponse(timing, selection)),
        Match.tag("route-not-found", (missingRoute) =>
          failureResponse({ failure: packageDocsRouteFailurePresentation(missingRoute), timing })),
        Match.exhaustive
      )
    )
  })
