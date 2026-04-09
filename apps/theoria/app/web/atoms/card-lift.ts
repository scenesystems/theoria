import { Spring } from "./spring.js"

/**
 * Spring animation for card hover lift on the home page.
 *
 * @since 0.1.0
 */
export const cardLiftSpring = Spring.make({
  stiffness: 0.12,
  damping: 0.72
})
