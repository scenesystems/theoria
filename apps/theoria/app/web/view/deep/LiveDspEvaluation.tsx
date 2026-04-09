import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import * as Arr from "effect/Array"

import {
  type DspEvaluationExample,
  type DspFieldMeta,
  type DspModuleType,
  type DspSignatureContract
} from "../../../contracts/capability/effect-dsp.js"
import { dspWidgetViewModelAtom } from "../../atoms/dsp-widget-model.js"
import { selectDspModuleTypeAtom, selectDspScenarioAtom, setDspOptimizationBudgetAtom } from "../../atoms/dsp-widget.js"
import { AccentBorder } from "../primitives/AccentBorder.js"
import { ChoicePills } from "../primitives/ChoicePills.js"
import { DataTable } from "../primitives/DataTable.js"
import { InstrumentPanel } from "../primitives/InstrumentPanel.js"
import { Stack } from "../primitives/Layout.js"
import { PlaneMetaRail } from "../primitives/PlaneMetaRail.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { SignatureContractPanel } from "../primitives/SignatureContractPanel.js"
import { SliderRow } from "../primitives/SliderRow.js"
import { toneFor } from "../primitives/theme/tone.js"
import { OpenAgentTracePanel } from "../study/open-agent-trace/OpenAgentTracePanel.js"

const tone = toneFor("dsp")

const SignaturePanel = ({ contract }: { readonly contract: DspSignatureContract }) => (
  <SignatureContractPanel
    inputFields={contract.inputFields}
    instruction={contract.instruction}
    outputFields={contract.outputFields}
    title="Signature contract"
    tone={tone}
  />
)

const truncate = (s: string, max: number): string => s.length > max ? `${s.slice(0, max)}…` : s

const evaluationColumns = (
  inputFields: ReadonlyArray<DspFieldMeta>,
  outputFields: ReadonlyArray<DspFieldMeta>
): ReadonlyArray<string> => [
  "#",
  ...Arr.map(inputFields, (f) => f.name),
  ...Arr.map(outputFields, (f) => `→ ${f.name}`)
]

const evaluationRow = (
  example: DspEvaluationExample,
  index: number,
  inputFields: ReadonlyArray<DspFieldMeta>,
  outputFields: ReadonlyArray<DspFieldMeta>
): ReadonlyArray<string> => [
  `${index + 1}`,
  ...Arr.map(inputFields, (f) => truncate(example.input[f.name] ?? "", 72)),
  ...Arr.map(outputFields, (f) => truncate(example.expected[f.name] ?? "", 72))
]

const evaluationRows = (
  examples: ReadonlyArray<DspEvaluationExample>,
  inputFields: ReadonlyArray<DspFieldMeta>,
  outputFields: ReadonlyArray<DspFieldMeta>
): ReadonlyArray<ReadonlyArray<string>> => Arr.map(examples, (ex, i) => evaluationRow(ex, i, inputFields, outputFields))

const EvaluationTable = ({
  contract,
  metricDescription,
  metricName,
  examples
}: {
  readonly contract: DspSignatureContract
  readonly metricDescription: string
  readonly metricName: string
  readonly examples: ReadonlyArray<DspEvaluationExample>
}) => {
  const columns = evaluationColumns(contract.inputFields, contract.outputFields)
  const rows = evaluationRows(examples, contract.inputFields, contract.outputFields)
  const metaMetrics = [
    { label: "Rows", value: `${rows.length}` },
    { label: "Columns", value: `${columns.length}` },
    { label: "Metric", value: metricName }
  ]

  return (
    <Stack className="gap-2.5">
      <PlaneMetaRail
        description={metricDescription}
        eyebrow="Evaluation dataset"
        metricPresentation="inline"
        metrics={metaMetrics}
      />
      <DataTable columns={columns} density="compact" label="Labeled examples" rows={rows} summaryVisible={false} />
    </Stack>
  )
}

