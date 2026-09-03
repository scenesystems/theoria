import * as Arr from "effect/Array"

import type { ApiMember } from "@theoria/docs-model"
import { CodeBlock } from "../primitives/CodeBlock.js"
import { Cluster, Section, Stack } from "../primitives/Layout.js"
import { ExternalLink } from "../primitives/Link.js"
import { SemanticContent } from "../primitives/SemanticContent.js"
import { SemanticText } from "../primitives/SemanticText.js"
import { ApiDocumentationView } from "./ApiDocumentationView.js"
import { ApiSignatureView } from "./ApiSignatureView.js"

export const ApiMemberView = ({ member }: { readonly member: ApiMember }) => (
  <Section className="scroll-mt-28 border-l border-stage-300/80 pl-4 sm:pl-5" id={member.anchor}>
    <Stack className="gap-5">
      <Cluster className="gap-2">
        <SemanticContent as="h4" className="text-ink-950" role="selection-title">{member.name}</SemanticContent>
        <SemanticText as="span" className="text-ink-400" role="row-label" text={member.kind} />
        {member.inherited
          ? <SemanticText as="span" className="text-ink-400" role="row-label" text="inherited" />
          : null}
      </Cluster>
      {member.signatures.length === 0
        ? (
          <Stack className="gap-4">
            <ApiDocumentationView docs={member.docs} />
            <CodeBlock label="Type" source={member.declaration} />
            <ExternalLink
              className="w-fit font-body text-sm font-medium text-ink-600 underline decoration-stage-400 underline-offset-4 hover:text-ink-950"
              href={member.sourceUrl}
            >
              Source
            </ExternalLink>
          </Stack>
        )
        : (
          <Stack className="gap-8">
            {Arr.map(
              member.signatures,
              (signature, index) => (
                <ApiSignatureView
                  headingAs="h5"
                  index={index}
                  key={`${signature.kind}:${String(index)}`}
                  signature={signature}
                  total={member.signatures.length}
                />
              )
            )}
          </Stack>
        )}
    </Stack>
  </Section>
)
