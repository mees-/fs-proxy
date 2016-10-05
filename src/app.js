const fs = require('fs')
const EventEmitter = require('events')

exports.data = Symbol('stringSymbol')

const defaults = {
  parser: {
    parse: JSON.parse,
    stringify: (data) => JSON.stringify(data, null, 2)
  },
  encoding: 'utf8'
}

module.exports = function createFsProxy(path, semiOptions) {
  // combine options from defaults and user inputted options
  const options = Object.assign({}, defaults, semiOptions)
  // copy for readability
  const parse = options.parser.parse
  const stringify = options.parser.stringify

  // runtime settings
  let writePromise = null
  let killed = false

  // handlers for proxies
  const handlers = {
    set(t, id, value) {
      t[id] = value
      if (!killed) {
        write()
      }
    },

    deleteProperty(t, id) {
      Reflect.deleteProperty(t, id)
      if (!killed) {
        write()
      }
    }
  }
  // create cache and populate with initial values from file
  let tempCache = parse(fs.readFileSync(path, options.encoding))
  const cache = recursiveProxy(tempCache, handlers)
  tempCache = null
  // create eventer
  const eventer = new EventEmitter()
  // attach kill method to eventer
  eventer.kill = kill
  // attach eventer to cache, non-enumerable
  Reflect.defineProperty(cache, '_fsproxy', { value: eventer })

  // get file discriptor
  let fd = fs.openSync(path, 'r+')

  // read on file change
  const watchOptions = {
    persistent: false,
    encoding: options.encoding
  }
  const watcher = fs.watch(path, watchOptions)
  watcher.on('error', (err) => eventer.emit('error', err))
  watcher.on('change', read)

  function read() {
    if (writePromise) {
      writePromise = writePromise.then(read)
      return
    }
    return new Promise((resolve, reject) => {
      fs.stat(path, (e1, stats) => {
        if (e1) {
          reject(e1)
          return
        }
        const fileContents = Buffer.alloc(stats.size)
        fs.read(fd, fileContents, 0, stats.size, 0, (e2) => {
          if (e2) {
            reject(e2)
            return
          }
          // clear cache from all keys without reassigning
          for (const key of Object.keys(cache)) {
            Reflect.deleteProperty(cache, key)
          }
          const newCache = parse(fileContents.toString(options.encoding))

          Object.assign(cache, recursiveProxy(newCache, handlers))
          // reattach events
          Reflect.defineProperty(cache, '_fsproxy', { value: eventer })
          resolve()
        })
      })
    })
    .then(() => {
      cache._fsproxy.emit('read')
    })
    .catch((e) => {
      eventer.emit('error', e)
    })
  }

  function write() {
    if (writePromise) {
      writePromise = writePromise.then(write)
      return
    }
    writePromise = new Promise((resolve, reject) => {
      const writeString = stringify(cache)
      fs.write(fd, writeString, 0, options.encoding, (err, bytesWritten) => {
        if (err) {
          reject(err)
          return
        }
        resolve(bytesWritten)
        cache._fsproxy.emit('write')
      })
    })
    .then(() => {
      writePromise = null
    })
    .catch((e) => {
      eventer.emit('error', e)
    })

    return writePromise
  }

  function kill() {
    killed = true
    fs.close(fd, (err) => {
      if (err) {
        eventer.emit('error', err)
      }
      fd = null
    })
    watcher.close()
    process.removeListener('exit', kill)
    return Object.assign({}, cache)
  }

  process.on('exit', kill)

  // return the proxy
  return new Proxy(cache, handlers)
}

function recursiveProxy(rObject, handlers) {
  const object = Object.assign({}, rObject)
  const target = {}
  for (const key in object) {
    if (typeof object[key] === 'object') {
      console.log(`proxyfiing ${ key } : ${ object[key] }`)
      target[key] = new Proxy(object[key], handlers)
    } else {
      target[key] = object[key]
    }
  }
  return target
}
