import { createContext, useContext } from 'react'
import ko from 'knockout'

export class AppViewModel {
  count = ko.observable(0)
  color = ko.pureComputed(() => this.count() % 2 === 0 ? 'green' : 'red')
  increment = () => this.count(this.count() + 1)
}

// Reaching the ViewModel from anywhere in the tree is plain React, so it is written
// here rather than taken from react-ko: a context, and a hook that refuses to guess.
const Context = createContext(null)

export const AppViewModelContext = {
  Provider: Context.Provider,
  useAppViewModel() {
    const viewModel = useContext(Context)
    if (viewModel === null) {
      throw new Error('useAppViewModel must be used within its Provider.')
    }
    return viewModel
  },
}
