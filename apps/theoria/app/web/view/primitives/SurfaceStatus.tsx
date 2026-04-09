import { Match } from "effect"

import type { SurfaceVariant } from "../../../contracts/presentation/program.js"
import type { StatusTone } from "../surfaceModel.js"

import { Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"
import type { Surface } from "./theme/surface.js"

const statusShellClassName = (tone: StatusTone): string =>
  Match.value(tone).pipe(
    Match.when("strip", () => "rounded-md border px-3 py-2"),
    Match.orElse(() => "rounded-md border px-4 py-3")
  )

const statusBodyClassName = (tone: StatusTone): string =>
  Match.value(tone).pipe(
    Match.when("strip", () => "gap-1 sm:flex-row sm:items-center sm:gap-3"),
    Match.orElse(() => "gap-1")
  )

const statusLabelClassName = (_tone: StatusTone): string => "text-ink-700"

export const SurfaceStatus = ({
  status,
  theme,
  tone,
  variant
}: {
  readonly status: string
  readonly theme: Surface
  readonly tone: StatusTone
  readonly variant: SurfaceVariant
}) => (
  <Layer className={`${statusShellClassName(tone)} ${theme.statusTag}`}>
    <Stack className={statusBodyClassName(tone)}>
      <SemanticText
        as="p"
        className={statusLabelClassName(tone)}
        role="row-label"
        text="Runtime Status"
        variant={variant}
      />
      <SemanticText as="p" className="text-ink-900" role="status" text={status} variant={variant} />
    </Stack>
  </Layer>
)
