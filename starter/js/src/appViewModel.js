import ko from 'knockout'

export const BOOK_STATUSES = ['want-to-read', 'reading', 'finished']

const STORAGE_KEY = 'react-ko-bookshelf'

const starterBooks = [
  { id: 1, title: 'The Left Hand of Darkness', author: 'Ursula K. Le Guin', status: 'finished', rating: 5 },
  { id: 2, title: 'Kindred', author: 'Octavia E. Butler', status: 'reading', rating: 4 },
  { id: 3, title: 'Piranesi', author: 'Susanna Clarke', status: 'want-to-read', rating: 3 },
]

function isStoredBook(book) {
  return typeof book === 'object'
    && book !== null
    && typeof book.id === 'number'
    && typeof book.title === 'string'
    && typeof book.author === 'string'
    && BOOK_STATUSES.includes(book.status)
    && typeof book.rating === 'number'
    && book.rating >= 1
    && book.rating <= 5
}

function loadBooks() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === null) return starterBooks
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) && parsed.every(isStoredBook) ? parsed : starterBooks
  } catch {
    return starterBooks
  }
}

export class AppViewModel {
  filter = ko.observable('all')
  draftTitle = ko.observable('')
  draftAuthor = ko.observable('')
  draftStatus = ko.observable('want-to-read')
  draftRating = ko.observable('3')
  editingBook = ko.observable(null)

  constructor() {
    const storedBooks = loadBooks()
    this.nextId = Math.max(0, ...storedBooks.map((book) => book.id)) + 1
    this.books = ko.observableArray(storedBooks.map((book) => this.createBook(book)))

    this.filteredBooks = ko.pureComputed(() => {
      const selectedStatus = this.filter()
      return selectedStatus === 'all'
        ? this.books()
        : this.books().filter((book) => book.status() === selectedStatus)
    })

    this.summary = ko.pureComputed(() => {
      const books = this.books()
      const ratingTotal = books.reduce((total, book) => total + book.rating(), 0)
      return {
        total: books.length,
        wantToRead: books.filter((book) => book.status() === 'want-to-read').length,
        reading: books.filter((book) => book.status() === 'reading').length,
        finished: books.filter((book) => book.status() === 'finished').length,
        averageRating: books.length === 0 ? '—' : (ratingTotal / books.length).toFixed(1),
      }
    })

    this.formTitle = ko.pureComputed(() => this.editingBook() ? 'Edit book' : 'Add a book')
    this.submitLabel = ko.pureComputed(() => this.editingBook() ? 'Save changes' : 'Add to shelf')

    ko.computed(() => JSON.stringify(this.books().map((book) => ({
      id: book.id,
      title: book.title(),
      author: book.author(),
      status: book.status(),
      rating: book.rating(),
    })))).subscribe((books) => {
      try {
        localStorage.setItem(STORAGE_KEY, books)
      } catch {
        // The shelf still works when storage is unavailable.
      }
    })
  }

  createBook(stored) {
    const book = {
      id: stored.id,
      title: ko.observable(stored.title),
      author: ko.observable(stored.author),
      status: ko.observable(stored.status),
      rating: ko.observable(stored.rating),
    }
    book.edit = () => this.startEditing(book)
    book.remove = () => this.removeBook(book)
    return book
  }

  saveBook = () => {
    const title = this.draftTitle().trim()
    const author = this.draftAuthor().trim()
    if (!title || !author) return

    const editing = this.editingBook()
    if (editing) {
      editing.title(title)
      editing.author(author)
      editing.status(this.draftStatus())
      editing.rating(Number(this.draftRating()))
    } else {
      this.books.push(this.createBook({
        id: this.nextId++,
        title,
        author,
        status: this.draftStatus(),
        rating: Number(this.draftRating()),
      }))
    }
    this.resetForm()
  }

  startEditing(book) {
    this.editingBook(book)
    this.draftTitle(book.title())
    this.draftAuthor(book.author())
    this.draftStatus(book.status())
    this.draftRating(String(book.rating()))
  }

  cancelEditing = () => this.resetForm()

  removeBook(book) {
    this.books.remove(book)
    if (this.editingBook() === book) this.resetForm()
  }

  resetForm() {
    this.editingBook(null)
    this.draftTitle('')
    this.draftAuthor('')
    this.draftStatus('want-to-read')
    this.draftRating('3')
  }
}
