#fs-proxy
##usage
`const config = fsproxy(path, options)`
`options` can be:
- `options.parser`: a parser like the `JSON` object with a `parse` method and a `stringify` method, the methods take one argument, the data to parse/stringify, default: `{ parse: JSON.parse, stringify: (data) => JSON.stringify(data, null, 2) }`
- `options.encoding`: the file encoding to use, default: `utf8`


the object has a non-configurable, non-enumerable property called `_fsproxy`, this is an eventEmitter with four events:
- `read`: emitted after the file was read
- `write`: emitted after the file was written
- `error`: emitted when an error occurs
- `kill`: this event will never be emitted but is instead listened to, emit this event if you want to unlink the object and the file, the object will continue to act like a normal object after this but it wont update the file or get updated with the file anymore
