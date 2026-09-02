import { FileSystem, HttpPlatform, HttpServerResponse } from "@effect/platform"
import { Effect, Layer, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { contentTypeForPath, StaticStore, StaticStoreError } from "../config/static-store.js"

/**
 * `StaticStore` backed by directories on disk, searched in order.
 *
 * Used by the Bun server (`apps/theoria/server.ts`), which lists the built
 * `dist/` first and the source `public/` second so that generated runtime data
 * is reachable before `vite build` has copied it. Serves `.gz` sidecars
 * written by `scripts/compress-static-assets.ts` when the client accepts gzip.
 */

const AssetPathname = Schema.String.pipe(
  Schema.pattern(/^\/[A-Za-z0-9._/-]+$/u),
  Schema.filter((value) => !value.endsWith("/") && !value.includes("..") && !value.includes("//"))
)

const isAssetPathname = Schema.is(AssetPathname)

export const acceptsGzip = (header: Option.Option<string>): boolean =>
  Option.exists(header, (value) => {
    const preferences = Arr.map(value.split(","), (entry) => {
      const [coding, ...parameters] = entry.trim().toLocaleLowerCase("en-US").split(";")
      const quality = Arr.findFirst(parameters, (parameter) => parameter.trim().startsWith("q="))
      return {
        coding,
        accepted: Option.match(quality, {
          onNone: () => true,
          onSome: (parameter) => Number.parseFloat(parameter.trim().slice(2)) > 0
        })
      }
    })
    return Option.match(Arr.findFirst(preferences, ({ coding }) => coding === "gzip"), {
      onNone: () =>
        Option.exists(Arr.findFirst(preferences, ({ coding }) => coding === "*"), ({ accepted }) => accepted),
      onSome: ({ accepted }) => accepted
    })
  })

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

    const fileResponse = (pathname: string, path: string, acceptEncoding: Option.Option<string>) =>
      Effect.gen(function*() {
        const compressedPath = `${path}.gz`
        const compressed = acceptsGzip(acceptEncoding) ? yield* exists(compressedPath) : false

        return yield* HttpServerResponse.file(compressed ? compressedPath : path, {
          headers: {
            "content-type": contentTypeForPath(pathname),
            ...(compressed ? { "content-encoding": "gzip" } : {})
          }
        })
      }).pipe(
        Effect.provideService(HttpPlatform.HttpPlatform, platform),
        Effect.map(Option.some),
        Effect.catchAll(() => Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>()))
      )

    const response = (pathname: string, acceptEncoding: Option.Option<string>) =>
      locate(pathname).pipe(
        Effect.flatMap(
          Option.match({
            onNone: () => Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>()),
            onSome: (path) => fileResponse(pathname, path, acceptEncoding)
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
