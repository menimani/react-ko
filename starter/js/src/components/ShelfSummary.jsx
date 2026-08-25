import { useKoBind } from 'react-ko'

export function ShelfSummary({ viewModel }) {
  const bind = useKoBind(viewModel)

  return (
    <section {...bind} className="summary-section" aria-label="Reading summary" aria-live="polite">
      <h2>Reading summary</h2>
      <div className="summary">
        <div><strong data-bind="text: summary().total" /><span>Total books</span></div>
        <div><strong data-bind="text: summary().wantToRead" /><span>Want to read</span></div>
        <div><strong data-bind="text: summary().reading" /><span>Reading</span></div>
        <div><strong data-bind="text: summary().finished" /><span>Finished</span></div>
        <div><strong data-bind="text: summary().averageRating" /><span>Average rating</span></div>
      </div>
    </section>
  )
}
