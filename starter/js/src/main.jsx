import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { KnockoutScope } from 'react-ko'
import { AppViewModel } from './appViewModel.js'

const viewModel = new AppViewModel()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <KnockoutScope viewModel={viewModel}>
      <App />
    </KnockoutScope>
  </StrictMode>,
)
