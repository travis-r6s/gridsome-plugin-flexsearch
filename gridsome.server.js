const path = require('path')
const fs = require('fs')
const FlexSearch = require('flexsearch')

function CreateSearchIndex (api, { searchFields = [], collections = [], flexsearch = {} }) {
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

  api.onCreateNode(node => {
    if (collectionsToInclude.includes(node.internal.typeName)) {
      const collectionOptions = collections.find(({ typeName }) => typeName === node.internal.typeName)
      const index = { ...collectionOptions, fields: Array.isArray(searchFields) ? [...searchFields, ...collectionOptions.fields] : collectionOptions.fields }
      const docFields = index.fields.reduce((obj, key) => ({ [ key ]: node[ key ], ...obj }), {})

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
    const searchConfig = {
      searchFields,
      index: search.export({ serialize: false })
    }
    app.get('/flexsearch.json', (req, res) => {
      res.json(searchConfig)
    })
  })

  api.afterBuild(({ queue, config }) => {
    console.log('Saving search index')
    const outputDir = config.outputDir || config.outDir
    const filename = path.join(outputDir, 'flexsearch.json')
    const searchConfig = {
      searchFields,
      index: search.export({ serialize: false })
    }
    return fs.writeFileSync(filename, JSON.stringify(searchConfig))
  })
}

module.exports = CreateSearchIndex

module.exports.defaultOptions = () => ({
  flexsearch: { profile: 'default' },
  searchFields: [],
  collections: []
})
