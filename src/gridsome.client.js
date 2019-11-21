
export default function (Vue, context) {
  Vue.mixin({
    data: () => ({
      searchTerm: '',
      index: null,
      results: []
    }),
    async created () {
      if (process.isClient) {
        // import FlexSearch from 'flexsearch'
        // browser only code
        async function setStorageData() {
          const data = await fetch('/search.json').then(response => response.json()).then(d => JSON.stringify(d))
          localStorage.setItem('search', data)
          return data
        }
        const data = localStorage.getItem('search') ? localStorage.getItem('search') : await setStorageData()
        console.log(data);
        this.index = new FlexSearch({
          tokenize: "strict",
          depth: 3,
          doc: {
            id: "id",
            field: [
              "title",
              "excerpt",
              "description"
            ],
          }
        })
        this.index.import(data)
      }
    }
  })
  Vue.prototype.$search = search
}
