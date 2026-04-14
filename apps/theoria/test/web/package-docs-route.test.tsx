import { BunContext } from "@effect/platform-bun"
import { describe, expect, it } from "@effect/vitest"
import { loadPackageDocsCorpus, packageDocsBundle, packageNameFromString } from "@theoria/source-proof"
import { Effect } from "effect"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import { PageLocation } from "../../app/contracts/presentation/page-location.js"
import { PackageDocsRoute } from "../../app/contracts/presentation/path.js"
import { App } from "../../app/web/App.js"

const responseMeta = {
  requestId: "req-package-docs",
  buildSha: "build-package-docs",
  durationMs: 1
}

const withPackageDocsFetchMock = <A, E, R>(effect: Effect.Effect<A, E, R>) => {
  const previousFetch = globalThis.fetch

  return Effect.gen(function*() {
    const corpus = yield* loadPackageDocsCorpus()
    const bundleFixture = corpus.bundles.find((bundle) => bundle.packageId === "@scenesystems/digest")
    const catalogFixture = corpus.catalog.filter((entry) =>
      entry.packageId === "@scenesystems/digest" || entry.packageId === "effect-math"
    )

    if (bundleFixture === undefined) {
      return yield* Effect.fail("missing-digest-bundle-fixture")
    }

    const trimmedBundleFixture = {
      ...bundleFixture,
      readme: {
        ...bundleFixture.readme,
        blocks: bundleFixture.readme.blocks.slice(0, 1)
      },
      moduleDocs: bundleFixture.moduleDocs.slice(0, 1).map((document) => ({
        ...document,
        blocks: document.blocks.slice(0, 1)
      })),
      examples: bundleFixture.examples.slice(0, 1),
      proofCommands: bundleFixture.proofCommands.slice(0, 1),
      releaseSnapshots: bundleFixture.releaseSnapshots.slice(0, 1)
    }

    yield* Effect.sync(() => {
      Reflect.set(globalThis, "fetch", (input: string | URL | Request) => {
        const url = typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url

        if (url.includes("/api/package-docs/catalog")) {
          return Promise.resolve({
            json: () => Promise.resolve({ ok: true, meta: responseMeta, data: catalogFixture })
          })
        }

        if (url.includes("/api/package-docs/bundle")) {
          const packageId = new URL(url, "http://127.0.0.1").searchParams.get("package")
          const bundle = packageId === null ? null : packageDocsBundle(corpus, packageNameFromString(packageId))

          return Promise.resolve({
            json: () => Promise.resolve({
              ...(bundle?._tag === "Some"
                ? { ok: true, meta: responseMeta, data: trimmedBundleFixture }
                : {
                  ok: false,
                  meta: responseMeta,
                  error: {
                    code: "invalid-package-id",
                    message: `Unexpected bundle lookup: ${String(packageId)}`,
                    retryable: false
                  }
                })
            })
          })
        }

        return Promise.resolve({
          json: () => Promise.resolve({
            ok: false,
            meta: responseMeta,
            error: {
              code: "route-not-found",
              message: `Unexpected fetch: ${url}`,
              retryable: false
            }
          })
        })
      })
    })

    return yield* effect
  }).pipe(
    Effect.ensuring(
      Effect.sync(() => {
        Reflect.set(globalThis, "fetch", previousFetch)
      })
    )
  )
}

describe("web/package-docs-route", () => {
  it.live("renders package navigation, normalized groups, and visible source links from the thin docs adapter", () =>
    withPackageDocsFetchMock(
      Effect.gen(function*() {
        const container = document.createElement("div")
        document.body.appendChild(container)
        const root = createRoot(container)

        yield* Effect.sync(() => {
          const route = PackageDocsRoute.fromSelectedPackageId(packageNameFromString("@scenesystems/digest"))
          const routeUrl = new URL(route.path(), "http://127.0.0.1")

          root.render(
            <StrictMode>
              <App location={PageLocation.fromPathnameSearch(routeUrl.pathname, routeUrl.search)} />
            </StrictMode>
          )
        })

        yield* Effect.ensuring(
          Effect.gen(function*() {
            yield* Effect.sleep("2 seconds")

            const heading = container.querySelector("h1")
            const packageNavLink = container.querySelector('a[href="/packages?package=effect-math"]')
            const repositoryLink = container.querySelector(
              'a[href="https://github.com/scenesystems/theoria/tree/main/packages/digest"]'
            )

            expect(heading?.textContent).toBe("@scenesystems/digest Docs")
            expect(container.textContent?.includes("README")).toBe(true)
            expect(packageNavLink instanceof HTMLAnchorElement).toBe(true)
            expect(packageNavLink?.textContent).toBe("effect-math")
            expect(repositoryLink instanceof HTMLAnchorElement).toBe(true)
            expect(repositoryLink?.textContent).toBe("Repository")
          }),
          Effect.sync(() => {
            root.unmount()
            container.remove()
          })
        )
      })
    ).pipe(Effect.provide(BunContext.layer)))
})
