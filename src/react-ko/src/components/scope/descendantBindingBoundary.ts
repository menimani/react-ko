import ko from 'knockout'

// Every independently bound tree carries this binding on its outer element so
// an ancestor binding pass stops before reaching DOM the descendant already
// bound with its own ko.applyBindings call.
export const DESCENDANT_BINDING_BOUNDARY = 'reactKoScopeBoundary'

/* v8 ignore next -- the module registers its handler once per process */
if (ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY] === undefined) {
  ko.bindingHandlers[DESCENDANT_BINDING_BOUNDARY] = {
    init: () => ({ controlsDescendantBindings: true })
  }
}
