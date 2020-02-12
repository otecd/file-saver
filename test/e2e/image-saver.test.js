/* eslint-disable no-unused-expressions */
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { ImageSaver } from '../../src/index'
import { IMAGE_URL } from '../fixtures/sources'

describe('E2E / ImageSaver', function () {
  const targetDir = path.join(__dirname, `./temp${Date.now()}`)

  this.timeout(20000)
  before(() => {
    if (fs.existsSync(targetDir)) {
      fs.rmdirSync(targetDir, { recursive: true })
    }
    fs.mkdirSync(targetDir)
  })
  after(() => {
    fs.rmdirSync(targetDir, { recursive: true })
  })

  it('transform an image', async () => {
    const saver = new ImageSaver({ targetDir })
    const transformer = sharp()
      .blur(30)
      .resize(400, 400)
      .jpeg()
    const fileName = await saver.process({ fileName: await saver.download(IMAGE_URL), transformer, textOverlays: [{ text: 'TEST' }] })
    const filePath = path.join(targetDir, fileName)
    const metadata = await sharp(filePath).metadata()

    expect(metadata.format).to.equal('jpeg')
  })
})
