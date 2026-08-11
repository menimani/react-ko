import ko from 'knockout'
import { applyBindingsSafely } from '../../src/components/scope/applyBindingsSafely'
import {
  observeBindingDescendants,
  prepareBindingDescendants,
} from '../../src/components/scope/observeBindingDescendants'

export function retireOptionsBinding() {
  const root = document.createElement('div')
  const select = document.createElement('select')
  select.setAttribute('data-bind', 'options: choices')
  root.appendChild(select)

  const viewModel = { choices: ko.observableArray(['First', 'Second']) }
  const bindingStates = prepareBindingDescendants(root)
  applyBindingsSafely(viewModel, root)
  const boundOptionCount = select.options.length
  let error: unknown
  const stopObserving = observeBindingDescendants(
    viewModel,
    root,
    (caught) => {
      error = caught
    },
    bindingStates
  )

  select.removeAttribute('data-bind')
  const result = {
    boundOptionCount,
    retiredOptionCount: select.options.length,
    error: error instanceof Error ? error.message : error,
  }

  stopObserving()
  ko.cleanNode(root)
  return result
}
