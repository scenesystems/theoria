import { RegistryProvider } from "@effect-atom/atom-react"
import { describe, expect, it } from "@effect/vitest"
import { Effect, Option } from "effect"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import {
  CapabilityAvailability,
  EntryCapabilityAvailability
} from "../../app/contracts/capability/availability.js"
import { PackageVersions } from "../../app/contracts/capability/package-versions.js"
import { Card } from "../../app/contracts/entry/card.js"
import {
  type HomeCatalogAvailability,
  HomeCatalogAvailabilityResolved,
  HomeCatalogCardPresentation,
} from "../../app/contracts/presentation/home-catalog.js"
import { toneForCard } from "../../app/web/view/primitives/theme/tone.js"
import { InstrumentCard } from "../../app/web/view/home/InstrumentCard.js"

const availableSnapshot = CapabilityAvailability.make({
  entries: [EntryCapabilityAvailability.enabled("effect-search")],
  dsp: {
    enabled: false,
    reason: "DSP runtime unavailable for this test harness."
  }
})

const pendingSnapshot = CapabilityAvailability.make({
  entries: [EntryCapabilityAvailability.pending("effect-search", "Provider startup pending.")],
  dsp: {
    enabled: false,
    reason: "DSP runtime unavailable for this test harness."
  }
})

const packageVersions = PackageVersions.fromRecord({ "effect-search": "0.2.0" })

const waitForTransform = (
  element: HTMLDivElement,
  label: string,
  predicate: (transform: string) => boolean
): Effect.Effect<string, never, never> =>
  Effect.eventually(
    Effect.sync(() => element.style.transform).pipe(
      Effect.filterOrFail((transform) => predicate(transform), () => `waiting-for-${label}`)
    )
  ).pipe(Effect.orDie)

const dispatchPointerEvent = (
  element: HTMLDivElement,
  type: "enter" | "leave"
): Effect.Effect<void, never, never> =>
  Effect.sync(() => {
    element.dispatchEvent(
      new PointerEvent(type === "enter" ? "pointerover" : "pointerout", {
        bubbles: true
      })
    )
  })

const waitForRootElement = (container: HTMLDivElement): Effect.Effect<HTMLDivElement, never, never> =>
  Effect.eventually(
    Effect.sync(() => Option.fromNullable(container.firstElementChild)).pipe(
      Effect.flatMap(
        Option.match({
          onNone: () => Effect.fail("waiting-for-instrument-card-root"),
          onSome: (element) =>
            element instanceof HTMLDivElement
              ? Effect.succeed(element)
              : Effect.fail("waiting-for-instrument-card-root")
        })
      )
    )
  ).pipe(Effect.orDie)

