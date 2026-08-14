import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { useKoBind } from 'react-ko'
import { AppViewModel, AppViewModelContext } from './appViewModel.js'

const viewModel = new AppViewModel()

// The element the bindings live on is this app's own. `useKoBind` adds nothing to the
// DOM: it hands this <div> to Knockout, and every `data-bind` inside it is applied
// against the ViewModel.
function KnockoutRoot({ children }) {
  const bind = useKoBind(viewModel)
  return <div {...bind}>{children}</div>
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AppViewModelContext.Provider value={viewModel}>
      <KnockoutRoot>
        <App />
      </KnockoutRoot>
    </AppViewModelContext.Provider>
  </StrictMode>,
)
