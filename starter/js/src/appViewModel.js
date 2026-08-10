import ko from 'knockout'
import { createAppViewModelContext } from 'react-ko'

export class AppViewModel {
  count = ko.observable(0)
  color = ko.pureComputed(() => this.count() % 2 === 0 ? 'green' : 'red')
  increment = () => this.count(this.count() + 1)
}

export const AppViewModelContext = createAppViewModelContext()
