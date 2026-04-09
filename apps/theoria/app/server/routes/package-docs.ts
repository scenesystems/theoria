import { HttpServerResponse } from "@effect/platform"
import { packageDocsBundle, packageDocsCatalog, searchPackageDocs } from "@theoria/source-proof"
import { Effect, Match, Option } from "effect"

import {
  PackageDocsBundleRoute,
  type PackageDocsBundleSelection,
  PackageDocsBundleSuccessEnvelope,
  PackageDocsCatalogRoute,
  PackageDocsCatalogSuccessEnvelope,
  PackageDocsRouteNotFound,
  PackageDocsSearchRoute,
  type PackageDocsSearchSelection,
  PackageDocsSearchSuccessEnvelope
} from "../../contracts/presentation/package-docs.js"
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
    readonly code: "invalid-package-id" | "invalid-query" | "route-not-found"
    readonly message: string
    readonly timing: ResponseTiming
    readonly status: number
  }
) =>
  Effect.gen(function*() {
    return yield* jsonResponse(
      yield* input.timing.fail({
        code: input.code,
        message: input.message,
        retryable: false
      }),
      input.status
    )
  })

const catalogResponse = (timing: ResponseTiming) =>
  Effect.gen(function*() {
    const info = yield* PackageDocsInfo
    const envelope = PackageDocsCatalogSuccessEnvelope.make({
      ok: true,
      meta: yield* timing.finish(),
      data: packageDocsCatalog(info.corpus)
    })

    return yield* jsonResponse(envelope, 200)
  })

const bundleResponse = (timing: ResponseTiming, selection: PackageDocsBundleSelection) =>
  Match.value(selection).pipe(
    Match.tag("MissingPackageDocsBundlePackage", () =>
      failureResponse({
        code: "invalid-query",
        message: "Bundle lookup requires ?package=<package-id>.",
        timing,
        status: 400
      })),
    Match.tag("PackageDocsBundlePackage", ({ packageId }) =>
      Effect.gen(function*() {
        const info = yield* PackageDocsInfo
        const bundle = packageDocsBundle(info.corpus, packageId)

        if (Option.isNone(bundle)) {
          return yield* failureResponse({
            code: "invalid-package-id",
            message: `Unknown package docs id: ${packageId}`,
            timing,
            status: 404
          })
        }

        const envelope = PackageDocsBundleSuccessEnvelope.make({
          ok: true,
          meta: yield* timing.finish(),
          data: bundle.value
        })

        return yield* jsonResponse(envelope, 200)
      })),
    Match.exhaustive
  )

const searchResponse = (timing: ResponseTiming, selection: PackageDocsSearchSelection) =>
  Match.value(selection).pipe(
    Match.tag("MissingPackageDocsSearchQuery", () =>
      failureResponse({
        code: "invalid-query",
        message: "Package docs search requires a non-empty ?query=... value.",
        timing,
        status: 400
      })),
    Match.tag("InvalidPackageDocsSearchPackage", ({ rawPackageId }) =>
      failureResponse({
        code: "invalid-package-id",
        message: `Unknown package docs id: ${rawPackageId}`,
        timing,
        status: 404
      })),
    Match.tag("PackageDocsSearchQuery", ({ query }) =>
      Effect.gen(function*() {
        const info = yield* PackageDocsInfo
        const envelope = PackageDocsSearchSuccessEnvelope.make({
          ok: true,
          meta: yield* timing.finish(),
          data: searchPackageDocs(info.corpus, query)
        })

        return yield* jsonResponse(envelope, 200)
      })),
    Match.exhaustive
  )

export const packageDocsRoute = (pathname: string, requestId: string, rawUrl: string | null) =>
  Effect.gen(function*() {
    const timing = yield* ResponseTiming.start(requestId)
    const search = requestSearch(rawUrl)
    const route = Option.getOrElse(
      PackageDocsCatalogRoute.fromPathname(pathname).pipe(
        Option.orElse(() => PackageDocsBundleRoute.fromPathname(pathname, search)),
        Option.orElse(() => PackageDocsSearchRoute.fromPathname(pathname, search))
      ),
      () => PackageDocsRouteNotFound.make({})
    )

    return yield* Effect.flatten(
      Match.value(route).pipe(
        Match.tag("catalog", () => catalogResponse(timing)),
        Match.tag("bundle", ({ selection }) => bundleResponse(timing, selection)),
        Match.tag("search", ({ selection }) => searchResponse(timing, selection)),
        Match.tag("route-not-found", () =>
          failureResponse({
            code: "route-not-found",
            message: "Package docs API route not found.",
            timing,
            status: 404
          })),
        Match.exhaustive
      )
    )
  })
