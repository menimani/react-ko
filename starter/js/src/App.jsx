import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { KoScope } from 'react-ko'
import ko from 'knockout'
import { KoText } from './components/KoText'
import { TodoForm } from './components/TodoForm'

function App() {
  function ViewModel() {
    this.count = ko.observable(0)
    this.color = ko.computed(() => this.count() % 2 === 0 ? 'green' : 'red')
    this.increment = () => this.count(this.count() + 1)
  }
  const vm = new ViewModel()

  return (
    <KoScope viewModel={vm}>
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
    </KoScope>
  )
}

export default App
