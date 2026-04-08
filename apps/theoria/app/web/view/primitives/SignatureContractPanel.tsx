import type { Tone } from "./designSystem.js"
import { Cluster, Layer, Stack } from "./Layout.js"
import { SemanticText } from "./SemanticText.js"

type ContractField = {
  readonly description: string
  readonly name: string
}

const contractFieldRowClassName = (index: number): string =>
  `${
    index === 0 ? "" : "border-t border-stage-200/60"
  } grid gap-1.5 px-3 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4`

const ContractFieldSection = ({
  fields,
  label,
  tone
}: {
  readonly fields: ReadonlyArray<ContractField>
  readonly label: string
  readonly tone: Tone
}) => (
  <Stack className="gap-2.5">
    <Cluster className="items-center justify-between gap-3">
      <Cluster className="items-center gap-2">
        <Layer aria-hidden className={`h-2 w-2 shrink-0 rounded-full ${tone.bg}`} />
        <SemanticText as="span" className="text-ink-700" role="row-label" text={label} />
      </Cluster>
      <SemanticText
        as="span"
        className="text-ink-500 whitespace-nowrap"
        role="code-meta"
        text={`${fields.length} fields`}
      />
    </Cluster>

    <Layer as="dl" className="border-y border-stage-200/72">
      {fields.map((field, index) => (
        <Layer className={contractFieldRowClassName(index)} key={field.name}>
          <SemanticText
            as="dt"
            className={`${tone.text} max-w-none whitespace-nowrap`}
            role="code-meta"
            text={field.name}
            variant="expanded"
          />
          <SemanticText
            as="dd"
            className="max-w-none text-ink-700"
            role="status"
            text={field.description}
            variant="expanded"
          />
        </Layer>
      ))}
    </Layer>
  </Stack>
)

export const SignatureContractPanel = ({
  inputFields,
  instruction,
  outputFields,
  title,
  tone
}: {
  readonly inputFields: ReadonlyArray<ContractField>
  readonly instruction: string
  readonly outputFields: ReadonlyArray<ContractField>
  readonly title: string
  readonly tone: Tone
}) => (
  <Stack className="gap-4">
    <Cluster className="items-center justify-between gap-3">
      <SemanticText as="p" className={tone.text} role="row-label" text={title} />
      <SemanticText
        as="span"
        className="text-ink-500 whitespace-nowrap"
        role="code-meta"
        text={`${inputFields.length} → ${outputFields.length} fields`}
      />
    </Cluster>

    <Layer as="dl" className="border-y border-stage-200/72">
      <Layer className="grid gap-1.5 px-3 py-3 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)] sm:gap-4">
        <SemanticText
          as="dt"
          className={`${tone.text} max-w-none whitespace-nowrap`}
          role="row-label"
          text="Instruction"
        />
        <SemanticText as="dd" className="max-w-none text-ink-800" role="status" text={instruction} variant="expanded" />
      </Layer>
    </Layer>

    <Layer className="grid gap-5 xl:grid-cols-2 xl:gap-6">
      <ContractFieldSection fields={inputFields} label="Inputs" tone={tone} />
      <ContractFieldSection fields={outputFields} label="Outputs" tone={tone} />
    </Layer>
  </Stack>
)
