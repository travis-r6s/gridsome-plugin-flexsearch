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
  }
}
