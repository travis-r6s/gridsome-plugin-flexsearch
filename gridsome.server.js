const FlexSearch = require('flexsearch')
const _chunk = require('lodash.chunk')
const cjson = require('compressed-json')
const consola = require('consola')
const fs = require('fs')
const pMap = require('p-map')
const path = require('path')
const { nanoid } = require('nanoid')
const gql = require('gql-query-builder')
const { getNamedType, isScalarType, isObjectType } = require('gridsome/graphql')

const reporter = consola.create({
  defaults: {
    tag: 'gridsome-plugin-flexsearch'
  }
})

function FlexSearchIndex (api, options) {
  // Setup defaults
  const { searchFields = [], collections = [], flexsearch = {}, chunk = false, compress = false } = options
  const { profile = 'default', ...flexOptions } = flexsearch

  // Create base FlexSearch instance
  const search = new FlexSearch({
    profile,
    ...flexOptions,
    doc: {
      id: 'id',
      field: searchFields
    }
  })

  // Set client options
  const clientOptions = { pathPrefix: api._app.config._pathPrefix, siteUrl: api._app.config.siteUrl, ...options }
  api.setClientOptions(clientOptions)

  // Function to get collection from graphql, and transform nodes
  async function getCollection (collection, { schema, graphql }) {
    const type = schema.getType(collection.typeName)
    if (!type) {
      reporter.error(`Collection ${collection.typeName} does not exist in schema, skipping.`)
      return []
    }

    const fields = [...new Set([...collection.fields, ...searchFields, 'id'])]
    const typeFields = type.getFields()

    const getFields = field => {
      if (!field) return []
      const type = getNamedType(field.type)
      if (isScalarType(type)) return field.name
      if (isObjectType(type)) {
        const scalarFields = Object.values(type.getFields()).flatMap(getFields)
        if (!scalarFields.length) return []
        return { [ field.name ]: scalarFields }
      }
      return []
    }

    const queryFields = fields.flatMap(key => {
      const field = typeFields[ key ]
      if (!field && collection.fields.includes(key)) {
        reporter.warn(`Field ${key} does not exist in type ${collection.typeName}, skipping.`)
        return []
      }

      return getFields(field)
    })

    const operationName = `all${collection.typeName}`
    const { query } = gql.query({
      operation: operationName,
      fields: [{ edges: [{ node: queryFields }] }]
    })

    const { data, errors } = await graphql(query)
    if (errors) {
      reporter.error(errors[ 0 ].message)
      return []
    }

    const nodes = data[ operationName ].edges.map(({ node }) => node)

    return nodes.map(node => {
      const indexFields = Object.fromEntries(searchFields.map(key => {
        const value = node[ key ]
        return Array.isArray(value) ? [key, JSON.stringify(value)] : [key, value]
      }))

      return {
        id: nanoid(),
        index: collection.indexName,
        node,
        ...indexFields
      }
    })
  }

  // After the Store has been filled, and the Schema has been created, start the index import.
  api.onBootstrap(async () => {
    const graphql = api._app.graphql
    const schema = api._app.schema.getSchema()

    const docsArrays = await pMap(collections, collection => getCollection(collection, { graphql, schema }))
    const docs = docsArrays.flat()

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
      const chunk = { id: nanoid(), index }
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
      const chunk = { id: nanoid(), docs }

      return {
        ids: [...manifest.ids, chunk.id],
        docs: {
          ...manifest.docs,
          [ chunk.id ]: cjson.compress(chunk.docs)
        }
      }
    }, { ids: [], docs: {} })

    const manifest = {
      hash: nanoid(),
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
