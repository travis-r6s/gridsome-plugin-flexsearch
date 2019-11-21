import FlexSearch from 'flexsearch'

export default {
  data: () => ({
    searchIndex: null,
    searchTerm: ''
  }),
  computed: {
    searchResults () {
      const searchTerm = this.searchTerm
      if (!this.searchIndex || searchTerm.length < 3) return []
      return this.searchIndex.search({ query: searchTerm, limit: 5, depth: 5 })
    }
  },
  watch: {
    $route (to, from) {
      this.searchTerm = ''
    }
  },
  async mounted () {
    const search = new FlexSearch()
    const { searchFields, index } = await fetch('/search.json').then(r => r.json())
    search.init({
      tokenize: 'strict',
      depth: 3,
      workers: 2,
      doc: {
        id: 'id',
        field: searchFields
      }
    } )
    search.import( index, { serialize: false } )
    this.searchIndex = search
  }
}
