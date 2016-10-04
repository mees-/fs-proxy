#fs-proxy
##usage
`const config = fsproxy(path, options)`
`options` can be:
- `options.parser`: a parser like the `JSON` object with a `parse` method and a `stringify` method, default: `JSON`
- `options.parseArgs`: arguments array to be appended to the calls to `parser.parse` like this: `parse(parseString, ...options.parseArgs)`
- `options.stringifyArgs`: arguments array to be appended to calls to `parser.stringify` like this: `stringify(obj, ...options.stringifyArgs)`, default: `[2]`
- `options.encoding`: the file encoding to use, default: `utf8`
- `options.writeOnExit`: if `true`, makes sure to write the config when `process.on('exit')` triggers, default: `true`
