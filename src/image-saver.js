import path from 'path'
import fs from 'fs'
import uuidv4 from 'uuid/v4'
import jo from 'jpeg-autorotate'
import sharp from 'sharp'
import textToPicture from 'text-to-picture'
import { RichError } from '@noname.team/errors'
import { validateImageFile } from '@noname.team/helpers/for/server'
import FileSaver from './file-saver'
import { error_codes as errorCodes } from './const.json'

/**
 * ImageSaver class. Use it for images downloading, processing and storing wherever you want.
 */
export default class ImageSaver extends FileSaver {
  /**
   * @param {Object} config - input configuration.
   * @param {!String} config.targetDir - is output system directory.
   * @param {?Array<String>} [config.validExtensions=['jpg', 'png']] - acceptable image extensions.
   * @return {Object} - an instance.
   */
  constructor ({ targetDir, validExtensions = ['jpg', 'png'] } = {}) {
    super({ targetDir, validExtensions })

    this.process = this.process.bind(this)
  }

  /**
   * This method is a firstable step of image saving.
   * @param {!(String|Object)} source - image source. String means that this is URL or you can provide an Object that is for Http Request instance
   * @param {?String} [targetName=uuidv4()] - is output file name w/o extension.
   * @return {Promise<Object, Error>} - return a current instance.
   * @todo support multiple files by a single call
   */
  async download (source, targetName = uuidv4()) {
    const targetFileName = await super.download(source, targetName)
    const targetPath = path.join(this.targetDir, targetFileName)
    let joResult

    try {
      await validateImageFile(targetPath)
    } catch (error) {
      try {
        fs.unlinkSync(targetPath)
      } catch (errorUnlink) {
      }
      throw error
    }
    try {
      joResult = await jo.rotate(targetPath, { quality: 100 })
      fs.writeFileSync(targetPath, joResult.buffer)
    } catch (error) {
    }

    return targetFileName
  }

  /**
   * This method is optional step for image processing.
   * @param {Object} config
   * @param {Object} config.transformer - sharp operations.
   * @param {?Array<Object>} config.textOverlays - objects of text-to-picture pkg
   * @return {Promise<Object, Error>} - return a current instance. Throw errors when file system troubles.
   */
  async process ({
    fileName,
    transformer,
    textOverlays,
    textPosition
  }) {
    if (!fileName || !(transformer || textOverlays)) {
      throw new RichError('Required argument is missed', errorCodes.ERR_REQUIRED_ARGUMENT_MISSED)
    }

    let targetFileName = fileName
    let targetPath = path.join(this.targetDir, targetFileName)
    const readStream = fs.createReadStream(targetPath)
    const image = await readStream.pipe(transformer)
    const buffer = await image.toBuffer()

    fs.writeFileSync(targetPath, buffer)

    const metadata = await sharp(targetPath).metadata()
    const convertToPercent = ({ x, y }) => {
      const { width, height } = metadata

      return { left: (width / 100 * x), top: (height / 100 * y) }
    }
    const [name, originalExtension] = targetFileName.split('.')
    const originalFormat = originalExtension === 'jpg' ? 'jpeg' : originalExtension

    if (originalFormat !== metadata.format) {
      const oldPath = targetPath
      const extension = metadata.format === 'jpeg' ? 'jpg' : metadata.format

      targetFileName = `${name}.${extension}`
      targetPath = path.join(this.targetDir, targetFileName)
      fs.renameSync(oldPath, targetPath)
    }

    if (Array.isArray(textOverlays)) {
      const overlaysBuffers = await Promise.all(textOverlays.map(async (t) => {
        const result = await textToPicture.convert(t)

        return result.getBuffer()
      }))
      const textPositionOnImg = (typeof textPosition === 'object') ? convertToPercent(textPosition)
        : (typeof textPosition === 'string') ? { gravity: textPosition } : null
      const bufferWithOverlays = await sharp(targetPath)
        .composite(overlaysBuffers.map((input) => ({ input, ...textPositionOnImg })))
        .toBuffer()

      fs.writeFileSync(targetPath, bufferWithOverlays)
    }

    return targetFileName
  }
}
