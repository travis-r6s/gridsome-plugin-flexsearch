# gridsome-plugin-flexsearch

> Add lightning fast search to Gridsome with FlexSearch - [demo](https://gridsome-shopify-starter.netlify.app)

Table of contents:

1. [Installation](#installation)
2. [Configuration](#configuration)
    - [GraphQL Source](#graphql-source)
    - [Additional Options](#additional-options)
    - [FlexSearch Options](#flexsearch-options)
3. [Usage](#usage)

## Installation

_Requires a Node version >=12.x, and at least Gridsome `v0.7.3`, versions `>= 0.1.21` requires Gridsome > `0.7.15`._

```bash
yarn add gridsome-plugin-flexsearch # or
npm i gridsome-plugin-flexsearch
```

`gridsome.config.js`
```js
module.exports = {
  // ...
  plugins: [
    {
      use: 'gridsome-plugin-flexsearch',
      options: {
        searchFields: ['title'],
        collections: [
          {
            typeName: 'SomeType',
            indexName: 'SomeType',
            fields: ['title', 'handle', 'description']
          }
        ]
      }
    }
  ]
}
```

## Configuration

This plugin requires a few configurations to get going.

Firstly, you will need to add the fields that will be included in the index and searched. Note that this is different from the below `fields` option, as fields will not be searched - they are just what is returned in each result.

| Option | Explanation |
| ---------- | --------|
| `searchFields` | An array of keys in each node, that will be used for the search index. |

You can also specify optional flexsearch configurations under a `flexsearch` key - the default configuration is to use the `default` profile, which will setup the FlexSearch instance with some sensible defaults.
However you can override this profile, or set custom options such as `tokenize`, `resolution` etc. Read the [FlexSearch](https://github.com/nextapps-de/flexsearch#presets) docs to find out more.

Next, you need to specify what types you want to add to the index with `collections: [...`. `collections` expects an array of objects, each with at least two fields, and one optional field.

| Option | Explanation |
| ------------- | ------------- |
| `typeName` | The Schema typename - e.g. `Post`. All nodes with this typename will be added to the search index. |
| `indexName` | The name of the index created for this collection - can be the same as `typeName`. It is added to the result, so you can differentiate between `Collection` & `Product` search results for example. |
| `fields` | An array of keys that will be extracted from each node, and added to the search index doc (what the search result will return when queried). |

Fields will be returned with the search result under a `node` key, so for example you could include a product title, slug, and image to show the product name & image in the search result, and add a link to the relevant page.

An example setup is shown below, assuming there is a `Post` and a `Collection` type:

`gridsome.config.js`
```js
module.exports = {
  // ...
  plugins: [
    {
      use: 'gridsome-plugin-flexsearch',
      options: {
        searchFields: ['title', 'tags'],
        collections: [
          {
            typeName: 'Post'
            indexName: 'Post',
            fields: ['id', 'title', 'path', 'image']
          },
          {
            typeName: 'Collection'
            indexName: 'Collection',
            fields: ['id', 'title', 'path']
          }
        ]
      }
    }
  ]
}
```

### GraphQL Source

This plugin also supports using the GraphQL source plugin. This requires a bit more setup however, as you will need to specify the GraphQL query that will return nodes you want to search, and the path to that data in the query.

| Option | Explanation |
| ------------- | ------------- |
| `indexName` | The name of the index created for this collection - can be the same as `typeName`. It is added to the result, so you can differentiate between `Collection` & `Product` search results for example. |
| `query` | A GraphQL query that will return all the data needed for the `searchFields` as well as any extra node data. |
| `path` | The path to the nodes array data returned from the GraphQL Query, using any [Lodash Get](https://lodash.com/docs/4.17.15#get) methods. |

An example of this setup is shown below, using the [GraphQL source plugin](https://gridsome.org/plugins/@gridsome/source-graphql) with [WPGraphQL](https://www.wpgraphql.com):

`gridsome.config.js`
```js
module.exports = {
  // ...
  plugins: [
    {
      use: '@gridsome/source-graphql',
      options: {
        url: 'https://somesite.com/graphql',
        fieldName: 'wordpress',
        typeName: 'Wordpress'
      }
    },
    {
      use: 'gridsome-plugin-flexsearch',
      options: {
        searchFields: ['title', 'excerpt'],
        collections: [
          {
            indexName: 'Product',
            query: `{ wordpress { posts { nodes { id, title, uri, excerpt, description, featuredImage { altText, sourceUrl } } } } }`,
            path: 'wordpress.posts.nodes'
          }
        ]
      }
    }
  ]
}
```

### Additional Options

| Option | Explanation |
| ---------- | --------|
| `chunk` | Defaults to false. If `true` or a Number (docs array chunk size), it will split up the FlexSearch index & docs JSON file to reduce filesizes - useful if you have a huge amount of data. |
| `compress` | Defaults to false. If you have a large amount of data (5k+ nodes) you can compress this data to substantially decrease the JSON size. Note that this may actually _increase_ the JSON size if you have a small amount of data, due to the way compression works. |
| `autoFetch` | Defaults to true. This plugin will usually automatically fetch and import the generated FlexSearch index & docs as soon as the site is loaded, but if you only want this to happen on a certain route to reduce other page load times for example (i.e. `/search`), you can specify that route with this option, or disable it completely and import yourself with `this.$search/import({ ...`] |

Some examples of these configurations are shown below:

`gridsome.config.js`
```js
// ...
options: {
  chunk: true,
  compress: true,
  autoFetch: '/search',
  // Or
  chunk: 1000,
  autoFetch: ['/search', '/collections'],
  // ...
}
// ...
```

### FlexSearch Options

Custom FlexSearch options can be configured under the `flexsearch` key, for example setting default profiles, or adding custom matchers/encoders.

`gridsome.config.js`
```js
// ...
options: {
  flexsearch: {
    cache: true,
    profile: 'match'
  }
  // ...
}
// ...
```

## Usage

Now you can use it in your Gridsome site - the FlexSearch instance is available at `this.$search`:

```vue
<template>
  <Layout>
    <input
      id="search"
      v-model="searchTerm"
      class="input"
      type="text"
      placeholder="Search">
    {{ searchResults }}
  </Layout>
</template>

<script>
export default {
  data: () => ({
    searchTerm: ''
  }),
  computed: {
    searchResults () {
      const searchTerm = this.searchTerm
      if (searchTerm.length < 3) return []
      return this.$search.search({ query: searchTerm, limit: 5 })
    }
  }
}
</script>
```

The search results will be an array of objects, each containing an id, the index name, the fields you specified in collections, and the path to the resurce (i.e. `/posts/abc-123`) which you could use in `g-link` for example.

A handy mixin is also included with this package, to save you writing the above boilerplate:

```vue
<template>
  <Layout>
    <input
      id="search"
      v-model="searchTerm"
      class="input"
      type="text"
      placeholder="Search">
    <g-link
      v-for="result in searchResults"
      :key="result.id"
      :to="result.path"
      class="navbar-item">
      {{ result.title }}
    </g-link>
  </Layout>
</template>

<script>
import Search from 'gridsome-plugin-flexsearch/SearchMixin'
export default {
  mixins: [Search]
}
</script>
```
