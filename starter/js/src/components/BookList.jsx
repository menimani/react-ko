import { KoForeach, useKoBind } from 'react-ko'
import { BookRow } from './BookRow'
import { StatusFilter } from './StatusFilter'

export function BookList({ viewModel }) {
  const bind = useKoBind(viewModel)

  return (
    <section {...bind} className="shelf-section">
      <div className="shelf-heading">
        <h2>Books</h2>
        <StatusFilter viewModel={viewModel} />
      </div>

      <div className="panel shelf-panel">
        <p className="empty-state" data-bind="visible: filteredBooks().length === 0">
          No books match this shelf yet.
        </p>
        <ul className="book-list">
          <KoForeach items={viewModel.filteredBooks} itemKey={(book) => book.id}>
            {(book) => <BookRow book={book} />}
          </KoForeach>
        </ul>
      </div>
    </section>
  )
}
