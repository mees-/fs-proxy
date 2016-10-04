const fs = require('fs')
const EventEmitter = require('events')

const defaults = {
  parser: JSON,
  parseArgs: [],
  stringifyArgs: [2],
  encoding: 'utf8',
  writeOnExit: true
}

module.exports = function createFsProxy(path, semiOptions) {
  // combine options from defaults and user inputted options
  const options = Object.assign({}, defaults, semiOptions)

  let cache = options.parser.parse(fs.readFileSync(path, options.encoding), ...options.parseArgs)
  // create a proxy
  const eventer = new EventEmitter()
  Reflect.defineProperty(cache, '_fsproxy', { value: eventer })

  let writePromise = null
  const fd = fs.openSync(path, 'r+')
  const handlers = {
    get(t, id) {
      return t[id]
    },

    set(t, id, value) {
      t[id] = value
      write()
    }
  }
  // read on file change
  fs.watchFile(path, { persistent: false }, read)

  function read() {
    fs.stat(path, (e1, stats) => {
      if (e1) {
        throw e1
        return
      }
      const fileContents = Buffer.alloc(stats.size)
      fs.read(fd, fileContents, 0, stats.size, 0, (e2) => {
        if (e2) {
          throw e2
          return
        }
        cache = options.parser.parse(fileContents.toString(options.encoding), ...options.parseArgs)
        Reflect.defineProperty(cache, '_fsproxy', { value: eventer })
        cache._fsproxy.emit('read')
      })
    })
  }

  function write() {
    if (writePromise) {
      writePromise.then(write)
      return
    }
    writePromise = new Promise((resolve, reject) => {
      const writeString = options.parser.stringify(cache, ...options.stringifyArgs)

      fs.write(fd, writeString, 0, options.encoding, (err, bytesWritten) => {
        if (err) {
          reject(err)
          return
        }
        resolve(bytesWritten)
        cache._fsproxy.emit('write')
      })
    })
    writePromise.then(() => {
      writePromise = null
    })
    .catch((e) => {
      console.error('ERROR!', e)
    })
  }

  if (options.writeOnExit) {
    process.on('exit', write)
  }

  // return the proxy
  return new Proxy(cache, handlers)
}
