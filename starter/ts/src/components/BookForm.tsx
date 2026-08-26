import { useKoBind } from 'react-ko'
import type { AppViewModel } from '../appViewModel'

type BookFormProps = {
  viewModel: AppViewModel
}

export function BookForm({ viewModel }: BookFormProps) {
  const bind = useKoBind(viewModel)

  return (
    <section {...bind} className="form-section">
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
  )
}
