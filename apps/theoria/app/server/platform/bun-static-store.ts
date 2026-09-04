import { FileSystem, HttpPlatform, HttpServerResponse } from "@effect/platform"
import type { PlatformError } from "@effect/platform/Error"
import { Effect, Layer, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { contentTypeForPath, StaticStore, StaticStoreError } from "../config/static-store.js"

/**
 * `StaticStore` backed by directories on disk, searched in order.
 *
 * Used by the Bun server (`apps/theoria/server.ts`), which lists the built
 * `dist/` first and the source `public/` second so that the docs data is
 * reachable before `vite build` has copied it. Assets are served as stored;
 * the Cloudflare deployment compresses at the edge.
 */

const AssetPathname = Schema.String.pipe(
  Schema.pattern(/^\/[A-Za-z0-9._/-]+$/u),
  Schema.filter((value) => !value.endsWith("/") && !value.includes("..") && !value.includes("//"))
)

const isAssetPathname = Schema.is(AssetPathname)

const trimTrailingSlash = (root: string): string => root.endsWith("/") ? root.slice(0, -1) : root

const make = (roots: ReadonlyArray<string>) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const platform = yield* HttpPlatform.HttpPlatform
    const searchRoots = Arr.map(roots, trimTrailingSlash)

    const unreadable = (pathname: string) => (cause: PlatformError): StaticStoreError =>
      new StaticStoreError({ pathname, reason: "Unreadable", detail: cause.message })

    const candidatePaths = (pathname: string): ReadonlyArray<string> =>
      Arr.map(searchRoots, (root) => `${root}${pathname}`)

    /** The first root that holds `pathname`, or none when no root does. */
    const locate = (pathname: string): Effect.Effect<Option.Option<string>, StaticStoreError> =>
      isAssetPathname(pathname)
        ? Effect.findFirst(candidatePaths(pathname), (path) => fileSystem.exists(path)).pipe(
          Effect.mapError(unreadable(pathname))
        )
        : Effect.succeedNone

    const text = (pathname: string): Effect.Effect<string, StaticStoreError> =>
      isAssetPathname(pathname)
        ? locate(pathname).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => new StaticStoreError({ pathname, reason: "NotFound", detail: "" }),
              onSome: (path) => fileSystem.readFileString(path).pipe(Effect.mapError(unreadable(pathname)))
            })
          )
        )
        : new StaticStoreError({ pathname, reason: "InvalidPathname", detail: "" })

    // A file without a registered content type is not a servable asset. The
    // build gate keeps such files out of `dist/`; `public/` in development is
    // not gated, so the store answers "absent" rather than guessing a type.
    const fileResponse = (
      pathname: string,
      path: string
    ): Effect.Effect<Option.Option<HttpServerResponse.HttpServerResponse>, StaticStoreError> =>
      Option.match(contentTypeForPath(pathname), {
        onNone: () => Effect.succeedNone,
        onSome: (contentType) =>
          HttpServerResponse.file(path, { headers: { "content-type": contentType } }).pipe(
            Effect.provideService(HttpPlatform.HttpPlatform, platform),
            Effect.mapError(unreadable(pathname)),
            Effect.asSome
          )
      })

    const response = (pathname: string) =>
      locate(pathname).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeedNone,
            onSome: (path) => fileResponse(pathname, path)
          })
        )
      )

    return StaticStore.of({ text, response })
  })

/**
 * Serve static files from `roots`, trying each directory in order and using
 * the first that holds the requested pathname.
 */
export const layer = (
  roots: ReadonlyArray<string>
): Layer.Layer<StaticStore, never, FileSystem.FileSystem | HttpPlatform.HttpPlatform> =>
  Layer.effect(StaticStore, make(roots))
