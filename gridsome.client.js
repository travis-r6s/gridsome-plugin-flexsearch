import FlexSearch from 'flexsearch'

export default async function (Vue, options, { isClient, appOptions }) {
  if (isClient) {
    const { searchFields, index } = await fetch('/flexsearch.json').then(r => r.json())
    const search = new FlexSearch({
      tokenize: 'strict',
      depth: 3,
      workers: 2,
      doc: {
        id: 'id',
        field: searchFields
      }
    })
    search.import(index, { serialize: false })
    Vue.prototype.$search = search
  }
}
