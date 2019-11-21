import FlexSearch from 'flexsearch'
export default function (Vue, options, context) {
  Vue.mixin({
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
      })
      this.$search.import(index, { serialize: false })
    }
  })
  Vue.prototype.$search = new FlexSearch()
}
