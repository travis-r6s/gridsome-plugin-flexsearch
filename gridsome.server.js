const FlexSearch = require('flexsearch')
const _chunk = require('lodash.chunk')
const _get = require('lodash.get')
const cjson = require('compressed-json')
const consola = require('consola')
const fs = require('fs')
const pMap = require('p-map')
const path = require('path')
const { v4: uuid } = require('uuid')

const console = consola.create({
  defaults: {
    tag: 'gridsome-plugin-flexsearch'
  }
})

function FlexSearchIndex (api, options) {
  // Setup defaults
  const { searchFields = [], collections = [], flexsearch = {}, chunk = false, compress = false } = options
  const { profile = 'default', ...flexoptions } = flexsearch

  // Create base FlexSearch instance
  const search = new FlexSearch({
    profile,
    ...flexoptions,
    doc: {
      id: 'id',
      field: searchFields
    }
  })

  // Set client options
  const clientOptions = { pathPrefix: api._app.config._pathPrefix, siteUrl: api._app.config.siteUrl, ...options }
  api.setClientOptions(clientOptions)

  // Simple function to get Node from store, and remove internal refs
  function getNode ({ typeName, id }) {
    const node = api._app.store.getNode(typeName, id)
    if (!node) return

    delete node.$loki
    delete node.$uid
    return node
  }

  // Functions to recursively fetch relations, and normalize data
  function parseArray (array, stringify = true) {
    const [firstItem] = array
    if (firstItem && firstItem.typeName) return array.map(node => getNode(node))
    if (!stringify) return array
    // If this is for an index field, we need to stringify it so it can be indexed
    return JSON.stringify(array)
  }

  function parseObject (object, stringify = true) {
    if (object instanceof Array) return parseArray(object, stringify)
    if (object.typeName) return getNode(object)
    return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, value instanceof Object ? parseObject(value) : value]))
  }

  // Function to get collection from store, and transform nodes
  function getStoreCollection (collection) {
    const collectionStore = api._app.store.getCollection(collection.typeName)
    if (!collectionStore) return
    return collectionStore.data().map(node => {
      delete node.$loki
      delete node.$uid
      // Fields that will be indexed, so must be included & flattened etc
      const searchFieldKeys = Array.isArray(searchFields) ? searchFields : Object.keys(searchFields)
      const indexFields = Object.fromEntries(searchFieldKeys.map(key => {
        const value = node[ key ]
        if (!value) return [key, value]
        if (value instanceof Date) return [key, value.toISOString()]
        if (value instanceof Object) return [key, parseObject(value)]
        return [key, value]
      }))

      // The doc fields that will be returned with the search result
      // We can either return just the fields a user has chosen, or return the whole node
      const docFields = collection.fields ? collection.fields.map(field => [field, node[ field ]]) : Object.entries(node)
      // Get any relations
      const doc = Object.fromEntries(docFields.map(([key, value]) => {
        if (!value) return [key, value]
        if (value instanceof Date) return [key, value.toISOString()]
        if (value instanceof Object) return [key, parseObject(value, false)]
        return [key, value]
      }))

      // All other fields used will be added as the node field on the doc
      return {
        id: uuid(),
        index: collection.indexName,
        path: node.path,
        node: doc,
        ...indexFields
      }
    })
  }

  // Function to get collection from GraphQL server (using internal remote schema) and transform nodes
  async function getGraphQLCollection ({ indexName, query, path }) {
    // Query data, throw errors, then get the nodes with the provided path
    const { data, errors } = await api._app.graphql(query)
    if (errors) return console.error(errors[ 0 ])
    const nodes = _get(data, path, [])

    return nodes.map(node => {
      // Fields that will be indexed, so must be included & flattened etc
      const searchFieldKeys = Array.isArray(searchFields) ? searchFields : Object.keys(searchFields)
      const indexFields = Object.fromEntries(searchFieldKeys.map(key => {
        const value = node[ key ]
        if (!value) return [key, value]
        if (value instanceof Date) return [key, value.toISOString()]
        if (value instanceof Object) return [key, parseObject(value)]
        return [key, value]
      }))

      // All other fields used will be added as the node field on the doc
      return {
        id: uuid(),
        index: indexName,
        path: node.path,
        node,
        ...indexFields
      }
    })
  }

  // After the store has been created/updated, start the index import.
  api.onBootstrap(async () => {
    // Map over collections, and either fetch from remote graphql or local store. Then flatten the received arrays.
    const docs = (await pMap(collections, collection => {
      if (collection.query) return getGraphQLCollection(collection)
      return getStoreCollection(collection)
    })).flat()

    // Add to search index
    search.add(docs)
    console.info(`Added ${docs.length} nodes to Search Index`)
  })

  // Setup an endpoint for the dev server
  api.configureServer(app => {
    console.info('Serving search index...')
    if (chunk) {
      const { manifest, chunks } = createManifest()
      app.get('/flexsearch/manifest.json', (req, res) => {
        res.json(manifest)
      })
      app.get('/flexsearch/:chunk', (req, res) => {
        const chunkName = req.params.chunk.replace('.json', '')
        if (!chunk) res.status(404).send(`That chunk can't be found.`)
        res.json(chunks[ chunkName ])
      })
    } else {
      let searchIndex = search.export({ serialize: false })
      if (compress) searchIndex = cjson.compress(searchIndex)
      app.get('/flexsearch.json', (req, res) => {
        res.json(searchIndex)
      })
    }
  })

  // Create the manifest and save to disk on build
  api.afterBuild(async ({ config }) => {
    const outputDir = config.outputDir || config.outDir

    if (chunk) {
      console.info('Creating search index (chunked mode)...')
      const flexsearchDir = path.join(outputDir, 'flexsearch')
      const manifestFilename = path.join(flexsearchDir, 'manifest.json')

      const { manifest, chunks } = createManifest()

      await fs.mkdirSync(flexsearchDir)
      await fs.writeFileSync(manifestFilename, JSON.stringify(manifest))

      for (const [name, data] of Object.entries(chunks)) {
        const chunkFilename = path.join(flexsearchDir, `${name}.json`)
        await fs.writeFileSync(chunkFilename, JSON.stringify(data))
      }

      console.info('Saved search index.')
    } else {
      console.info('Creating search index...')
      const filename = path.join(outputDir, 'flexsearch.json')
      let searchIndex = search.export({ serialize: false })
      if (compress) searchIndex = cjson.compress(searchIndex)
      await fs.writeFileSync(filename, JSON.stringify(searchIndex))
      console.info('Saved search index.')
    }
  })

  // Create a manifest, that declares the index location(s)
  function createManifest () {
    const searchIndex = search.export({ serialize: false, index: true, doc: false })
    const [searchDocs] = search.export({ serialize: false, index: false, doc: true })

    const chunkedIndex = searchIndex.reduce((manifest, index) => {
      const chunk = { id: uuid(), index }
      return {
        ids: [...manifest.ids, chunk.id],
        indexes: {
          ...manifest.indexes,
          [ chunk.id ]: compress ? cjson.compress(chunk.index) : chunk.index
        }
      }
    }, { ids: [], indexes: {} })

    const chunkSize = typeof chunk === 'number' ? chunk : 2000
    const chunkedDocs = _chunk(Object.entries(searchDocs), chunkSize).reduce((manifest, docs) => {
      const chunk = { id: uuid(), docs }

      return {
        ids: [...manifest.ids, chunk.id],
        docs: {
          ...manifest.docs,
          [ chunk.id ]: cjson.compress(chunk.docs)
        }
      }
    }, { ids: [], docs: {} })

    const manifest = {
      hash: uuid(),
      index: chunkedIndex.ids,
      docs: chunkedDocs.ids
    }

    return { manifest, chunks: { ...chunkedDocs.docs, ...chunkedIndex.indexes } }
  }
}

module.exports = FlexSearchIndex

module.exports.defaultOptions = () => ({
  chunk: false,
  compress: false,
  autoFetch: true,
  autoSetup: true,
  flexsearch: { profile: 'default' },
  searchFields: [],
  collections: []
})
