import ko from 'knockout'

export class AppViewModel {
  count: ko.Observable<number> = ko.observable(0)
  color: ko.PureComputed<string> = ko.pureComputed<string>(() =>
    this.count() % 2 === 0 ? 'green' : 'red',
  )
  increment = () => this.count(this.count() + 1)
}
