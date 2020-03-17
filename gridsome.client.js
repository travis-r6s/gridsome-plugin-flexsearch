import FlexSearch from 'flexsearch'

export default async function (Vue, options, { isClient, router, ...app }) {
  const { flexsearch, chunk = false, autoFetch = true, searchFields, pathPrefix, siteUrl } = options
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

    const loadNormalMode = async () => {
      const searchIndex = await fetch(`${basePath}.json`).then(r => r.json())
      search.import(searchIndex, { serialize: false })
    }

    const loadChunkMode = async () => {
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

    if (!autoFetch) return

    if (typeof autoFetch === 'string' || typeof autoFetch === 'object') {
      let loaded = false
      const pathsToLoad = typeof autoFetch === 'string' ? [autoFetch] : autoFetch
      return router.afterEach(({ path: currentPath }) => {
        if (pathsToLoad.includes(currentPath) && !loaded) {
          loaded = true
          return chunk ? loadChunkMode() : loadNormalMode()
        }
      })
    } else if (chunk) return loadChunkMode()
    else return loadNormalMode()
  }
}
