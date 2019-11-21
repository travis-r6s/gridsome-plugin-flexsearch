const path = require( 'path' )
const fs = require('fs')
const FlexSearch = require( 'flexsearch' )

function CreateSearchIndex ( api, { searchFields, collections } ) {
  const search = new FlexSearch({
    tokenize: "strict",
    depth: 3,
    doc: {
      id: "id",
      field: searchFields
    }
  } )
  api.loadSource( actions => {
    console.log('Creating search index');
    const indexes = collections.map(({ typeName, indexName, fields }) => {
      const { collection } = actions.getCollection( typeName )
      return { indexName, ...collection, fields: [...searchFields, ...fields] }
    } )

    for ( const index of indexes ) {
      const docs = index.data.map( doc => {
        const docFields = index.fields.reduce((obj, key) => ({ [key]: doc[key], ...obj }), {})

        return {
          index: index.indexName,
          id: doc.id,
          path: doc.path,
          ...docFields
        }
      } )
      search.add(docs)
    }

  } )

  api.configureServer(app => {
    console.log('Serving search index')
    const searchConfig = {
      searchFields,
      index: search.export({ serialize: false })
    }
    app.get('/search.json', (req, res) => {
      res.json(searchConfig)
    })
  })

  api.afterBuild( ( { queue, config } ) => {
    console.log('Saving search index')
    const filename = path.join( config.outputDir, 'search.json' )
    const searchConfig = {
      searchFields,
      index: search.export({ serialize: false })
    }
    return fs.writeFileSync(filename, JSON.stringify(searchConfig))
  })
}

module.exports = CreateSearchIndex
