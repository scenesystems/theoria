import { HttpServerResponse } from "@effect/platform"
import { packageDocsBundle, packageDocsCatalog, packageNameOption, searchPackageDocs } from "@theoria/source-proof"
import { Clock, Effect, Match, Option, Schema } from "effect"

import {
  PackageDocsApiBundlePathname,
  PackageDocsApiCatalogPathname,
  PackageDocsApiSearchPathname,
  PackageDocsBundleEnvelope,
  PackageDocsCatalogEnvelope,
  PackageDocsSearchEnvelope
} from "../../contracts/presentation/package-docs.js"
import { PackageDocsInfo } from "../config/package-docs.js"
import { RuntimeInfo } from "../config/runtime.js"

const requestUrlBase = "http://127.0.0.1"

const responseHeaders = {
  "cache-control": "no-store"
}

const responseMeta = (requestId: string) =>
  Effect.gen(function*() {
    const startedAtMs = yield* Clock.currentTimeMillis
    const runtimeInfo = yield* RuntimeInfo

    return {
      finish: () =>
        Effect.gen(function*() {
          const endedAtMs = yield* Clock.currentTimeMillis

          return {
            requestId,
            buildSha: runtimeInfo.buildSha,
            durationMs: endedAtMs - startedAtMs
          }
        })
    }
  })

const jsonResponse = (body: unknown, status: number) =>
  HttpServerResponse.json(body, {
    status,
    headers: responseHeaders
  })

const failureResponse = (
  input: {
    readonly code: "invalid-package-id" | "invalid-query" | "route-not-found"
    readonly message: string
    readonly requestId: string
    readonly status: number
  }
) =>
  Effect.gen(function*() {
    const meta = yield* responseMeta(input.requestId)

    return jsonResponse(
      {
        ok: false,
        meta: yield* meta.finish(),
        error: {
          code: input.code,
          message: input.message,
          retryable: false
        }
      },
      input.status
    )
  })

const searchParams = (rawUrl: string | null): URLSearchParams => new URL(rawUrl ?? "/", requestUrlBase).searchParams

const decodeLimit = (rawValue: string | null): number => {
  const parsed = rawValue === null ? Number.NaN : Number(rawValue)

  return Number.isInteger(parsed) && parsed > 0 ? parsed : 10
}

const catalogResponse = (requestId: string) =>
  Effect.gen(function*() {
    const meta = yield* responseMeta(requestId)
    const info = yield* PackageDocsInfo
    const envelope = yield* Schema.decodeUnknown(PackageDocsCatalogEnvelope)({
      ok: true,
      meta: yield* meta.finish(),
      data: packageDocsCatalog(info.corpus)
    }).pipe(Effect.orDie)

    return jsonResponse(envelope, 200)
  })

const bundleResponse = (requestId: string, rawUrl: string | null) =>
  Effect.gen(function*() {
    const packageId = Option.fromNullable(searchParams(rawUrl).get("package")).pipe(
      Option.flatMap(packageNameOption)
    )

    if (Option.isNone(packageId)) {
      return yield* failureResponse({
        code: "invalid-query",
        message: "Bundle lookup requires ?package=<package-id>.",
        requestId,
        status: 400
      })
    }

    const info = yield* PackageDocsInfo
    const bundle = packageDocsBundle(info.corpus, packageId.value)

    if (Option.isNone(bundle)) {
      return yield* failureResponse({
        code: "invalid-package-id",
        message: `Unknown package docs id: ${packageId.value}`,
        requestId,
        status: 404
      })
    }

    const meta = yield* responseMeta(requestId)
    const envelope = yield* Schema.decodeUnknown(PackageDocsBundleEnvelope)({
      ok: true,
      meta: yield* meta.finish(),
      data: bundle.value
    }).pipe(Effect.orDie)

    return jsonResponse(envelope, 200)
  })

const searchResponse = (requestId: string, rawUrl: string | null) =>
  Effect.gen(function*() {
    const params = searchParams(rawUrl)
    const query = Option.fromNullable(params.get("query")).pipe(Option.map((value) => value.trim()))
    const rawPackageId = Option.fromNullable(params.get("package"))

    if (Option.isNone(query) || query.value.length === 0) {
      return yield* failureResponse({
        code: "invalid-query",
        message: "Package docs search requires a non-empty ?query=... value.",
        requestId,
        status: 400
      })
    }

    const decodedPackageId = rawPackageId.pipe(
      Option.flatMap(packageNameOption),
      Option.getOrNull
    )

    if (Option.isSome(rawPackageId) && decodedPackageId === null) {
      return yield* failureResponse({
        code: "invalid-package-id",
        message: `Unknown package docs id: ${rawPackageId.value}`,
        requestId,
        status: 404
      })
    }

    const meta = yield* responseMeta(requestId)
    const info = yield* PackageDocsInfo
    const envelope = yield* Schema.decodeUnknown(PackageDocsSearchEnvelope)({
      ok: true,
      meta: yield* meta.finish(),
      data: searchPackageDocs(info.corpus, {
        query: query.value,
        packageId: decodedPackageId,
        limit: decodeLimit(params.get("limit"))
      })
    }).pipe(Effect.orDie)

    return jsonResponse(envelope, 200)
  })

export const packageDocsRoute = (pathname: string, requestId: string, rawUrl: string | null) =>
  Effect.flatten(
    Match.value(pathname).pipe(
      Match.when(PackageDocsApiCatalogPathname, () => catalogResponse(requestId)),
      Match.when(PackageDocsApiBundlePathname, () => bundleResponse(requestId, rawUrl)),
      Match.when(PackageDocsApiSearchPathname, () => searchResponse(requestId, rawUrl)),
      Match.orElse(() =>
        failureResponse({
          code: "route-not-found",
          message: "Package docs API route not found.",
          requestId,
          status: 404
        })
      )
    )
  )
