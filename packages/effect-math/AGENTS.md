# effect-math

- Dense public numerical carriers use `Chunk<number>`. Preserve signed zero,
  non-finite values, precision policies, and documented validation boundaries
  when replacing numerical operations.
- Use the owning namespace for overlapping operations (`Numeric.sqrt`,
  `Complex.sqrt`). Retain conventional mathematical symbols; do not mechanically
  rename coefficients or constants.
- Operation forms have distinct contracts: base functions accept trusted values;
  `Validated` functions decode unknown inputs with excess properties rejected;
  `WithPolicies` functions require the specific Policy services they use.
- `Numeric` owns tolerances and numerical failures; `Distribution` owns densities,
  cumulative functions, and quantiles; `Probability` owns entropy; `Calculus` owns
  complex-step differentiation.
- SciPy fixtures live in `test/fixtures/scipy/`. Load `maintaining-fixtures` before
  changing their generators or expected values. Decode them through
  `test/helpers/fixtures/registry.ts`, not raw JSON imports.
