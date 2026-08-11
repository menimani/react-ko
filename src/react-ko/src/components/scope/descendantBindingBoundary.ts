import ko from 'knockout'
import { registerReactKoBindingHandler } from './bindingHandlerOwnership'

// Every independently bound tree carries this binding on its outer element so
// an ancestor binding pass stops before reaching DOM the descendant already
// bound with its own ko.applyBindings call.
export const DESCENDANT_BINDING_BOUNDARY = 'reactKoScopeBoundary'

export function ensureDescendantBindingBoundary() {
  const handler = registerReactKoBindingHandler(
    DESCENDANT_BINDING_BOUNDARY,
    () => ({
      init: () => ({ controlsDescendantBindings: true }),
    })
  )
  ko.virtualElements.allowedBindings[DESCENDANT_BINDING_BOUNDARY] = true
  return handler
}
