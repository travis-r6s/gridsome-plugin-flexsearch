import FlexSearch from 'flexsearch'

export default async function (Vue, { flexsearch, searchFields, pathPrefix }, { isClient }) {
  if (isClient) {
    const indexPath = pathPrefix ? `${pathPrefix}/flexsearch.json` : '/flexsearch.json'
    const searchIndex = await fetch(indexPath).then(r => r.json())
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
