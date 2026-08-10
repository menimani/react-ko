import ko from 'knockout'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'

const REACT_UNSAFE_BINDINGS = new Set(['if', 'ifnot', 'foreach', 'template', 'with'])

function bindingNames(element: Element): Set<string> {
  const source = element.getAttribute('data-bind')
  if (source === null) {
    return new Set()
  }

  return new Set(
    ko.expressionRewriting
      .parseObjectLiteral(source)
      .flatMap(({ key }) => (key === undefined ? [] : [key]))
  )
}

/**
 * Rejects Knockout structural bindings before their init handlers can clone
 * or remove descendant nodes owned by React. Descendant scopes validate their
 * own trees, so an ancestor must stop scanning at their binding boundaries.
 */
function assertNoReactUnsafeBindings(root: HTMLElement) {
  function visit(element: Element) {
    const names = bindingNames(element)
    const unsafeBinding = [...names].find((name) => REACT_UNSAFE_BINDINGS.has(name))

    if (unsafeBinding !== undefined) {
      throw new Error(
        `react-ko cannot apply the Knockout "${unsafeBinding}" binding because it controls React-owned child nodes. ` +
          'Use KoIf, KoIfNot, KoForeach, or KoWith instead.'
      )
    }

    if (element !== root && names.has(DESCENDANT_BINDING_BOUNDARY)) {
      return
    }

    for (const child of element.children) {
      visit(child)
    }
  }

  visit(root)
}

/**
 * Applies a binding pass without leaving subscriptions behind when a later
 * binding on the same tree throws before React can register effect cleanup.
 */
export function applyBindingsSafely(viewModel: unknown, node: HTMLElement) {
  assertNoReactUnsafeBindings(node)

  try {
    ko.applyBindings(viewModel, node)
  } catch (error) {
    try {
      ko.cleanNode(node)
    } finally {
      // Preserve the binding error even if cleanup itself fails.
      throw error
    }
  }
}