const RuntimeStatusPanel = ({
  detail,
  title
}: {
  readonly detail: string
  readonly title: string
}) => (
  <AccentBorder tone={tone}>
    <SemanticText as="p" className={tone.text} role="row-label" text={title} />
    <SemanticText as="p" className="text-ink-800" role="row-value" text={detail} />
  </AccentBorder>
)

const RuntimeEvidencePanel = () => (
  <AccentBorder tone={tone}>
    <Stack className="gap-1.5">
      <SemanticText as="p" className={tone.text} role="row-label" text="Runtime evidence contract" />
      <SemanticText
        as="p"
        className="text-ink-800"
        role="row-value"
        text="The deep dive consumes package-authored prompt text, raw responses, parsed outputs, token totals, and optimizer events from the shared effect-dsp stream."
      />
    </Stack>
  </AccentBorder>
)

const ModuleConfigurationPanel = ({
  controlsLocked,
  moduleType,
  moduleTypeOptions,
  optimizationBudget,
  onSelectModuleType,
  onSetBudget
}: {
  readonly controlsLocked: boolean
  readonly moduleType: DspModuleType
  readonly moduleTypeOptions: ReadonlyArray<{ readonly value: DspModuleType; readonly label: string }>
  readonly optimizationBudget: {
    readonly value: number
    readonly min: number
    readonly max: number
    readonly step: number
    readonly display: string
  }
  readonly onSelectModuleType: (moduleType: DspModuleType) => void
  readonly onSetBudget: (value: number) => void
}) => (
  <Stack className="gap-3">
    <Stack className="gap-1">
      <SemanticText as="p" className={tone.text} role="row-label" text="Module configuration" />
      {controlsLocked
        ? (
          <SemanticText
            as="p"
            className="text-ink-600"
            role="row-value"
            text="Active runs stay pinned to the frozen manifest snapshot until completion."
          />
        )
        : null}
    </Stack>
    <ChoicePills
      activeValue={moduleType}
      disabled={controlsLocked}
      onSelect={onSelectModuleType}
      options={moduleTypeOptions}
      tone={tone}
    />
    <SliderRow
      disabled={controlsLocked}
      display={optimizationBudget.display}
      hint="BootstrapFewShot optimization rounds"
      hintNoWrap
      label="Rounds"
      layout="stacked"
      max={optimizationBudget.max}
      min={optimizationBudget.min}
      onChange={onSetBudget}
      step={optimizationBudget.step}
      tone={tone}
      value={optimizationBudget.value}
    />
  </Stack>
)

export const LiveDspEvaluation = () => {
  const vm = useAtomValue(dspWidgetViewModelAtom)
  const selectScenario = useAtomSet(selectDspScenarioAtom)
  const selectModuleType = useAtomSet(selectDspModuleTypeAtom)
  const setBudget = useAtomSet(setDspOptimizationBudgetAtom)

  return (
    <InstrumentPanel
      controls={
        <Stack className="gap-4">
          <ChoicePills
            activeValue={vm.scenarioId}
            className="w-full gap-2 xl:justify-center"
            disabled={vm.controlsLocked}
            onSelect={selectScenario}
            options={vm.scenarioOptions}
            tone={tone}
          />
          {vm.runtimeStatus !== null
            ? <RuntimeStatusPanel detail={vm.runtimeStatus.detail} title={vm.runtimeStatus.title} />
            : null}
          <RuntimeEvidencePanel />
          <ModuleConfigurationPanel
            controlsLocked={vm.controlsLocked}
            moduleType={vm.moduleType}
            moduleTypeOptions={vm.moduleTypeOptions}
            onSelectModuleType={selectModuleType}
            onSetBudget={setBudget}
            optimizationBudget={vm.optimizationBudget}
          />
        </Stack>
      }
      metrics={vm.metrics}
    >
      <Stack className="gap-5">
        <SignaturePanel contract={vm.scenario.contract} />

        <EvaluationTable
          contract={vm.scenario.contract}
          examples={vm.scenario.examples}
          metricDescription={vm.scenario.metricDescription}
          metricName={vm.scenario.metricName}
        />

        <OpenAgentTracePanel />
      </Stack>
    </InstrumentPanel>
  )
}
