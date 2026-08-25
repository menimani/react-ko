import { useKoBind } from 'react-ko'

export function StatusFilter({ viewModel }) {
  const bind = useKoBind(viewModel)

  return (
    <div {...bind} className="filter-chips" role="group" aria-label="Filter by status">
      <button type="button" data-bind="click: function() { filter('all') }, css: { active: filter() === 'all' }, attr: { 'aria-pressed': filter() === 'all' }">All</button>
      <button type="button" data-bind="click: function() { filter('want-to-read') }, css: { active: filter() === 'want-to-read' }, attr: { 'aria-pressed': filter() === 'want-to-read' }">Want to read</button>
      <button type="button" data-bind="click: function() { filter('reading') }, css: { active: filter() === 'reading' }, attr: { 'aria-pressed': filter() === 'reading' }">Reading</button>
      <button type="button" data-bind="click: function() { filter('finished') }, css: { active: filter() === 'finished' }, attr: { 'aria-pressed': filter() === 'finished' }">Finished</button>
    </div>
  )
}
