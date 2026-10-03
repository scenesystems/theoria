import { expect, it } from "@effect/vitest"
import { Data, Effect, Option, Result } from "effect"
import { HttpServerResponse } from "effect/http"

import type { StaticStoreError } from "../../app/server/config/static-store.js"
import * as AssetsStaticStore from "../../app/server/platform/assets-static-store.js"

/** Stands in for Cloudflare's Promise-returning assets binding; the answer depends only on the pathname. */
const bindingAnswering = (respond: (pathname: string) => Response) =>
  Effect.map(Effect.context(), (runtime) =>
    AssetsStaticStore.make({
      fetch: (url) => Effect.runPromiseWith(runtime)(Effect.sync(() => respond(url.pathname)))
    }))

/** The host's assets binding is unreachable. */
class BindingOffline extends Data.TaggedError("BindingOffline")<{ readonly message: string }> {}

/** An assets binding whose every request rejects, as the host reports an unreachable binding. */
const bindingOffline = Effect.map(Effect.context(), (runtime) =>
  AssetsStaticStore.make({
    fetch: () => Effect.runPromiseWith(runtime)(Effect.fail(new BindingOffline({ message: "binding offline" })))
  }))

/** The binding's answer for a path, built as a server response. */
const answerFor = (pathname: string): HttpServerResponse.HttpServerResponse => {
  if (pathname === "/present.txt") return HttpServerResponse.text("hello", { contentType: "text/plain" })
  if (pathname === "/forbidden.txt") return HttpServerResponse.text("denied", { status: 403 })
  if (pathname === "/broken.txt") return HttpServerResponse.text("boom", { status: 500 })
  return HttpServerResponse.empty({ status: 404 })
}

/** The binding's answer handed over as the web `Response` the binding returns. */
const statusByPath = (pathname: string): Response => HttpServerResponse.toWeb(answerFor(pathname))

const bodyText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.tryPromise(() => HttpServerResponse.toWeb(response).text())

const failureReason = (outcome: Result.Result<unknown, StaticStoreError>) =>
  Result.match(outcome, { onFailure: (error) => Option.some(error.reason), onSuccess: () => Option.none() })

it.effect("a 2xx asset streams, a 404 is absence, and every other status is Unreadable", () =>
  Effect.gen(function*() {
    const store = yield* bindingAnswering(statusByPath)

    const present = yield* store.response("/present.txt")
    expect(Option.isSome(present)).toBe(true)
    if (Option.isSome(present)) {
      expect(yield* bodyText(present.value)).toBe("hello")
    }

    expect(Option.isNone(yield* store.response("/missing.txt"))).toBe(true)

    expect(failureReason(yield* Effect.result(store.response("/forbidden.txt")))).toEqual(Option.some("Unreadable"))
    expect(failureReason(yield* Effect.result(store.response("/broken.txt")))).toEqual(Option.some("Unreadable"))
  }))

it.effect("text reads apply the same status policy", () =>
  Effect.gen(function*() {
    const store = yield* bindingAnswering(statusByPath)

    expect(yield* store.text("/present.txt")).toBe("hello")
    expect(failureReason(yield* Effect.result(store.text("/missing.txt")))).toEqual(Option.some("NotFound"))
    expect(failureReason(yield* Effect.result(store.text("/broken.txt")))).toEqual(Option.some("Unreadable"))
  }))

it.effect("a binding whose fetch rejects is Unreadable, not absent", () =>
  Effect.gen(function*() {
    const store = yield* bindingOffline
    const outcome = yield* Effect.result(store.response("/present.txt"))
    expect(failureReason(outcome)).toEqual(Option.some("Unreadable"))
    if (Result.isFailure(outcome)) {
      expect(outcome.failure.detail).toContain("binding offline")
    }
  }))
