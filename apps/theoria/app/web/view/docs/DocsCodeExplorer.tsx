import { Button } from "@base-ui-components/react/button"
import { useAtomSet, useAtomValue } from "@effect-atom/atom-react"
import { Match } from "effect"

import type { DocsCodeExample } from "../../../contracts/docs.js"
import { docsCodeExampleAtom } from "../../atoms/docs.js"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { SemanticText } from "../primitives/SemanticText.js"

const studySource = `import { Effect } from "effect"
import { Sampler, SearchSpace, Study } from "@scenesystems/effect-search"

const program = Effect.gen(function* () {
  const space = yield* SearchSpace.make({
    x: SearchSpace.float(-5, 5),
    y: SearchSpace.float(-5, 5)
  })

  return yield* Study.minimize({
    space,
    sampler: Sampler.tpe({ seed: 42 }),
    objective: ({ x, y }) =>
      Effect.succeed((x - 2) ** 2 + (y + 1) ** 2),
    trials: 50
  })
})

Effect.runPromise(program)`

const objectiveSource = `import { Effect } from "effect"

type Config = {
  readonly x: number
  readonly y: number
}

const objective = ({ x, y }: Config) =>
  Effect.succeed((x - 2) ** 2 + (y + 1) ** 2)`

const sourceFor = (example: DocsCodeExample): string =>
  Match.value(example).pipe(
    Match.when("study", () => studySource),
    Match.when("objective", () => objectiveSource),
    Match.exhaustive
  )

const ExampleTab = ({
  active,
  label,
  value
}: {
  readonly active: boolean
  readonly label: string
  readonly value: DocsCodeExample
}) => {
  const setExample = useAtomSet(docsCodeExampleAtom)

  return (
    <Button
      aria-selected={active}
      className={`rounded-lg px-3 py-2 text-ink-600 outline-none transition-[background-color,color] hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900/20 ${
        active ? "bg-stage-0 text-ink-950 shadow-chip" : ""
      }`}
      onClick={() => setExample(value)}
      role="tab"
      type="button"
    >
      <SemanticText
        as="span"
        className="text-inherit"
        role="button-label"
        text={label}
        variant="compact"
      />
    </Button>
  )
}

export const DocsCodeExplorer = () => {
  const example = useAtomValue(docsCodeExampleAtom)

  return (
    <Section id="code-example">
      <Stack className="gap-5">
        <Stack className="gap-2">
          <SemanticText
            as="p"
            className="text-ink-500"
            role="row-label"
            text="Minimal study"
            variant="expanded"
          />
          <SemanticText
            as="h2"
            className="text-ink-950"
            role="section-title"
            text="Optimize an Effectful objective"
            variant="expanded"
          />
          <SemanticText
            as="p"
            className="max-w-[64ch] text-ink-600"
            role="card-summary"
            text="Define a typed search space, choose a seeded sampler, and evaluate the objective with Effect. The result retains the study and trial evidence."
            variant="expanded"
            wrapAuthority="native-browser"
          />
        </Stack>
        <Cluster
          aria-label="Code examples"
          className="w-fit gap-1 rounded-xl border border-stage-200/90 bg-stage-100/68 p-1"
          role="tablist"
        >
          <ExampleTab active={example === "study"} label="Complete study" value="study" />
          <ExampleTab active={example === "objective"} label="Effect objective" value="objective" />
        </Cluster>
        <Section aria-label="Selected code example" role="tabpanel">
          <CodeBlock label={example === "study" ? "study.ts" : "objective.ts"} source={sourceFor(example)} />
        </Section>
      </Stack>
    </Section>
  )
}
