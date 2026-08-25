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

      <section className="summary-section" aria-label="Reading summary" aria-live="polite">
        <h2>Reading summary</h2>
        <div className="summary">
          <div><strong data-bind="text: summary().total" /><span>Total books</span></div>
          <div><strong data-bind="text: summary().wantToRead" /><span>Want to read</span></div>
          <div><strong data-bind="text: summary().reading" /><span>Reading</span></div>
          <div><strong data-bind="text: summary().finished" /><span>Finished</span></div>
          <div><strong data-bind="text: summary().averageRating" /><span>Average rating</span></div>
        </div>
      </section>

      <div className="workspace">
        <section className="form-section">
          <h2 data-bind="text: formTitle" />
          <div className="panel form-panel">
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
          </div>
        </section>

        <section className="shelf-section">
          <div className="shelf-heading">
            <h2>Books</h2>
            <div className="filter-chips" role="group" aria-label="Filter by status">
              <button type="button" data-bind="click: function() { filter('all') }, css: { active: filter() === 'all' }, attr: { 'aria-pressed': filter() === 'all' }">All</button>
              <button type="button" data-bind="click: function() { filter('want-to-read') }, css: { active: filter() === 'want-to-read' }, attr: { 'aria-pressed': filter() === 'want-to-read' }">Want to read</button>
              <button type="button" data-bind="click: function() { filter('reading') }, css: { active: filter() === 'reading' }, attr: { 'aria-pressed': filter() === 'reading' }">Reading</button>
              <button type="button" data-bind="click: function() { filter('finished') }, css: { active: filter() === 'finished' }, attr: { 'aria-pressed': filter() === 'finished' }">Finished</button>
            </div>
          </div>

          <div className="panel shelf-panel">
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
                        <span className="status" data-bind="text: status() === 'want-to-read' ? 'Want to read' : status() === 'reading' ? 'Reading' : 'Finished'" />
                        <span className="rating">Rating <span data-bind="text: rating" />/5</span>
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
          </div>
        </section>
      </div>
    </main>
  )
}

export default App
