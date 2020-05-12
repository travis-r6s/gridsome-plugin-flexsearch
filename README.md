# gridsome-plugin-flexsearch

> Add lightning fast search to Gridsome with FlexSearch

## Installation

_Requires at least Gridsome `v0.7.3`, versions `>= 0.1.20` requires Gridsome > `0.7.14`._

```bash
yarn add gridsome-plugin-flexsearch #or
npm i gridsome-plugin-flexsearch
```

`gridsome.config.js`
```js
module.exports = {
  {
    use: 'gridsome-plugin-flexsearch',
    options: {
      collections: [
        {
          typeName: 'SomeType',
          indexName: 'SomeType',
          fields: ['title', 'handle', 'description']
        }
      ],
      searchFields: ['title']
    }
  }
}
```

## Configuration

This plugin requires a few configurations to get going.

Firstly, you need to specify what types you want to add to the index with `collections: [...`. `collections` expects an array of objects, each with at least two fields, and one optional field.

| Option  | Explanation |
| ------------- | ------------- |
| `typeName`  | The Schema typename - e.g. `Post`. All nodes with this typename will be added to the search index.  |
| `indexName`  | The name of the index created for this collection - can be the same as `typeName`.  |
| `fields` | An array of keys that will be extracted from each node, and added to the search index doc (what the search result will return when queried).

Now you will need to add the fields that will be included in the index, and searched. Note that this is different from the above `fields` option, as fields will not be searched, they are just what is returned in each result.

| Option | Explanation |
| ---------- | --------|
| `searchFields` | An array of keys in each node, that will be used for the search index. |

You can also specify optional flexsearch configurations under a `flexsearch` key - the default configuration is to use the `default` profile, which will setup the FlexSearch instance with some sensible defaults.
However you can override this profile, or set custom options such as `tokenize`, `resolution` etc. Read the [FlexSearch](https://github.com/nextapps-de/flexsearch#presets) docs to find out more.


### Additional Options

| Option | Explanation |
| ---------- | --------|
| `chunk` | Defaults to false. If `true` or a Number (docs array chunk size), it will split up the FlexSearch index & docs JSON file to reduce filesizes - useful if you have a huge amount of data. |
| `autoFetch` | Defaults to true. This plugin will usually automatically fetch and import the generated FlexSearch index & docs as soon as the site is loaded, but if you only want this to happen on a certain route to reduce other page load times for example (i.e. `/search`), you can specify that route with this option, or disable it completely and import yourself with `this.$search/import({ ...`] |

#### Examples
```js
...
options: {
  chunk: true,
  autoFetch: '/search',
  # OR
  chunk: 1000,
  autoFetch: ['/search', '/collections']
}
...
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
