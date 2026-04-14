import { Schema } from "effect"

export const RunRuntimeTelemetrySectionKind = Schema.Literal("facts", "trace")

export type RunRuntimeTelemetrySectionKind = typeof RunRuntimeTelemetrySectionKind.Type

export class RunRuntimeTelemetryRow extends Schema.Class<RunRuntimeTelemetryRow>("RunRuntimeTelemetryRow")({
  label: Schema.String,
  value: Schema.String
}) {}

export class RunRuntimeTelemetrySection extends Schema.Class<RunRuntimeTelemetrySection>("RunRuntimeTelemetrySection")({
  description: Schema.String,
  kind: RunRuntimeTelemetrySectionKind,
  rows: Schema.Array(RunRuntimeTelemetryRow),
  title: Schema.String
}) {}

export class RunRuntimeTelemetryViewModel extends Schema.Class<RunRuntimeTelemetryViewModel>(
  "RunRuntimeTelemetryViewModel"
)({
  sections: Schema.Array(RunRuntimeTelemetrySection)
}) {}

export const runRuntimeTelemetryRow = (label: string, value: string): RunRuntimeTelemetryRow =>
  RunRuntimeTelemetryRow.make({ label, value })

export const runRuntimeTelemetrySection = ({
  description,
  kind = "facts",
  rows,
  title
}: {
  readonly description: string
  readonly kind?: RunRuntimeTelemetrySectionKind
  readonly rows: ReadonlyArray<RunRuntimeTelemetryRow>
  readonly title: string
}): RunRuntimeTelemetrySection =>
  RunRuntimeTelemetrySection.make({
    description,
    kind,
    rows,
    title
  })

export const runRuntimeTelemetryViewModel = (
  sections: ReadonlyArray<RunRuntimeTelemetrySection>
): RunRuntimeTelemetryViewModel => RunRuntimeTelemetryViewModel.make({ sections })
