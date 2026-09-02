import { FileSystem, HttpPlatform, HttpServerResponse } from "@effect/platform"
import { Effect, Layer, Option, Schema } from "effect"
import * as Arr from "effect/Array"

import { contentTypeForPath, StaticStore, StaticStoreError } from "../config/static-store.js"

/**
 * `StaticStore` backed by the built `dist/` directory on disk.
 *
 * Used by the Bun server (`apps/theoria/server.ts`). Serves `.gz` sidecars
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

const make = (distRoot: string) =>
  Effect.gen(function*() {
    const fileSystem = yield* FileSystem.FileSystem
    const platform = yield* HttpPlatform.HttpPlatform
    const root = distRoot.endsWith("/") ? distRoot.slice(0, -1) : distRoot

    const filePath = (pathname: string): Option.Option<string> =>
      isAssetPathname(pathname) ? Option.some(`${root}${pathname}`) : Option.none()

    const exists = (path: string) => fileSystem.exists(path).pipe(Effect.catchAll(() => Effect.succeed(false)))

    const text = (pathname: string) =>
      Option.match(filePath(pathname), {
        onNone: () => Effect.fail(new StaticStoreError({ pathname, message: "Invalid asset pathname." })),
        onSome: (path) =>
          fileSystem.readFileString(path).pipe(
            Effect.mapError((cause) => new StaticStoreError({ pathname, message: String(cause) }))
          )
      })

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
      Option.match(filePath(pathname), {
        onNone: () => Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>()),
        onSome: (path) =>
          exists(path).pipe(
            Effect.flatMap((present) =>
              present
                ? fileResponse(pathname, path, acceptEncoding)
                : Effect.succeed(Option.none<HttpServerResponse.HttpServerResponse>())
            )
          )
      })

    return StaticStore.of({ text, response })
  })

export const layer = (
  distRoot: string
): Layer.Layer<StaticStore, never, FileSystem.FileSystem | HttpPlatform.HttpPlatform> =>
  Layer.effect(StaticStore, make(distRoot))
