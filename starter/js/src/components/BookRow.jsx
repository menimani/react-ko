import { useKoBind } from 'react-ko'

export function BookRow({ book }) {
  const bind = useKoBind(book)

  return (
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
  )
}
