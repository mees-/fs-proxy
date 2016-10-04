const fsProxy = require('../')
const fs = require('fs')
const { assert } = require('chai')
const { join } = require('path')

const path = join(__dirname, '../config.json')

const initialConfig = {
  test: true,
  name: 'fsproxy'
}

const complete = []

fs.writeFileSync(path, JSON.stringify(initialConfig))


// initialize fsproxy
const pconfig = fsProxy(path)

// equality
try {
  assert.equal(JSON.stringify(pconfig), JSON.stringify(initialConfig))
} catch (e) {
  console.error('failed basic equality')
}

// file is still same
try {
  const file = fs.readFileSync(path)
  const obj = JSON.parse(file)
  assert.equal(JSON.stringify(obj), JSON.stringify(pconfig))
} catch (e) {
  console.error('failed file equality')
}

// write something and then retry file equality
try {
  complete.push(new Promise((resolve, reject) => {
    pconfig._fsproxy.once('write', () => {
      fs.readFile(path, (err, file) => {
        if (err) {
          console.error('error with writing something and then retry file equality')
          reject(err)
          return
        }
        const obj = JSON.parse(file)
        assert.equal(JSON.stringify(obj), JSON.stringify(Object.assign({}, initialConfig, { newProp: 'this is new' })))
        resolve()
      })
    })
    pconfig.newProp = 'this is new' // this should trigger write aswell
  }))
} catch (e) {
  console.error('error with writing something and then retry file equality sync')
}

// remove test file
Promise.all(complete)
  .then(() => {
    fs.unlink(path, (err) => {
      if (err) {
        throw err
      }
      console.log('done!')
    })
  })
  .catch((e) => {
    console.error('ERROR!', e)
  })
