/* eslint-disable no-unused-expressions */
import fs from 'fs'
import path from 'path'
import rimraf from 'rimraf'
import fetch from 'isomorphic-unfetch'
import FormData from 'form-data'
import { RichError } from '@noname.team/errors'
import { FileSaver } from '../../src/index'
import {
  FILE_URL,
  FILE_URL_INACCESSIBLE,
  FILE_URL_INVALID
} from '../fixtures/sources'
import createServer from '../fixtures/server'

describe('E2E / FileSaver', function () {
  const targetDir = path.join(__dirname, `./temp${Date.now()}`)
  let commonTargetPath

  this.timeout(20000)
  before(() => {
    if (fs.existsSync(targetDir)) {
      rimraf.sync(targetDir)
    }
    fs.mkdirSync(targetDir)
  })
  after(() => {
    rimraf.sync(targetDir)
  })

  describe('downloads a file', () => {
    it('from URL string', async () => {
      const saver = new FileSaver({ targetDir, validExtensions: ['pdf'] })

      commonTargetPath = path.join(targetDir, await saver.download(FILE_URL))

      const fileStat = fs.statSync(commonTargetPath)

      expect(fileStat.isFile()).to.be.true
    })
    it('from Request object', async () => {
      const saver = new FileSaver({ targetDir, validExtensions: ['pdf'] })
      const port = 61616
      const server = createServer(async (req, res) => {
        const targetPath = path.join(targetDir, await saver.download(FILE_URL))
        const fileStat = fs.statSync(targetPath)

        expect(fileStat.isFile()).to.be.true
        res.end('done')
      }, port)
      const body = new FormData()

      body.append('file', fs.createReadStream(commonTargetPath))

      const postImageData = await fetch(`http://localhost:${port}`, { method: 'POST', body })
      const postImageResponse = await postImageData.text()

      expect(postImageResponse).to.equal('done')
      server.close()
    })
  })

  describe('breaks down while downloading a file', () => {
    it('from inaccessible file by URL string', async () => {
      const saver = new FileSaver({ targetDir, validExtensions: ['pdf'] })

      try {
        await saver.download(FILE_URL_INACCESSIBLE)
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', 'ERR_FILE_CAN_NOT_BE_LOADED')
      }
    })
    it('from invalid URL string', async () => {
      const saver = new FileSaver({ targetDir })

      try {
        await saver.download(FILE_URL_INVALID)
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', 'ERR_FILE_SOURCE_BROKEN')
      }
    })
    it('from URL string with incorrect extension', async () => {
      const saver = new FileSaver({ targetDir, validExtensions: ['doc'] })

      try {
        await saver.download(FILE_URL)
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', 'ERR_FILE_FORMAT_UNSUPPORTED')
      }
    })
    it('by a broken Request', async () => {
      const saver = new FileSaver({ targetDir })

      try {
        await saver.download({ foo: 'bar' })
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', 'ERR_FILE_SOURCE_BROKEN')
      }
    })
    it('by Request with invalid file', async () => {
      const saver = new FileSaver({ targetDir, validExtensions: ['pdf'] })
      const port = 61616
      const server = createServer(async (req, res) => {
        try {
          await saver.download(req)
        } catch (error) {
          expect(error).to.be.an.instanceOf(RichError).with.property('code', 'ERR_FILE_SOURCE_BROKEN')
        }
        res.end('done')
      }, port)
      const body = new FormData()

      body.append('file', fs.createReadStream(path.join(__dirname, '../fixtures/invalid.pdf')))

      const postImageData = await fetch(`http://localhost:${port}`, { method: 'POST', body })
      const postImageResponse = await postImageData.text()

      expect(postImageResponse).to.equal('done')
      server.close()
    })
    it('by Request with incorrect extension', async () => {
      const saver = new FileSaver({ targetDir, validExtensions: ['doc'] })
      const port = 61616
      const server = createServer(async (req, res) => {
        try {
          await saver.download(req)
        } catch (error) {
          expect(error).to.be.an.instanceOf(RichError).with.property('code', 'ERR_FILE_FORMAT_UNSUPPORTED')
        }
        res.end('done')
      }, port)
      const body = new FormData()

      body.append('file', fs.createReadStream(commonTargetPath))

      const postImageData = await fetch(`http://localhost:${port}`, { method: 'POST', body })
      const postImageResponse = await postImageData.text()

      expect(postImageResponse).to.equal('done')
      server.close()
    })
  })
})
