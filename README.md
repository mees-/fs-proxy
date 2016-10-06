#fs-proxy
##usage
`const config = fsproxy(path, options)`
`options` can be:
- `options.parser`: a parser like the `JSON` object with a `parse` method and a `stringify` method, the methods take one argument, the data to parse/stringify, default: `{ parse: JSON.parse, stringify: (data) => JSON.stringify(data, null, 2) }`
- `options.encoding`: the file encoding to use, default: `utf8`
- `options.filter`: a function that takes two parameters: `(key, value)` of an object with key being an array of steps to get to the value in the object, the function should return true to write the property to the file, and false to not write the property to the file, the property will always be in the object


the object has a non-configurable, non-enumerable property called `_fsproxy`, this is an eventEmitter with four events:
- `read`: emitted after the file was read
- `write`: emitted after the file was written
- `error`: emitted when an error occurs

`fsproxy(path)._fsproxy.kill()`: Call this method to unlink the object and the file, the object will continue to act like a normal object but it wont update the file or get updated with the file anymore, returns a plain object detached from fsproxy

##example
imagine a file named `config.json`
the content is:
```
{
  "url": "localhost:8000",
  "token": "abcdefghijk"
}
```
js:
```js
const fsproxy = require('fsproxy')

const config = fsproxy('./config.json')
console.log(config) // {url: 'localhost:8000', 'token: 'abcdefghijk'}
config.lastRan = 'now'

// ./config.json is now:
// {
//   "url": "localhost:8000",
//   "token": "abcdefghijk",
//   "lastRan": "now"
// }

// modify ./config.json somewhere else

// ./config.json is now:
// {
//   "url": "localhost:8000",
//   "token": "abcdefghijk",
//   "lastRan": "later"
// }
console.log(config.lastRan) // 'later'

config._fsproxy.ignore('ignoreThis')
config.ignoreThis = 'this will not be added to the file'

const plainObject = config._fsproxy.kill()
```
