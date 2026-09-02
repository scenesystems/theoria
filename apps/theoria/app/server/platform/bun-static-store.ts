import { FileSystem, HttpPlatform, HttpServerResponse } from "@effect/platform"
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

    const exists = (path: string) => fileSystem.exists(path).pipe(Effect.catchAll(() => Effect.succeed(false)))

    /** The first root that holds `pathname`, or none when no root does. */
    const locate = (pathname: string): Effect.Effect<Option.Option<string>> =>
      isAssetPathname(pathname)
        ? Effect.findFirst(Arr.map(searchRoots, (root) => `${root}${pathname}`), exists)
        : Effect.succeed(Option.none())

    const text = (pathname: string) =>
      isAssetPathname(pathname)
        ? locate(pathname).pipe(
          Effect.flatMap(
            Option.match({
              onNone: () => Effect.fail(new StaticStoreError({ pathname, message: "Asset not found." })),
              onSome: (path) =>
                fileSystem.readFileString(path).pipe(
                  Effect.mapError((cause) => new StaticStoreError({ pathname, message: String(cause) }))
                )
            })
          )
        )
        : Effect.fail(new StaticStoreError({ pathname, message: "Invalid asset pathname." }))

    const fileResponse = (pathname: string, path: string) =>
      HttpServerResponse.file(path, {
        headers: {
          "content-type": contentTypeForPath(pathname)
        }
      }).pipe(
        Effect.provideService(HttpPlatform.HttpPlatform, platform),
        Effect.map(Option.some),
        Effect.catchAll(() => Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>()))
      )

    const response = (pathname: string) =>
      locate(pathname).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>()),
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
