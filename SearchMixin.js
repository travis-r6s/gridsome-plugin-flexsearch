import FlexSearch from 'flexsearch'

export default {
  data: () => ({
    searchTerm: ''
  }),
  computed: {
    searchResults () {
      const searchTerm = this.searchTerm
      if (searchTerm.length < 3) return []
      return this.$search.search({ query: searchTerm, limit: 5, depth: 5 })
    }
  },
  watch: {
    $route (to, from) {
      this.searchTerm = ''
    }
  },
  async mounted () {
    const { searchFields, index } = await fetch('/search.json').then(r => r.json())
    this.$search.init({
      tokenize: 'strict',
      depth: 3,
      workers: 2,
      doc: {
        id: 'id',
        field: searchFields
      }
  } )
    this.$search.import( index, { serialize: false } )
  }
}
