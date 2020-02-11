/* eslint-disable no-unused-expressions */
import fs from 'fs'
import path from 'path'
import fetch from 'isomorphic-unfetch'
import FormData from 'form-data'
import sharp from 'sharp'
import { RichError } from '@noname.team/errors'
import ImageSaver from '../../src/index'
import { error_codes as errorCodes } from '../../src/const.json'
import {
  IMAGE_URL,
  IMAGE_URL_INACCESSIBLE,
  IMAGE_URL_INVALID
} from '../fixtures/sources'
import createServer from '../fixtures/server'

describe('E2E / ImageSaver', function () {
  const tempDir = path.join(__dirname, `./temp${Date.now()}`)
  let imageFilePath

  this.timeout(20000)
  before(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir, { recursive: true })
    }
    fs.mkdirSync(tempDir)
  })
  after(() => {
    fs.rmdirSync(tempDir, { recursive: true })
  })

  describe('downloads a file', () => {
    it('from URL string', async () => {
      const saver = new ImageSaver({ targetDir: tempDir })

      await saver.download(IMAGE_URL)
      imageFilePath = saver.target.path

      const fileStat = fs.statSync(imageFilePath)

      expect(fileStat.isFile()).to.be.true
    })
    it('from Request object', async () => {
      const saver = new ImageSaver({ targetDir: tempDir })
      const port = 61616
      const server = createServer(async (req, res) => {
        await saver.download(req)

        const fileStat = fs.statSync(saver.target.path)

        expect(fileStat.isFile()).to.be.true
        res.end('done')
      }, port)
      const body = new FormData()

      body.append('file', fs.createReadStream(imageFilePath))

      const postImageData = await fetch(`http://localhost:${port}`, { method: 'POST', body })
      const postImageResponse = await postImageData.text()

      expect(postImageResponse).to.equal('done')
      server.close()
    })
  })

  it('transform an image', async () => {
    const saver = new ImageSaver({ targetDir: tempDir })
    const transformer = sharp()
      .blur(30)
      .resize(400, 400)
      .jpeg()

    await saver.download(IMAGE_URL)
    await saver.process({ transformer, textOverlays: [{ text: 'TEST' }] })

    const metadata = await sharp(saver.target.path).metadata()

    expect(metadata.format).to.equal('jpeg')
  })

  describe('breaks down while downloading a file', () => {
    it('from inaccessible file by URL string', async () => {
      const saver = new ImageSaver({ targetDir: tempDir })

      try {
        await saver.download(IMAGE_URL_INACCESSIBLE)
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', 'ERR_FILE_CAN_NOT_BE_LOADED')
      }
    })
    it('from invalid URL string', async () => {
      const saver = new ImageSaver({ targetDir: tempDir })

      try {
        await saver.download(IMAGE_URL_INVALID)
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', errorCodes.ERR_IMAGE_SOURCE_BROKEN)
      }
    })
    it('from URL string with incorrect extension', async () => {
      const saver = new ImageSaver({ targetDir: tempDir, validExtensions: ['jpg'] })

      try {
        await saver.download(IMAGE_URL)
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', errorCodes.ERR_IMAGE_FORMAT_UNSUPPORTED)
      }
    })
    it('by a broken Request', async () => {
      const saver = new ImageSaver({ targetDir: tempDir })

      try {
        await saver.download({ foo: 'bar' })
      } catch (error) {
        expect(error).to.be.an.instanceOf(RichError).with.property('code', errorCodes.ERR_IMAGE_SOURCE_BROKEN)
      }
    })
    it('by Request with invalid file', async () => {
      const saver = new ImageSaver({ targetDir: tempDir })
      const port = 61616
      const server = createServer(async (req, res) => {
        try {
          await saver.download(req)
        } catch (error) {
          expect(error).to.be.an.instanceOf(RichError).with.property('code', errorCodes.ERR_IMAGE_SOURCE_BROKEN)
        }
        res.end('done')
      }, port)
      const body = new FormData()

      body.append('file', fs.createReadStream(path.join(__dirname, '../fixtures/invalid-image.jpg')))

      const postImageData = await fetch(`http://localhost:${port}`, { method: 'POST', body })
      const postImageResponse = await postImageData.text()

      expect(postImageResponse).to.equal('done')
      server.close()
    })
    it('by Request with incorrect extension', async () => {
      const saver = new ImageSaver({ targetDir: tempDir, validExtensions: ['jpg'] })
      const port = 61616
      const server = createServer(async (req, res) => {
        try {
          await saver.download(req)
        } catch (error) {
          expect(error).to.be.an.instanceOf(RichError).with.property('code', errorCodes.ERR_IMAGE_FORMAT_UNSUPPORTED)
        }
        res.end('done')
      }, port)
      const body = new FormData()

      body.append('file', fs.createReadStream(imageFilePath))

      const postImageData = await fetch(`http://localhost:${port}`, { method: 'POST', body })
      const postImageResponse = await postImageData.text()

      expect(postImageResponse).to.equal('done')
      server.close()
    })
  })
})
