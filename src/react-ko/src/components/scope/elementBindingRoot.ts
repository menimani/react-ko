export const ELEMENT_BINDING_ROOT_ATTRIBUTE = 'data-react-ko-scope'

export function isElementBindingRoot(element: Element) {
  return element.hasAttribute(ELEMENT_BINDING_ROOT_ATTRIBUTE)
}
