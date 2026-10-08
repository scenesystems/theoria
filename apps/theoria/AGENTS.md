# Application work

- Shared data contracts connect server and browser code; neither side imports the
  other's implementation. Keep host capabilities behind Effect services so
  application logic remains independent of the runtime.
- Use Effect atoms for domain state and subscriptions. Match state lifetime to
  its source: durable preferences may outlive a view; DOM observations must
  release their elements and subscriptions when the view unmounts.
- Reuse the design system's semantic tokens and accessible primitives. Keep
  feature-specific composition local; a one-off layout does not require a new
  shared abstraction. Change generated assets through their owning generator.
- Verify UI changes in rendered states, including affected themes, widths, and
  keyboard interactions. For serving changes, test the deployed runtime's routing
  and security behavior as well as the development handler.
- Read `package.json` for scripts and `DEPLOYMENT.md` for serving and deployment.
  In an orb, `amp orb services ensure` uses the checked-in service configuration.
