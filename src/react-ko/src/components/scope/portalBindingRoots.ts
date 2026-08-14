import { DESCENDANT_BINDING_BOUNDARY } from './descendantBindingBoundary'
import { isElementBindingRoot } from './elementBindingRoot'

type ReactFiber = {
  tag?: number
  stateNode?: unknown
  child?: ReactFiber | null
  sibling?: ReactFiber | null
  return?: ReactFiber | null
  alternate?: ReactFiber | null
}

type PortalStateNode = {
  containerInfo?: unknown
}

const HOST_COMPONENT = 5
const HOST_PORTAL = 4

function hostFiber(element: Element): ReactFiber | undefined {
  const key = Object.getOwnPropertyNames(element).find((name) =>
    name.startsWith('__reactFiber$')
  )
  return key === undefined
    ? undefined
    : ((element as unknown as Record<string, unknown>)[key] as ReactFiber)
}

function currentFiber(fiber: ReactFiber): ReactFiber {
  let root = fiber
  while (root.return !== null && root.return !== undefined) {
    root = root.return
  }

  const currentRoot = (root.stateNode as { current?: ReactFiber } | null)?.current
  if (currentRoot === root.alternate && fiber.alternate !== null) {
    return fiber.alternate ?? fiber
  }
  return fiber
}

function isElement(value: unknown): value is HTMLElement {
  if (value === null || typeof value !== 'object') return false
  const node = value as Node
  return node.nodeType === node.ELEMENT_NODE
}

function isNestedBoundary(candidate: ReactFiber) {
  const host = candidate.tag === HOST_COMPONENT
    ? candidate.stateNode
    : undefined
  return (
    isElement(host) &&
    (host.getAttribute('data-bind') === `${DESCENDANT_BINDING_BOUNDARY}: true` ||
      isElementBindingRoot(host))
  )
}

/** Whether a newly mutated portal host node belongs to this binding root. */
export function ownsPortalRoot(
  bindingHost: HTMLElement,
  portalRoot: HTMLElement
) {
  let candidate: ReactFiber | null | undefined = hostFiber(portalRoot)
  let crossedPortal = false
  while (candidate !== null && candidate !== undefined) {
    if (candidate.tag === HOST_PORTAL) {
      crossedPortal = true
    } else if (crossedPortal && candidate.tag === HOST_COMPONENT) {
      if (candidate.stateNode === bindingHost) return true
      if (isNestedBoundary(candidate)) return false
    }
    candidate = candidate.return
  }
  return false
}

/** Returns the containers and top-level host elements of owned portals. */
export function portalBindingTargets(bindingHost: HTMLElement) {
  const fiber = hostFiber(bindingHost)
  /* v8 ignore next -- React-owned binding hosts always carry a fiber tag. */
  if (fiber === undefined) return { containers: [], roots: [] }

  const containers: HTMLElement[] = []
  const seenContainers = new Set<HTMLElement>()
  const roots: HTMLElement[] = []
  const seen = new Set<HTMLElement>([bindingHost])

  // Ownership follows the React tree, so the walk stops at the roots inside this one:
  // their portals are theirs. A root marks itself either as a scope component's
  // boundary or, when it is an element the caller owns, with the binding-root
  // attribute. Missing the second kind hands an inner root's portal to this one.
  function collectPortalContainer(candidate: ReactFiber) {
    const container = (candidate.stateNode as PortalStateNode | null)
      ?.containerInfo
    if (isElement(container) && !seenContainers.has(container)) {
      seenContainers.add(container)
      containers.push(container)
    }
  }

  function collectPortalRoots(first: ReactFiber | null | undefined) {
    let candidate = first
    while (candidate !== null && candidate !== undefined) {
      if (isNestedBoundary(candidate)) {
        candidate = candidate.sibling
        continue
      }

      if (candidate.tag === HOST_COMPONENT && isElement(candidate.stateNode)) {
        const element = candidate.stateNode
        if (!seen.has(element)) {
          seen.add(element)
          roots.push(element)
        }
        visit(candidate.child)
      } else if (candidate.tag === HOST_PORTAL) {
        collectPortalContainer(candidate)
        collectPortalRoots(candidate.child)
      } else {
        collectPortalRoots(candidate.child)
      }
      candidate = candidate.sibling
    }
  }

  function visit(first: ReactFiber | null | undefined) {
    let candidate = first
    while (candidate !== null && candidate !== undefined) {
      if (isNestedBoundary(candidate)) {
        candidate = candidate.sibling
        continue
      }

      if (candidate.tag === HOST_PORTAL) {
        collectPortalContainer(candidate)
        collectPortalRoots(candidate.child)
      } else {
        visit(candidate.child)
      }
      candidate = candidate.sibling
    }
  }

  visit(currentFiber(fiber).child)
  return { containers, roots }
}
