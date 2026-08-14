export const ELEMENT_BINDING_ROOT_ATTRIBUTE = 'data-react-ko-scope'

/** An empty marker belongs to a disabled useKoBind host, not a binding root. */
export function isElementBindingRoot(element: Element) {
  const id = element.getAttribute(ELEMENT_BINDING_ROOT_ATTRIBUTE)
  return id !== null && id !== ''
}
