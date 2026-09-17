import { describe, expect, it } from "@effect/vitest"
import { Array as Arr, Effect, Equal, Option, String as Str } from "effect"
import type { ReactNode } from "react"

import * as BrowserDocument from "../../app/web/platform/BrowserDocument.js"
import { ApiExportView } from "../../app/web/view/docs/ApiExportView.js"
import { ApiPageView } from "../../app/web/view/docs/ApiPageView.js"
import {
  callableMemberApiExportFixture,
  declarationDocumentedApiExportFixture,
  docsApiExportPageFixture,
  docsApiModuleIndexFixture,
  overloadedApiExportFixture
} from "../helpers/docs-api-fixtures.js"
import { mountWithRegistry, waitFor } from "../helpers/react-mount.js"

/** Mounts `node`, waits until `settled` is visible in its text, then hands the container to `use`. */
const withPage = (
  node: ReactNode,
  settled: string,
  use: (container: HTMLDivElement) => void
): Effect.Effect<void> =>
  Effect.gen(function*() {
    const { container } = yield* mountWithRegistry(node)
    yield* waitFor(() => Option.exists(Option.fromNullable(container.textContent), Str.includes(settled)))
    use(container)
  }).pipe(Effect.scoped, Effect.provide(BrowserDocument.layer))

describe("API page presentation", () => {
  it.effect("indexes exports by category and summary without rendering a declaration dump", () =>
    withPage(<ApiPageView page={docsApiModuleIndexFixture} />, "Run a study.", (container) => {
      expect(container.querySelector("h1")?.textContent).toBe("Study")
      expect(container.querySelector("h2")?.textContent).toBe("Remarks")
      expect(container.querySelector("a[href=\"#api-runStudy\"]")).not.toBeNull()
      expect(container.querySelector("a[href=\"#api-StudyResult\"]")).not.toBeNull()
      expect(container.textContent).not.toContain("runStudy<A>")
      expect(container.textContent).not.toContain("readonly value: A")
      expect(
        Arr.some(
          Arr.fromIterable(container.querySelectorAll("p")),
          (element) => Equal.equals(element.textContent, "Source-wrapped remarks remain\nordinary prose.")
        )
      ).toBe(true)
    }))

  it.effect("leads a selected function with documentation before its reference details", () =>
    withPage(
      <ApiPageView page={docsApiModuleIndexFixture} selectedExport={Option.some(docsApiExportPageFixture(0).export)} />,
      "runStudy<A>",
      (container) => {
        expect(container.querySelector("h1")?.textContent).toBe("runStudy")
        expect(Arr.map(Arr.fromIterable(container.querySelectorAll("h2")), (heading) => heading.textContent)).toEqual([
          "Type parameters",
          "Parameters",
          "Returns"
        ])
        expect(container.textContent).toContain("Type parameters")
        expect(container.textContent).toContain("Study input.")
        expect(container.textContent).toContain("Input configuration.")
        expect(container.textContent).toContain("Effect<StudyResult<A>>")
        expect(container.textContent).toContain("const result = yield* runStudy(input)")
        const text = Option.getOrThrow(Option.fromNullable(container.textContent))
        expect(Option.getOrThrow(Str.indexOf("Run a study.")(text))).toBeLessThan(
          Option.getOrThrow(Str.indexOf("runStudy<A>")(text))
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
        expect(container.querySelector("h1")?.textContent).toBe("StudyResult")
        expect(Arr.map(Arr.fromIterable(container.querySelectorAll("h2")), (heading) => heading.textContent)).toEqual([
          "Type parameters",
          "Members"
        ])
        expect(container.querySelector("h3")?.textContent).toBe("value")
        expect(container.textContent).toContain("The selected value.")
        expect(container.textContent).not.toContain("runStudy<A>")
      }
    ))

  it.effect("renders declaration documentation when a callable signature has none", () =>
    withPage(
      <ApiExportView apiExport={declarationDocumentedApiExportFixture} />,
      "betaQuantile(p: number, alpha: number, beta: number): number",
      (container) => {
        expect(container.textContent).toContain("Computes a beta quantile with safeguarded Newton refinement.")
        expect(container.textContent).toContain(
          "Endpoint probabilities return exact support endpoints while interior estimates remain bracketed."
        )
      }
    ))

  it.effect("renders overload-specific documentation without repeating declaration documentation", () =>
    withPage(
      <ApiExportView apiExport={overloadedApiExportFixture} />,
      "snapshot(active: Active): Snapshot",
      (container) => {
        const paragraphs = Arr.fromIterable(container.querySelectorAll("p"))
        expect(
          Arr.filter(paragraphs, (paragraph) => Equal.equals(paragraph.textContent, "Captures a replay snapshot."))
        )
          .toHaveLength(1)
        expect(container.textContent).toContain("Captures the current state of an active optimization.")
        expect(container.textContent).toContain("The active overload retains resumable state.")
        expect(container.textContent).toContain("Overload 1")
        expect(container.textContent).toContain("Overload 2")
      }
    ))

  it.effect("renders member documentation when a callable member signature has none", () =>
    withPage(
      <ApiExportView apiExport={callableMemberApiExportFixture} />,
      "run(input: Input): Result",
      (container) => {
        expect(container.textContent).toContain("Runs one optimization from the supplied input.")
      }
    ))
})
