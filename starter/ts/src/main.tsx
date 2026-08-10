import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { RootKnockoutProvider } from 'react-ko'
import { AppViewModel, AppViewModelContext } from './appViewModel.ts'

const viewModel = new AppViewModel()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppViewModelContext.Provider value={viewModel}>
      <RootKnockoutProvider viewModel={viewModel}>
        <App />
      </RootKnockoutProvider>
    </AppViewModelContext.Provider>
  </StrictMode>,
)
