import { Schema } from "effect"

const NonEmptyString = Schema.String.pipe(Schema.minLength(1))

export const ConsumerArtifactKind = Schema.Literal(
  "agent-trace",
  "workflow-graph",
  "prompt-set",
  "evaluation-set",
  "model-route",
  "provenance-bundle"
)

export type ConsumerArtifactKind = typeof ConsumerArtifactKind.Type

export const ConsumerArtifactSourceKind = Schema.Literal(
  "hugging-face-dataset",
  "open-agent-trace",
  "workflow-registry"
)

export type ConsumerArtifactSourceKind = typeof ConsumerArtifactSourceKind.Type

export class ConsumerArtifact extends Schema.Class<ConsumerArtifact>("ConsumerArtifact")({
  artifactId: NonEmptyString,
  artifactKind: ConsumerArtifactKind,
  sourceKind: ConsumerArtifactSourceKind,
  sourceLabel: NonEmptyString,
  sourceUrl: NonEmptyString,
  title: NonEmptyString,
  summary: NonEmptyString
}) {
  detail(): string {
    return `${this.artifactKind} · ${this.sourceKind} · ${this.summary}`
  }
}
