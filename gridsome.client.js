import FlexSearch from 'flexsearch'

export default async function (Vue, { flexsearch, searchFields }, { isClient, appOptions }) {
  if (isClient) {
    const searchIndex = await fetch('/flexsearch.json').then(r => r.json())
    const search = new FlexSearch({
      ...flexsearch,
      doc: {
        id: 'id',
        field: searchFields
      }
    })
    search.import(searchIndex, { serialize: false })
    Vue.prototype.$search = search
  }
}
