import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { KnockoutScope } from 'react-ko'
import ko from 'knockout'
import { useState } from 'react'
import { KoText } from './components/KoText'
import { TodoForm } from './components/TodoForm'

function App() {
  class ViewModel {
    count: ko.Observable<number> = ko.observable<number>(0)
    color: ko.PureComputed<string> = ko.pureComputed<string>(() => this.count() % 2 === 0 ? 'green' : 'red')
    increment: () => void = () => this.count(this.count() + 1)
  }
  const [vm] = useState(() => new ViewModel())

  return (
    <KnockoutScope viewModel={vm}>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React</h1>
      <div className="card">
        <button data-bind="click: increment">
          count is <KoText text={vm.count} color={vm.color} />
        </button>
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <TodoForm />
    </KnockoutScope>
  )
}

export default App
