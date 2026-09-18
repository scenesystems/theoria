import { HttpServerResponse } from "@effect/platform"
import { expect, it } from "@effect/vitest"
import { Boolean as Bool, Data, Effect, Either, Function as Fn, Option, Runtime, String as Str } from "effect"

import type { StaticStoreError } from "../../app/server/config/static-store.js"
import * as AssetsStaticStore from "../../app/server/platform/assets-static-store.js"

/** Stands in for Cloudflare's Promise-returning assets binding; the answer depends only on the pathname. */
const bindingAnswering = (respond: (pathname: string) => Response) =>
  Effect.map(Effect.runtime(), (runtime) =>
    AssetsStaticStore.make({
      fetch: (url) => Runtime.runPromise(runtime)(Effect.sync(() => respond(url.pathname)))
    }))

/** The host's assets binding is unreachable. */
class BindingOffline extends Data.TaggedError("BindingOffline")<{ readonly message: string }> {}

/** An assets binding whose every request rejects, as the host reports an unreachable binding. */
const bindingOffline = Effect.map(Effect.runtime(), (runtime) =>
  AssetsStaticStore.make({
    fetch: () => Runtime.runPromise(runtime)(Effect.fail(new BindingOffline({ message: "binding offline" })))
  }))

/** The binding's answer for a path, built as a server response. */
const answerFor = (pathname: string): HttpServerResponse.HttpServerResponse => {
  return Bool.match(Str.Equivalence(pathname, "/present.txt"), {
    onTrue: () => HttpServerResponse.text("hello", { contentType: "text/plain" }),
    onFalse: () =>
      Bool.match(Str.Equivalence(pathname, "/forbidden.txt"), {
        onTrue: () => HttpServerResponse.text("denied", { status: 403 }),
        onFalse: () =>
          Bool.match(Str.Equivalence(pathname, "/broken.txt"), {
            onTrue: () => HttpServerResponse.text("boom", { status: 500 }),
            onFalse: () => HttpServerResponse.empty({ status: 404 })
          })
      })
  })
}

/** The binding's answer handed over as the web `Response` the binding returns. */
const statusByPath = (pathname: string): Response => HttpServerResponse.toWeb(answerFor(pathname))

const bodyText = (response: HttpServerResponse.HttpServerResponse) =>
  Effect.tryPromise(() => HttpServerResponse.toWeb(response).text())

const failureReason = (outcome: Either.Either<unknown, StaticStoreError>) =>
  Either.match(outcome, { onLeft: (error) => Option.some(error.reason), onRight: () => Option.none() })

it.effect("a 2xx asset streams, a 404 is absence, and every other status is Unreadable", () =>
  Effect.gen(function*() {
    const store = yield* bindingAnswering(statusByPath)

    const present = yield* store.response("/present.txt")
    expect(Option.isSome(present)).toBe(true)
    yield* Option.match(present, {
      onNone: () => Effect.void,
      onSome: (response) => Effect.map(bodyText(response), (body) => expect(body).toBe("hello"))
    })

    expect(Option.isNone(yield* store.response("/missing.txt"))).toBe(true)

    expect(failureReason(yield* Effect.either(store.response("/forbidden.txt")))).toEqual(Option.some("Unreadable"))
    expect(failureReason(yield* Effect.either(store.response("/broken.txt")))).toEqual(Option.some("Unreadable"))
  }))

it.effect("text reads apply the same status policy", () =>
  Effect.gen(function*() {
    const store = yield* bindingAnswering(statusByPath)

    expect(yield* store.text("/present.txt")).toBe("hello")
    expect(failureReason(yield* Effect.either(store.text("/missing.txt")))).toEqual(Option.some("NotFound"))
    expect(failureReason(yield* Effect.either(store.text("/broken.txt")))).toEqual(Option.some("Unreadable"))
  }))

it.effect("a binding whose fetch rejects is Unreadable, not absent", () =>
  Effect.gen(function*() {
    const store = yield* bindingOffline
    const outcome = yield* Effect.either(store.response("/present.txt"))
    expect(failureReason(outcome)).toEqual(Option.some("Unreadable"))
    Either.match(outcome, {
      onLeft: (error) => expect(error.detail).toContain("binding offline"),
      onRight: Fn.constVoid
    })
  }))
