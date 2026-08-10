import { KoIf, KoForeach, KoScope, KoIfNot } from 'react-ko'
import ko from 'knockout'

import styles from '../css/TodoForm.module.css'

export const TodoForm = () => {
  class ViewModel {
    input: ko.Observable<string> = ko.observable<string>('')
    list: ko.ObservableArray<string> = ko.observableArray<string>([])
    hasItems: ko.Computed<boolean> = ko.computed<boolean>(() => this.list().length > 0)
    add: () => void = () => {
      const value = this.input().trim()
      if (value) {
        this.list.push(value)
        this.input('')
      }
    }
}
  const vm = new ViewModel()

  return (
    <KoScope viewModel={vm}>
      <div className={styles.formContainer}>
        <input className={styles.inputField} data-bind="value: input" placeholder="Add item" />
        <button className={styles.addButton} data-bind="click: add">Add</button>

        <KoIfNot condition={vm.hasItems}>
          <p>No items</p>
        </KoIfNot>
        <KoIf condition={vm.hasItems}>
          <ul className={styles.list}>
            <KoForeach items={vm.list}>
              {(item) => <li className={styles.item}>{item}</li>}
            </KoForeach>
          </ul>
        </KoIf>
      </div>
    </KoScope>
  )
}
