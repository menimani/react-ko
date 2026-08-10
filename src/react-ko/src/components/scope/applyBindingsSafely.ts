import ko from 'knockout'
import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'

const REACT_UNSAFE_BINDINGS = new Set(['if', 'ifnot', 'foreach', 'template', 'with'])
const REACT_CHILD_UNSAFE_BINDINGS = new Set(['text', 'html', 'component', 'options'])

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

function hasReactOwnedChildren(element: Element): boolean {
  if (!element.hasChildNodes()) {
    return false
  }

  const reactPropsKey = Object.getOwnPropertyNames(element).find((key) =>
    key.startsWith('__reactProps$')
  )
  if (reactPropsKey === undefined) {
    // applyBindingsSafely also accepts DOM assembled outside React. Treat its
    // existing children conservatively because their ownership is unknown.
    return true
  }

  const reactProps = (element as unknown as Record<string, unknown>)[reactPropsKey] as
    | { children?: unknown; dangerouslySetInnerHTML?: unknown }
    | undefined

  return (
    (reactProps?.children !== undefined &&
      reactProps.children !== null &&
      reactProps.children !== false &&
      reactProps.children !== true) ||
    reactProps?.dangerouslySetInnerHTML !== undefined
  )
}

/**
 * Rejects Knockout bindings that can clone, replace, or remove descendant
 * nodes owned by React. Descendant scopes validate their own trees, so an
 * ancestor must stop scanning at their binding boundaries.
 */
function assertNoReactUnsafeBindings(root: HTMLElement) {
  function visit(element: Element) {
    const names = bindingNames(element)
    const unsafeBinding = [...names].find(
      (name) =>
        REACT_UNSAFE_BINDINGS.has(name) ||
        (hasReactOwnedChildren(element) && REACT_CHILD_UNSAFE_BINDINGS.has(name))
    )

    if (unsafeBinding !== undefined) {
      const advice = REACT_UNSAFE_BINDINGS.has(unsafeBinding)
        ? 'Use KoIf, KoIfNot, KoForeach, or KoWith instead.'
        : 'Leave the bound element empty so Knockout can own its contents.'

      throw new Error(
        `react-ko cannot apply the Knockout "${unsafeBinding}" binding because it controls React-owned child nodes. ` +
          advice
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
