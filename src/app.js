const fs = require('fs')
const EventEmitter = require('events')

const defaults = {
  parser: JSON,
  parseArgs: [],
  stringifyArgs: [null, 2],
  encoding: 'utf8',
  writeOnExit: true
}

module.exports = function createFsProxy(path, semiOptions) {
  // combine options from defaults and user inputted options
  const options = Object.assign({}, defaults, semiOptions)

  const cache = options.parser.parse(fs.readFileSync(path, options.encoding), ...options.parseArgs)
  const eventer = new EventEmitter()
  Reflect.defineProperty(cache, '_fsproxy', { value: eventer })

  let writePromise = null
  let killed = false

  // get file discriptor
  let fd = fs.openSync(path, 'r+')

  // create method to stop program
  eventer.on('kill', () => {
    fs.unwatchFile(path)
    killed = true
    fs.close(fd, (err) => {
      if (err) {
        eventer.emit('error', err)
      }
      fd = null
    })
  })
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
  fs.watchFile(path, { persistent: false }, read)

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
          const newCache = options.parser.parse(fileContents.toString(options.encoding), ...options.parseArgs)
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
      const writeString = options.parser.stringify(cache, ...options.stringifyArgs)
      console.log('writeString:', writeString)

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

  if (options.writeOnExit && !killed) {
    fs.close(fd, (err) => {
      if (err) {
        eventer.emit('error', err)
      }
      fd = null
    })
    process.on('exit', write)
  }

  // return the proxy
  return new Proxy(cache, handlers)
}
