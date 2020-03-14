import FlexSearch from 'flexsearch'

export default async function (Vue, { flexsearch, chunk = false, searchFields, pathPrefix, siteUrl }, { isClient }) {
  if (isClient) {
    const basePath = pathPrefix && (process.env.NODE_ENV !== 'development' || location.origin === siteUrl) ? `${pathPrefix}/flexsearch` : '/flexsearch'

    // Setup global Flexsearch Instance
    const search = new FlexSearch({
      ...flexsearch,
      doc: {
        id: 'id',
        field: searchFields
      }
    })
    Vue.prototype.$search = search

    if (!chunk) {
      const searchIndex = await fetch(`${basePath}.json`).then(r => r.json())
      console.log(searchIndex)
      search.import(searchIndex, { serialize: false })
    } else {
      const { index, docs } = await fetch(`${basePath}/manifest.json`).then(r => r.json())

      const fetchData = id => fetch(`${basePath}/${id}.json`).then(r => r.json())

      const indexPromises = index.map(id => fetchData(id))

      const searchIndex = await Promise.all(indexPromises)
      search.import(searchIndex, { index: true, doc: false, serialize: false })

      let searchDocs = {}
      for await (const id of docs) {
        const data = await fetchData(id)
        searchDocs = { ...searchDocs, ...Object.fromEntries(data) }
      }
      search.import([searchDocs], { index: false, doc: true, serialize: false })
    }
  }
}
