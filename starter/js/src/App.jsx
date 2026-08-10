import reactLogo from './assets/react.svg'
import viteLogo from '/vite.svg'
import './App.css'
import { AppViewModelContext } from './appViewModel'
import { KoText, KoTextHook } from './components/KoText'
import { TodoForm } from './components/TodoForm'

function App() {
  const vm = AppViewModelContext.useAppViewModel()

  return (
    <>
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
          count via useKoValue: <KoTextHook text={vm.count} color={vm.color} />
        </p>
        <p>
          Edit <code>src/App.jsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
      <TodoForm />
    </>
  )
}

export default App
