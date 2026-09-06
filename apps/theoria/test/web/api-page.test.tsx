import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Option } from "effect"
import type { ReactNode } from "react"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import { ApiPageView } from "../../app/web/view/docs/ApiPageView.js"
import { docsApiExportPageFixture, docsApiModuleIndexFixture } from "../helpers/docs-api-fixtures.js"
import { mountWithRegistry, waitFor } from "../helpers/react-mount.js"

/** Mounts `node`, waits until `settled` is visible in its text, then hands the container to `use`. */
const withPage = (
  node: ReactNode,
  settled: string,
  use: (container: HTMLDivElement) => void
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const { container } = yield* mountWithRegistry(node)
    yield* waitFor(() => container.textContent?.includes(settled) === true)
    use(container)
  }).pipe(Effect.scoped, Effect.provide(BrowserDocument.layer))

describe("API page presentation", () => {
  it.effect("indexes exports by category and summary without rendering a declaration dump", () =>
    withPage(<ApiPageView page={docsApiModuleIndexFixture} />, "Run a study.", (container) => {
      expect(container.querySelector("a[href=\"#api-runStudy\"]")).not.toBeNull()
      expect(container.querySelector("a[href=\"#api-StudyResult\"]")).not.toBeNull()
      expect(container.textContent).not.toContain("runStudy<A>")
      expect(container.textContent).not.toContain("readonly value: A")
      expect(
        Arr.some(
          Arr.fromIterable(container.querySelectorAll("p")),
          (element) => element.textContent === "Source-wrapped remarks remain\nordinary prose."
        )
      ).toBe(true)
    }))

  it.effect("leads a selected function with documentation before its reference details", () =>
    withPage(
      <ApiPageView page={docsApiModuleIndexFixture} selectedExport={Option.some(docsApiExportPageFixture(0).export)} />,
      "runStudy<A>",
      (container) => {
        expect(container.textContent).toContain("Type parameters")
        expect(container.textContent).toContain("Study input.")
        expect(container.textContent).toContain("Input configuration.")
        expect(container.textContent).toContain("Effect<StudyResult<A>>")
        expect(container.textContent).toContain("const result = yield* runStudy(input)")
        expect(container.textContent?.indexOf("Run a study.")).toBeLessThan(
          container.textContent?.indexOf("runStudy<A>") ?? 0
        )
        expect(container.querySelectorAll("a[target=\"_blank\"]")).not.toHaveLength(0)
        expect(container.textContent).not.toContain("export declare")
        expect(container.textContent).not.toContain("```ts")
      }
    ))

  it.effect("renders documented members only when their export is selected", () =>
    withPage(
      <ApiPageView page={docsApiModuleIndexFixture} selectedExport={Option.some(docsApiExportPageFixture(1).export)} />,
      "readonly value: A",
      (container) => {
        expect(container.textContent).toContain("The selected value.")
        expect(container.textContent).not.toContain("runStudy<A>")
      }
    ))
})
