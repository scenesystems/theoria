import { describe, expect, it } from "@effect/vitest"
import { Effect } from "effect"
import { createRoot } from "react-dom/client"

import { DataTable } from "../../app/web/view/primitives/DataTable.js"
import { EvidenceRows } from "../../app/web/view/primitives/EvidenceRows.js"
import { neutralLegendTheme, neutralToneClasses } from "../../app/web/view/primitives/designSystem.js"
import { LegendRail } from "../../app/web/view/primitives/LegendRail.js"
import { MetricStrip } from "../../app/web/view/primitives/MetricStrip.js"
import { PlaneMetaRail } from "../../app/web/view/primitives/PlaneMetaRail.js"
import { SliderRow } from "../../app/web/view/primitives/SliderRow.js"
import { TheoriaLogo } from "../../app/web/view/primitives/TheoriaLogo.js"
import { ToggleSwitch } from "../../app/web/view/primitives/ToggleSwitch.js"

const render = (node: React.ReactNode) => {
  const container = document.createElement("div")
  document.body.appendChild(container)
  const root = createRoot(container)

  root.render(node)

  return { container, root }
}

const waitFor = (predicate: () => boolean): Effect.Effect<void, never, never> =>
  Effect.eventually(Effect.sync(predicate).pipe(Effect.filterOrFail((ready) => ready, () => "waiting-for-dom"))).pipe(
    Effect.asVoid,
    Effect.orDie
  )

describe("public-site accessibility", () => {
  it.effect("labels range controls and keeps definition terms and details structurally valid", () =>
    Effect.gen(function*() {
      const { container, root } = render(
        <>
          <SliderRow
            disabled={false}
            display="5"
            label="Sample size"
            max={10}
            min={1}
            onChange={() => undefined}
            step={1}
            tone={neutralToneClasses}
            value={5}
          />
          <ToggleSwitch
            checked={false}
            disabled={false}
            label="Obstacles"
            onToggle={() => undefined}
            tone={neutralToneClasses}
          />
          <MetricStrip
            metrics={[{ label: "Iterations", value: "12" }, { label: "Status", value: "Stable" }]}
          />
          <PlaneMetaRail
            metrics={[{ label: "Rows", value: "2" }, { label: "Columns", value: "2" }]}
          />
          <LegendRail
            items={[{ label: "Observed", shape: "circle", theme: neutralLegendTheme, value: "2" }]}
          />
          <DataTable columns={["Name", "Value"]} label="Example" rows={[["alpha", "1"]]} />
          <EvidenceRows
            density="compact"
            rows={[{ label: "Method", value: "Bayesian" }, { label: "Result", value: "Stable" }]}
            variant="expanded"
          />
        </>
      )

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.querySelector('input[type="range"]') !== null)
          expect(container.querySelector('input[type="range"]')?.getAttribute("aria-label")).toBe("Sample size")
          expect(container.querySelector('[role="switch"]')?.getAttribute("aria-label")).toBe("Obstacles")

          const groupedMetrics = Array.from(container.querySelectorAll("ul"))
          expect(groupedMetrics).toHaveLength(3)
          expect(groupedMetrics.every((list) => Array.from(list.children).every((child) => child.tagName === "LI")))
            .toBe(true)

          const tableRegion = container.querySelector('[role="region"][aria-label="Example table"]')
          expect(tableRegion?.getAttribute("tabindex")).toBe("0")

          const list = container.querySelector("dl")
          expect(list?.children).toHaveLength(4)
          expect(Array.from(list?.children ?? []).map((child) => child.tagName)).toEqual([
            "DT",
            "DD",
            "DT",
            "DD"
          ])
          expect(container.querySelectorAll("dt, dd")).toHaveLength(4)
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))

  it.effect("exposes the logo through valid text or image semantics", () =>
    Effect.gen(function*() {
      const { container, root } = render(<><TheoriaLogo /><TheoriaLogo animation="glossary" /></>)

      yield* Effect.ensuring(
        Effect.gen(function*() {
          yield* waitFor(() => container.textContent?.includes("Theoria") === true)
          expect(container.querySelector("span:not([role])[aria-label]")).toBeNull()
          expect(container.querySelector('[role="img"]')?.getAttribute("aria-label")).toBe("Theoria")
        }),
        Effect.sync(() => {
          root.unmount()
          container.remove()
        })
      )
    }))
})
