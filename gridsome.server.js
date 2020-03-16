const path = require('path')
const fs = require('fs')
const FlexSearch = require('flexsearch')
const { v4: uuid } = require('uuid')
const _chunk = require('lodash.chunk')

function CreateSearchIndex (api, options) {
  const { searchFields = [], collections = [], flexsearch = {}, chunk = false } = options
  const { profile = 'default', ...flexoptions } = flexsearch

  const collectionsToInclude = collections.map(({ typeName }) => typeName)

  const search = new FlexSearch({
    profile,
    ...flexoptions,
    doc: {
      id: 'id',
      field: searchFields
    }
  })

  const clientOptions = { pathPrefix: api._app.config._pathPrefix, siteUrl: api._app.config.siteUrl, ...options }
  api.setClientOptions(clientOptions)

  api.onCreateNode(node => {
    if (collectionsToInclude.includes(node.internal.typeName)) {
      const collectionOptions = collections.find(({ typeName }) => typeName === node.internal.typeName)
      const index = { ...collectionOptions, fields: Array.isArray(searchFields) ? [...searchFields, ...collectionOptions.fields] : collectionOptions.fields }
      const docFields = index.fields.reduce((obj, key) => {
        let value = node[ key ]
        if (Array.isArray(value)) value = JSON.stringify(value)
        return { [ key ]: value, ...obj }
      }, {})

      const doc = {
        index: index.indexName,
        id: node.id,
        path: node.path,
        ...docFields
      }

      search.add(doc)
    }
  })

  api.configureServer(app => {
    console.log('Serving search index...')
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
      const searchIndex = search.export({ serialize: false })
      app.get('/flexsearch.json', (req, res) => {
        res.json(searchIndex)
      })
    }
  })

  api.afterBuild(async ({ config }) => {
    const outputDir = config.outputDir || config.outDir

    if (chunk) {
      console.log('Creating search index (chunked mode)...')
      const flexsearchDir = path.join(outputDir, 'flexsearch')
      const manifestFilename = path.join(flexsearchDir, 'manifest.json')

      const { manifest, chunks } = createManifest()

      await fs.mkdirSync(flexsearchDir)
      await fs.writeFileSync(manifestFilename, JSON.stringify(manifest))

      for (const [name, data] of Object.entries(chunks)) {
        const chunkFilename = path.join(flexsearchDir, `${name}.json`)
        await fs.writeFileSync(chunkFilename, JSON.stringify(data))
      }

      console.log('Saved search index.')
    } else {
      console.log('Creating search index...')
      const filename = path.join(outputDir, 'flexsearch.json')
      const searchIndex = search.export({ serialize: false })
      await fs.writeFileSync(filename, JSON.stringify(searchIndex))
      console.log('Saved search index.')
    }
  })

  function createManifest () {
    const searchIndex = search.export({ serialize: false, index: true, doc: false })
    const [searchDocs] = search.export({ serialize: false, index: false, doc: true })

    const chunkedIndex = searchIndex.reduce((manifest, index) => {
      const chunk = { id: uuid(), index }
      return {
        ids: [...manifest.ids, chunk.id],
        indexes: {
          ...manifest.indexes,
          [ chunk.id ]: chunk.index
        }
      }
    }, { ids: [], indexes: {} })

    const chunkedDocs = _chunk(Object.entries(searchDocs), 2000).reduce((manifest, docs) => {
      const chunk = { id: uuid(), docs }
      return {
        ids: [...manifest.ids, chunk.id],
        docs: {
          ...manifest.docs,
          [ chunk.id ]: chunk.docs
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

module.exports = CreateSearchIndex

module.exports.defaultOptions = () => ({
  chunk: false,
  autoFetch: true,
  flexsearch: { profile: 'default' },
  searchFields: [],
  collections: []
})
