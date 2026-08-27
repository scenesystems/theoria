import { GitHubMark } from "./BrandMarks.js"
import { chromeHeaderGlyphClassName } from "./ChromeIconButton.js"
import { headerChromeButtonClassName } from "./HeaderChrome.js"
import { ExternalLink } from "./Link.js"
import { SemanticText } from "./SemanticText.js"

const theoriaRepoUrl = "https://github.com/scenesystems/theoria"

const gitHubStarButtonClassName = headerChromeButtonClassName({
  active: false,
  className: "w-auto whitespace-nowrap px-3 sm:px-4"
})

export const GitHubStarButton = () => (
  <ExternalLink
    aria-label="Star Scene Systems Theoria on GitHub"
    className={gitHubStarButtonClassName}
    href={theoriaRepoUrl}
  >
    <GitHubMark className={chromeHeaderGlyphClassName} />
    <SemanticText
      as="span"
      className="hidden whitespace-nowrap sm:inline"
      role="button-label"
      text="Star on GitHub"
      variant="expanded"
    />
  </ExternalLink>
)
