import ko from 'knockout'

const REACT_KO_BINDING_HANDLER = Symbol.for('react-ko.bindingHandler')

type OwnedBindingHandler = ko.BindingHandler & Record<PropertyKey, unknown>

/**
 * Whether the handler registered under this name is the one this library installed.
 * Asked of the scope boundary's own binding before retiring it, which is a question
 * only something outside the library can raise: the boundary element and its
 * `data-bind` are written by the scope and by nothing else.
 */
/* v8 ignore start -- reachable only if a consumer rewrites the scope boundary. */
export function hasReactKoBindingHandler(bindingName: string) {
  const handler = ko.bindingHandlers[bindingName] as
    | OwnedBindingHandler
    | undefined
  return handler?.[REACT_KO_BINDING_HANDLER] === bindingName
}
/* v8 ignore stop */

/** Registers a binding handler without mistaking a consumer's handler for ours. */
export function registerReactKoBindingHandler<T extends ko.BindingHandler>(
  bindingName: string,
  createHandler: () => T,
): T {
  const registeredHandler = ko.bindingHandlers[bindingName] as
    | OwnedBindingHandler
    | undefined

  if (registeredHandler !== undefined) {
    if (registeredHandler[REACT_KO_BINDING_HANDLER] !== bindingName) {
      throw new Error(
        `react-ko cannot register the "${bindingName}" Knockout binding because ` +
          'that name is already registered by another handler.',
      )
    }

    return registeredHandler as T
  }

  const handler = createHandler() as T & OwnedBindingHandler
  Object.defineProperty(handler, REACT_KO_BINDING_HANDLER, {
    value: bindingName,
  })
  ko.bindingHandlers[bindingName] = handler
  return handler
}
