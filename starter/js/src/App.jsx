import { useKoViewModel } from 'react-ko'
import { BookForm } from './components/BookForm'
import { BookList } from './components/BookList'
import { ShelfSummary } from './components/ShelfSummary'
import './App.css'

function App() {
  const vm = useKoViewModel()

  return (
    <main className="bookshelf">
      <header className="hero">
        <p className="eyebrow">A react-ko reference app</p>
        <h1>My Bookshelf</h1>
        <p>React builds the shelves. Knockout keeps every book, filter, and total in sync.</p>
      </header>

      <ShelfSummary viewModel={vm} />

      <div className="workspace">
        <BookForm viewModel={vm} />
        <BookList viewModel={vm} />
      </div>
    </main>
  )
}

export default App
