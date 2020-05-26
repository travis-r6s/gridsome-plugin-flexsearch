import FlexSearch from 'flexsearch'
import cjson from 'compressed-json'
import pMap from 'p-map'

export default async function (Vue, options, { isClient, router }) {
  const { flexsearch, chunk = false, compress = false, autoFetch = true, autoSetup = true, searchFields, pathPrefix, siteUrl } = options

  if (isClient) {
    const basePath = pathPrefix && (process.env.NODE_ENV !== 'development' || location.origin === siteUrl) ? `${pathPrefix}/flexsearch` : '/flexsearch'

    // Data fetch functions
    const loadNormalMode = async search => {
      let searchIndex = await fetch(`${basePath}.json`).then(r => r.json())
      if (compress) searchIndex = cjson.decompress(searchIndex)
      search.import(searchIndex, { serialize: false })
    }

    const loadChunkMode = async search => {
      const { index, docs } = await fetch(`${basePath}/manifest.json`).then(r => r.json())
      const fetchData = id => fetch(`${basePath}/${id}.json`).then(r => r.json()).then(j => compress ? cjson.decompress(j) : j)

      const searchIndex = await pMap(index, id => fetchData())
      search.import(searchIndex, { index: true, doc: false, serialize: false })

      let searchDocs = {}
      for await (const id of docs) {
        const data = await fetchData(id)
        searchDocs = { ...searchDocs, ...Object.fromEntries(data) }
      }
      search.import([searchDocs], { index: false, doc: true, serialize: false })
    }

    // Manually setup the Flexsearch instance
    if (!autoSetup) {
      Vue.prototype.$flexsearch = {
        flexsearch: {
          ...flexsearch,
          doc: {
            id: 'id',
            field: searchFields
          }
        },
        basePath,
        loadIndex: loadNormalMode
      }
      return
    }

    // Setup global Flexsearch Instance
    const search = new FlexSearch({
      ...flexsearch,
      doc: {
        id: 'id',
        field: searchFields
      }
    })
    Vue.prototype.$search = search
    Vue.prototype.$searchOptions = { basePath }

    if (!autoFetch) return

    if (typeof autoFetch === 'string' || typeof autoFetch === 'object') {
      let loaded = false
      const pathsToLoad = typeof autoFetch === 'string' ? [autoFetch] : autoFetch
      return router.afterEach(({ path: currentPath }) => {
        if (pathsToLoad.includes(currentPath) && !loaded) {
          loaded = true
          return chunk ? loadChunkMode(search) : loadNormalMode(search)
        }
      })
    } else if (chunk) return loadChunkMode(search)
    else return loadNormalMode(search)
  }
}
