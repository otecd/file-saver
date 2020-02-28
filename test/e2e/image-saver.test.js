/* eslint-disable no-unused-expressions */
import fs from 'fs'
import rimraf from 'rimraf'
import path from 'path'
import sharp from 'sharp'
import { ImageSaver } from '../../src/index'
import { IMAGE_URL } from '../fixtures/sources'

describe('E2E / ImageSaver', function () {
  const targetDir = path.join(__dirname, `./temp${Date.now()}`)

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

  it('transform an image', async () => {
    const saver = new ImageSaver({ targetDir })
    const transformer = sharp()
      .blur(30)
      .resize(1400, 1400)
      .tiff()
    const downloadedFileName = await saver.download(IMAGE_URL)
    const fileName = await saver.process({
      fileName: downloadedFileName,
      transformer,
      textOverlays: [{ text: 'test test' }],
      textPosition: { x: 55, y: 69 }
    })
    const filePath = path.join(targetDir, fileName)
    const metadata = await sharp(filePath).metadata()

    expect(metadata.format).to.equal('tiff')
  })
})
