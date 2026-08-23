import { KoForeach, useKoViewModel } from 'react-ko'
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

      <section className="summary" aria-label="Reading summary" aria-live="polite">
        <div><strong data-bind="text: summary().total" /><span>Total books</span></div>
        <div><strong data-bind="text: summary().wantToRead" /><span>Want to read</span></div>
        <div><strong data-bind="text: summary().reading" /><span>Reading</span></div>
        <div><strong data-bind="text: summary().finished" /><span>Finished</span></div>
        <div><strong data-bind="text: summary().averageRating" /><span>Average rating</span></div>
      </section>

      <div className="workspace">
        <section className="panel form-panel">
          <h2 data-bind="text: formTitle" />
          <form data-bind="submit: saveBook">
            <label>
              Title
              <input data-bind="value: draftTitle, valueUpdate: 'input'" required placeholder="Book title" />
            </label>
            <label>
              Author
              <input data-bind="value: draftAuthor, valueUpdate: 'input'" required placeholder="Author name" />
            </label>
            <div className="form-row">
              <label>
                Status
                <select data-bind="value: draftStatus" aria-label="Status">
                  <option value="want-to-read">Want to read</option>
                  <option value="reading">Reading</option>
                  <option value="finished">Finished</option>
                </select>
              </label>
              <label>
                Rating
                <select data-bind="value: draftRating" aria-label="Rating">
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                </select>
              </label>
            </div>
            <div className="form-actions">
              <button className="primary" type="submit" data-bind="text: submitLabel" />
              <button type="button" data-bind="click: cancelEditing, visible: editingBook">Cancel</button>
            </div>
          </form>
        </section>

        <section className="panel shelf-panel">
          <div className="shelf-heading">
            <div>
              <p className="eyebrow">Your collection</p>
              <h2>Books</h2>
            </div>
            <label className="filter">
              Show
              <select data-bind="value: filter" aria-label="Filter by status">
                <option value="all">All books</option>
                <option value="want-to-read">Want to read</option>
                <option value="reading">Reading</option>
                <option value="finished">Finished</option>
              </select>
            </label>
          </div>

          <p className="empty-state" data-bind="visible: filteredBooks().length === 0">
            No books match this shelf yet.
          </p>
          <ul className="book-list">
            <KoForeach items={vm.filteredBooks} itemKey={(book) => book.id}>
              {(_book, _index, bind) => (
                <li {...bind} className="book-card" data-bind="attr: { 'data-status': status }">
                  <div className="book-copy">
                    <h3 data-bind="text: title" />
                    <p>by <span data-bind="text: author" /></p>
                    <div className="book-meta">
                      <span className="status" data-bind="text: status" />
                      <span>Rating <span data-bind="text: rating" />/5</span>
                    </div>
                  </div>
                  <div className="book-actions">
                    <button type="button" data-bind="click: edit">Edit</button>
                    <button type="button" className="danger" data-bind="click: remove">Remove</button>
                  </div>
                </li>
              )}
            </KoForeach>
          </ul>
        </section>
      </div>
    </main>
  )
}

export default App
