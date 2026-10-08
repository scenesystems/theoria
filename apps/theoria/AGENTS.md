# Theoria application

React 19, Tailwind v4, Base UI, and Effect atoms. Read `package.json` for scripts;
run them here or with `bun run --filter @theoria/theoria-app <script>` at the root.
In an orb, `amp orb services ensure` starts the declared API and frontend services
(ports 3876 and 5175). Deployment instructions live in `DEPLOYMENT.md`.

## Boundaries and state

- `app/contracts/` owns data shared by `app/server/` and `app/web/`; server and web
  do not import each other. Schema owns wire representations, not every local type.
- Server handlers run in both Bun and workerd. Keep host access behind services
  such as `StaticStore`, rather than introducing Bun/Node calls into handlers.
- Browser access belongs in `app/web/platform/`; compose capabilities through
  Layers. Use feature `Atom.runtime`s for services and atoms for domain state and
  subscriptions. See `app/web/atoms/docs-data.ts` and `app/web/atoms/runtime.ts`.
- DOM observations are mount-scoped, not durable app identities. Follow
  `app/web/atoms/element-observation.ts`; release element references and subscriptions on
  unmount rather than retaining them with `keepAlive` or string IDs.

## UI changes

- Reuse `app/web/view/primitives/`, including `SemanticText` and Base UI-backed
  controls. Keep feature-specific composition local; add shared abstractions only
  when they have a reusable responsibility.
- Use existing semantic palette, typography, layout, and motion tokens. Their
  generators live in `app/web/{palette,text,layout}/`; exact lint restrictions live
  in `eslint/effect/design-tokens.mjs` at the repository root. Do not invent palette
  steps or runtime Tailwind classes that the generated CSS does not contain.
- Theme variables own light/dark colors. Participant tones represent reader/brand,
  other people, and programs; packages and statuses do not acquire their own hues.
- `app/contracts/brand.ts` owns brand assets. After changing it, run
  `bun run gen:brand-assets` and `bun run gen:social-assets`; do not hand-edit the
  generated assets.
- Inspect rendered changes at the affected widths and light/dark states. Exercise
  changed controls and keyboard behavior; a successful build is not a UI check.

## Routes and content

- For API routes, update contract schemas, `app/server/router.ts`, and
  `assets.run_worker_first` in `wrangler.jsonc` together. Encode responses through
  the contract envelope and decode them in the owning web client service.
- Cover handlers in `test/server/` and Worker routing in `test/worker/site.test.ts`.
- Keep Markdown/LaTeX parsing in the existing Remark/KaTeX pipeline. Render math
  as accessible MathML with untrusted commands disabled; preserve the CSP.
- New static asset types require the MIME mapping in
  `app/server/config/static-store.ts`. Use the build-output and Worker checks
  documented in `DEPLOYMENT.md` for serving changes.
