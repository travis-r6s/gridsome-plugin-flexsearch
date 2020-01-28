const path = require('path')
const fs = require('fs')
const FlexSearch = require('flexsearch')

function CreateSearchIndex (api, options) {
  const { searchFields = [], collections = [], flexsearch = {} } = options
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
    console.log('Serving search index')
    const searchIndex = search.export({ serialize: false })
    app.get('/flexsearch.json', (req, res) => {
      res.json(searchIndex)
    })
  })

  api.afterBuild(({ config }) => {
    console.log('Saving search index')
    const outputDir = config.outputDir || config.outDir
    const filename = path.join(outputDir, 'flexsearch.json')
    const searchIndex = search.export({ serialize: false })
    return fs.writeFileSync(filename, JSON.stringify(searchIndex))
  })
}

module.exports = CreateSearchIndex

module.exports.defaultOptions = () => ({
  flexsearch: { profile: 'default' },
  searchFields: [],
  collections: []
})
