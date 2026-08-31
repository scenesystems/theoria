/**
 * Widget namespace.
 *
 * @since 0.2.0
 * @category namespaces
 */
export * as Widget from "./widget.js"

/**
 * Public operation.
 *
 * @since 0.3.0
 */
export { renamedDoThing as doThing } from "./operations.js"

export * from "./facade.js"

/**
 * Root widget model.
 *
 * @since 0.2.0
 * @category models
 */
export type { WidgetModel } from "./types.js"
