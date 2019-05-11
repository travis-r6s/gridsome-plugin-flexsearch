function log(msg) {
  console.log(msg)
}


export default function (Vue, context) {
  Vue.prototype.$log = log
}
