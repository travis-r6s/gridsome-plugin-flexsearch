const path = require('path')
const fs = require('fs-extra')
const FlexSearch = require('flexsearch')

module.exports = function (api, { fields, collections }) {
  const search = new FlexSearch({
    tokenize: "strict",
    depth: 3,
    doc: {
      id: "id",
      field: fields
    }
  })
  api.afterBuild(({ queue, config }) => {
    const filename = path.join(config.outDir, 'search.json')

    const indexes = collections.map(({ contentTypeName, indexName }) => {
      const { collection } = api.store.getContentType(contentTypeName)
      return { indexName, ...collection }
    })
    indexes.map(index => {
      const docs = index.data.map(doc => ({
        index: index.indexName,
        id: doc.id,
        title: doc.title,
        excerpt: doc.excerpt,
        description: doc.description
      }))
      search.add(docs)
    })
    return fs.outputFile(filename, search.export())
  })
}

module.exports.defaultOptions = () => ({
  collections: [],
  fields: []
})
