import { useState } from 'react'
import { KnockoutScope, KoForeach, KoIf, KoIfNot, KoWith, useKoValue } from 'react-ko'
import ko from 'knockout'

import styles from '../css/TodoForm.module.css'

export function TodoForm() {
  function ViewModel() {
    this.input = ko.observable('')
    this.list = ko.observableArray([])
    this.selectedTodo = ko.observable(null)
    this.nextId = 1

    this.add = () => {
      const title = this.input().trim()
      if (title) {
        this.list.push({
          id: this.nextId++,
          title: ko.observable(title),
          done: ko.observable(false),
        })
        this.input('')
      }
    }

    this.remove = (todo) => {
      this.list.remove(todo)
      if (this.selectedTodo() === todo) {
        this.selectedTodo(null)
      }
    }
  }

  const [vm] = useState(() => new ViewModel())
  const itemCount = useKoValue(vm.list).length

  return (
    <KnockoutScope viewModel={vm}>
      <div className={styles.formContainer}>
        <h2>Todo list</h2>
        <form data-bind="submit: add">
          <input
            className={styles.inputField}
            data-bind="value: input, valueUpdate: 'input'"
            placeholder="Add item"
          />
          <button className={styles.addButton} type="submit">Add</button>
        </form>

        <p>{itemCount} {itemCount === 1 ? 'item' : 'items'} (rendered by React)</p>

        <KoIfNot condition={itemCount > 0}>
          <p>Add your first todo.</p>
        </KoIfNot>
        <KoIf condition={itemCount > 0}>
          <ul className={styles.list}>
            <KoForeach items={vm.list} itemKey={(todo) => todo.id}>
              {(todo, index) => (
                <li className={styles.item}>
                  <span>{index + 1}. </span>
                  <input type="checkbox" data-bind="checked: done" />
                  <span data-bind="text: title, css: { completed: done }" />
                  <button type="button" onClick={() => vm.selectedTodo(todo)}>Details</button>
                  <button type="button" onClick={() => vm.remove(todo)}>Remove</button>
                </li>
              )}
            </KoForeach>
          </ul>
        </KoIf>

        <KoWith value={vm.selectedTodo}>
          {(todo) => (
            <aside className={styles.details}>
              <h3>Selected todo</h3>
              <input data-bind="value: title, valueUpdate: 'input'" />
              <button type="button" onClick={() => vm.selectedTodo(null)}>Close</button>
              <p>Todo #{todo.id} is bound in its own Knockout scope.</p>
            </aside>
          )}
        </KoWith>
      </div>
    </KnockoutScope>
  )
}
