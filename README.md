#fs-proxy
##usage
`const config = fsproxy(path, options)`
`options` can be:
- `options.parser`: a parser like the `JSON` object with a `parse` method and a `stringify` method, default: `JSON`
- `options.parseArgs`: arguments array to be appended to the calls to `parser.parse` like this: `parse(parseString, ...options.parseArgs)`
- `options.stringifyArgs`: arguments array to be appended to calls to `parser.stringify` like this: `stringify(obj, ...options.stringifyArgs)`, default: `[2]`
- `options.encoding`: the file encoding to use, default: `utf8`
- `options.writeOnExit`: if `true`, makes sure to write the config when `process.on('exit')` triggers, default: `true`

the object has a non-configurable, non-enumerable property called `_fsproxy`, this is an eventEmitter with four events:
- `read`: emitted after the file was read
- `write`: emitted after the file was written
- `error`: emitted when an error occurs with the reading/writing
- `kill`: this event will never be emitted but is instead listened to, emit this event if you want to unlink the object and the file, the object will continue to act like a normal object after this but it wont update the file or get updated with the file anymore
