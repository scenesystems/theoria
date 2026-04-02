import type { ReactNode } from "react"

import { surfaceMaterials } from "./designSystem.js"
import { Layer, Stack } from "./Layout.js"
import { type DisplayMetric, MetricStrip } from "./MetricStrip.js"

export const InstrumentPanel = ({
  children,
  controls,
  metrics = []
}: {
  readonly children: ReactNode
  readonly controls: ReactNode
  readonly metrics?: ReadonlyArray<DisplayMetric>
}) => (
  <Stack className={surfaceMaterials.instrumentPanel}>
    <Layer className={surfaceMaterials.instrumentSection}>
      <Stack className="gap-4">
        <Layer>{controls}</Layer>
        {metrics.length === 0
          ? null
          : <MetricStrip density="compact" metrics={metrics} surface="flush" variant="strip" />}
      </Stack>
    </Layer>
    <Layer className={surfaceMaterials.instrumentViewport}>{children}</Layer>
  </Stack>
)
