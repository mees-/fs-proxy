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
  // create cache and populate with initial values from file
  const cache = parse(fs.readFileSync(path, options.encoding))
  // create eventer
  const eventer = new EventEmitter()
  // attach eventer to cache, non-enumerable
  Reflect.defineProperty(cache, '_fsproxy', { value: eventer })

  let writePromise = null
  let killed = false

  // get file discriptor
  let fd = fs.openSync(path, 'r+')

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
          Object.assign(cache, newCache) // if you do cache = newCache the link with the proxy is broken
          // reattach events
          Reflect.defineProperty(cache, '_fsproxy', { value: eventer })
          cache._fsproxy.emit('read')
          resolve()
        })
      })
    }).catch((e) => {
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
    }).catch((e) => {
      eventer.emit('error', e)
    })

    writePromise.then(() => {
      writePromise = null
    })
  }

  // create method to stop program
  eventer.on('kill', () => {
    killed = true
    close()
    process.removeListener('exit', close)
  })

  function close() {
    fs.close(fd, (err) => {
      if (err) {
        eventer.emit('error', err)
      }
      fd = null
    })
    watcher.close()
  }

  process.on('exit', close)

  // return the proxy
  return new Proxy(cache, handlers)
}
