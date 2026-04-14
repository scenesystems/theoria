import type { PackageDocsPageModel } from "../../../contracts/presentation/package-docs.js"
import { Toolbar } from "../../ui/components/surface/Toolbar.js"
import { Box } from "../../ui/structure/Box.js"
import { Link } from "../../ui/structure/Link.js"
import { SemanticText } from "../../ui/structure/SemanticText.js"
import { Stack } from "../../ui/structure/Stack.js"

const docsLink = ({
  external,
  href,
  label
}: PackageDocsPageModel["links"][number]) => (
  <Link
    className="inline-flex items-center text-ink-500 hover:text-ink-900"
    href={href}
    key={label}
    rel={external ? "noopener noreferrer" : undefined}
    target={external ? "_blank" : undefined}
    tone="inherit"
  >
    <SemanticText as="span" className="text-inherit" role="body-sm">{label}</SemanticText>
  </Link>
)

export const PackageDocsOverview = ({ model }: { readonly model: PackageDocsPageModel }) => {
  return (
    <Box>
      <Box className="grid max-w-[50rem] gap-2.5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-x-6">
        <Stack className="gap-2">
          <SemanticText as="h1" className="text-ink-900" role="display">
            {model.title}
          </SemanticText>
          <SemanticText as="p" className="text-ink-600" role="body">
            {model.description}
          </SemanticText>
        </Stack>

        <Toolbar.Root className="gap-2 self-start border-none bg-transparent px-0 py-0 shadow-none backdrop-blur-none lg:justify-self-end">
          <Toolbar.Group>
            <SemanticText as="span" className="text-ink-500" role="body-sm">
              {`v${model.version}`}
            </SemanticText>
          </Toolbar.Group>
          {model.links.map((link) => (
            <Toolbar.Group key={link.label}>
              <Toolbar.Separator className="bg-stage-200" />
              {docsLink(link)}
            </Toolbar.Group>
          ))}
        </Toolbar.Root>
      </Box>
    </Box>
  )
}