const waitForDocsLink = (container: HTMLDivElement): Effect.Effect<HTMLAnchorElement, never, never> =>
  Effect.eventually(
    Effect.sync(() => container.querySelector('a[href="/packages?package=effect-search"]')).pipe(
      Effect.filterOrFail(
        (element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement,
        () => "waiting-for-package-docs-link"
      )
    )
  ).pipe(Effect.orDie)

const waitForText = (container: HTMLDivElement, text: string): Effect.Effect<void, never, never> =>
  Effect.eventually(
    Effect.sync(() => container.textContent ?? "").pipe(
      Effect.filterOrFail((content) => content.includes(text), () => `waiting-for-${text}`),
      Effect.asVoid
    )
  ).pipe(Effect.orDie)

const waitForTitle = (container: HTMLDivElement, title: string): Effect.Effect<HTMLElement, never, never> =>
  Effect.eventually(
    Effect.sync(() =>
      Array.from(container.querySelectorAll("[title]")).find((element) => element.getAttribute("title") === title)
    ).pipe(
      Effect.filterOrFail(
        (element): element is HTMLElement => element instanceof HTMLElement,
        () => `waiting-for-${title}`
      )
    )
  ).pipe(Effect.orDie)

const instrumentCardForId = ({
  availability,
  id
}: {
  readonly availability: HomeCatalogAvailability
  readonly id: Card["id"]
}): Option.Option<HomeCatalogCardPresentation> =>
  Card.byId(id).pipe(
    Option.map((card) =>
      HomeCatalogCardPresentation.project({
        availability,
        card,
        packageVersions,
        releaseStage: "preview"
      }))
  )

describe("InstrumentCard spring", () => {
  it.live("keeps package docs navigation visible beside package metadata", () =>
    Effect.gen(function*() {
      const cardOption = instrumentCardForId({
        availability: HomeCatalogAvailabilityResolved.fromSnapshot(availableSnapshot),
        id: "effect-search"
      })

      if (Option.isNone(cardOption)) {
        return yield* Effect.die("missing-effect-search-card")
      }

      const card = cardOption.value
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      yield* Effect.sync(() => {
        root.render(
          <StrictMode>
            <RegistryProvider defaultIdleTTL={400}>
              <InstrumentCard card={card} tone={toneForCard(card.id)} />
            </RegistryProvider>
          </StrictMode>
        )
      })

      yield* Effect.ensuring(
        Effect.gen(function*() {
          const docsLink = yield* waitForDocsLink(container)

          expect(docsLink.textContent).toBe("Docs")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.live("rapid hover reversals settle back to rest under StrictMode", () =>
    Effect.gen(function*() {
      const cardOption = instrumentCardForId({
        availability: HomeCatalogAvailabilityResolved.fromSnapshot(availableSnapshot),
        id: "effect-search"
      })

      if (Option.isNone(cardOption)) {
        return yield* Effect.die("missing-effect-search-card")
      }

      const card = cardOption.value
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      yield* Effect.sync(() => {
        root.render(
          <StrictMode>
            <RegistryProvider defaultIdleTTL={400}>
              <InstrumentCard card={card} tone={toneForCard(card.id)} />
            </RegistryProvider>
          </StrictMode>
        )
      })

      yield* Effect.ensuring(
        Effect.gen(function*() {
          const rootElement = yield* waitForRootElement(container)

          yield* dispatchPointerEvent(rootElement, "enter")
          const initialTransform = yield* waitForTransform(
            rootElement,
            "card-transform-active",
            (transform) => transform.length > 0
          )

          expect(initialTransform.length).toBeGreaterThan(0)

          yield* dispatchPointerEvent(rootElement, "leave")
          yield* dispatchPointerEvent(rootElement, "enter")

          const resumedTransform = yield* waitForTransform(
            rootElement,
            "card-transform-resumed",
            (transform) => transform.length > 0
          )

          expect(resumedTransform.length).toBeGreaterThan(0)

          yield* dispatchPointerEvent(rootElement, "leave")

          const restingTransform = yield* waitForTransform(
            rootElement,
            "card-transform-resting",
            (transform) => transform.length === 0
          )

          expect(restingTransform).toBe("")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.live("projects runtime pending status from canonical availability transport", () =>
    Effect.gen(function*() {
      const cardOption = instrumentCardForId({
        availability: HomeCatalogAvailabilityResolved.fromSnapshot(pendingSnapshot),
        id: "effect-search"
      })

      if (Option.isNone(cardOption)) {
        return yield* Effect.die("missing-effect-search-card")
      }

      const card = cardOption.value
      const container = document.createElement("div")
      document.body.appendChild(container)
      const root = createRoot(container)

      yield* Effect.sync(() => {
        root.render(
          <StrictMode>
            <RegistryProvider defaultIdleTTL={400}>
              <InstrumentCard card={card} tone={toneForCard(card.id)} />
            </RegistryProvider>
          </StrictMode>
        )
      })

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitForText(container, "Runtime Pending")
          const badge = yield* waitForTitle(container, "Provider startup pending.")

          expect(container.textContent).toContain("Runtime Pending")
          expect(container.textContent?.includes("Live Demo")).toBe(false)
          expect(badge.textContent).toContain("Runtime Pending")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
