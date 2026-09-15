import { HttpServerRequest, HttpServerResponse } from "@effect/platform"
import { describe, expect, it } from "@effect/vitest"
import { Data, Effect, Equal, Layer, Option } from "effect"
import * as Arr from "effect/Array"

import { colorModeCookieName } from "../../app/contracts/color-mode.js"
import { Analytics, disabledAnalytics } from "../../app/server/config/analytics.js"
import { DocsManifestStore } from "../../app/server/config/docs-manifest-store.js"
import { StaticStore, StaticStoreError } from "../../app/server/config/static-store.js"
import { staticResponse } from "../../app/server/routes/static.js"
import { docsManifestFixture } from "../helpers/docs-fixtures.js"
import { serverRequest, serverRequestWithCookie } from "./platform/web-request.js"

/**
 * The Worker serves the shell already in the reader's colour mode, read from
 * the cookie the browser's `KeyValueStore` writes. The shell's root element
 * is the fixture's; the metadata placeholders are not under test here.
 */

const shell = Arr.join([
  "<!doctype html>",
  "<html lang=\"en\">",
  "<head><title>x</title></head>",
  "<body></body>",
  "</html>"
], "\n")

const ShellStore = Layer.succeed(
  StaticStore,
  StaticStore.of({
    text: (pathname) =>
      Effect.succeed(pathname).pipe(
        Effect.filterOrFail(
          (name) => Equal.equals(name, "/index.html"),
          (name) => new StaticStoreError({ pathname: name, reason: "NotFound", detail: "" })
        ),
        Effect.as(shell)
      ),
    response: () => Effect.succeedNone
  })
)

const Services = Layer.mergeAll(
  ShellStore,
  Layer.succeed(DocsManifestStore, DocsManifestStore.of({ manifest: Effect.succeed(docsManifestFixture) })),
  Layer.succeed(Analytics, disabledAnalytics)
)

/** The response body could not be read as text. */
class UnreadableBody extends Data.TaggedError("UnreadableBody")<{ readonly cause: unknown }> {}

const responseText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.tryPromise({
    try: () => HttpServerResponse.toWeb(response).text(),
    catch: (cause) => new UnreadableBody({ cause })
  })

/** Serves `pathname` to a request carrying `cookie` as its `Cookie` header, or none. */
const serve = (pathname: string, cookie: Option.Option<string>) =>
  staticResponse(pathname).pipe(
    Effect.provide(Services),
    Effect.provideService(
      HttpServerRequest.HttpServerRequest,
      Option.match(cookie, {
        onNone: () => serverRequest(`https://theoria.scenesystems.io${pathname}`, { method: "GET" }),
        onSome: (header) => serverRequestWithCookie(`https://theoria.scenesystems.io${pathname}`, header)
      })
    )
  )

/** The cookie as the browser's schema store writes it: the preference as a JSON string, URL-encoded on the wire. */
const preferenceCookie = (preference: string) => `${colorModeCookieName}=%22${preference}%22`

describe("the shell's colour mode", () => {
  it.effect("is dark, before any script runs, for a reader whose cookie says dark", () =>
    Effect.gen(function*() {
      const response = yield* serve("/", Option.some(preferenceCookie("dark")))
      expect(response.status).toBe(200)
      expect(yield* responseText(response)).toContain("<html lang=\"en\" class=\"dark\">")
    }))

  it.effect("keys any cache on the cookie, since the same URL now has two bodies", () =>
    Effect.gen(function*() {
      const response = yield* serve("/docs", Option.some(preferenceCookie("dark")))
      expect(response.headers["vary"]).toBe("Cookie")
      expect(yield* responseText(response)).toContain("<html lang=\"en\" class=\"dark\">")
    }))

  it.effect("carries no class for a reader who follows the system: the browser reads the system, not the Worker", () =>
    Effect.gen(function*() {
      const response = yield* serve("/", Option.some(preferenceCookie("system")))
      expect(yield* responseText(response)).toContain("<html lang=\"en\">\n")
    }))

  it.effect("carries no class for a reader who chose light", () =>
    Effect.gen(function*() {
      const body = yield* Effect.flatMap(serve("/", Option.some(preferenceCookie("light"))), responseText)
      expect(body).not.toContain("class=\"dark\"")
    }))

  it.effect("carries no class for a first visit, with no cookie at all", () =>
    Effect.gen(function*() {
      const response = yield* serve("/", Option.none())
      expect(response.status).toBe(200)
      expect(yield* responseText(response)).toContain("<html lang=\"en\">\n")
    }))

  it.effect("treats a cookie it cannot decode as no preference and still serves the page", () =>
    Effect.gen(function*() {
      const garbage = yield* serve("/", Option.some(`${colorModeCookieName}=%22purple%22; other=1`))
      expect(garbage.status).toBe(200)
      expect(yield* responseText(garbage)).toContain("<html lang=\"en\">\n")

      const unquoted = yield* serve("/", Option.some(`${colorModeCookieName}=dark`))
      expect(unquoted.status).toBe(200)
      expect(yield* responseText(unquoted)).not.toContain("class=\"dark\"")
    }))
})
