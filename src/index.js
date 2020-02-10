import path from 'path'
import fs from 'fs'
import { IncomingMessage } from 'http'
import uuidv4 from 'uuid/v4'
import wget from 'wget-improved'
import jo from 'jpeg-autorotate'
import { IncomingForm } from 'formidable'
import { RichError } from '@noname.team/errors'
import { error_codes as errorCodes } from './const.json'

const download = ({
  url,
  to,
  onStart = fileSize => fileSize,
  onProgress = progress => progress,
  wgetOptions = {}
}) => new Promise((resolve, reject) => {
  let urlParsed

  try {
    urlParsed = new URL(url)
  } catch (error) {
    return reject(new RichError(error.message || 'Image source is broken', errorCodes.ERR_IMAGE_SOURCE_BROKEN))
  }

  wget.download(urlParsed.href, to, wgetOptions)
    .on('error', (error) => reject(new RichError(error.message || 'Image can not be loaded', errorCodes.ERR_IMAGE_CAN_NOT_BE_LOADED)))
    .on('start', onStart)
    .on('progress', onProgress)
    .on('end', resolve)
})

/**
 * ImageSaver class. Use it for image downloading, processing and storing wherever you want.
 */
export default class ImageSaver {
  /**
   * @param {Object} config - input configuration.
   * @param {!string} config.targetDir - is output system directory.
   * @param {?Array<string>} [config.validExtensions=['jpg', 'png']] - acceptable image extensions.
   * @return {Object} - an instance.
   */
  constructor ({
    targetDir,
    validExtensions = ['jpg', 'png']
  } = {}) {
    /**
     * @type {Object}
     * @property {string} target.dir
     * @property {string} target.path
     * @property {string} target.fileName
     */
    this.target = {
      dir: targetDir,
      path: null,
      fileName: null
    }
    /** @property {boolean} */
    this.validExtensions = validExtensions

    this.download = this.download.bind(this)
    this.process = this.process.bind(this)
  }

  /**
   * This method is a firstable step of image saving.
   * @param {!(string|Object)} source - image source. String means that this is URL or you can provide an Object that is for Http Request instance
   * @param {?string} [targetName=uuidv4()] - is output file name w/o extension.
   * @return {Promise<Object, Error>} - return a current instance.
   * @todo support multiple files by a single call
   */
  async download (source, targetName = uuidv4()) {
    if (typeof source === 'string') {
      let urlParsed

      try {
        urlParsed = new URL(source)
      } catch (error) {
        throw new RichError(error.message || 'Image source is broken', errorCodes.ERR_IMAGE_SOURCE_BROKEN)
      }

      const sourceFileName = urlParsed.pathname.split('/')
        .pop()
      const extension = sourceFileName.split('.')
        .pop()

      if (!this.validExtensions.includes(extension)) {
        throw new RichError('Unsupported image format', errorCodes.ERR_IMAGE_FORMAT_UNSUPPORTED)
      }

      this.target.fileName = `${targetName}.${extension}`
      this.target.path = path.join(this.target.dir, this.target.fileName)

      try {
        await download({ url: source, to: this.target.path })
      } catch (error) {
        try {
          fs.unlinkSync(this.target.path)
        } catch (errorUnlink) {
        }
        throw error
      }
    } else if (source instanceof IncomingMessage) {
      await new Promise((resolve, reject) => {
        const form = new IncomingForm({ uploadDir: this.target.dir, keepExtensions: true })

        form.on('file', async (_, file) => {
          let joResult
          const extension = file.name.split('.')
            .pop()

          if (!this.validExtensions.includes(extension)) {
            try {
              fs.unlinkSync(file.path)
            } catch (errorUnlink) {
            }
            return reject(new RichError('Unsupported image format', errorCodes.ERR_IMAGE_FORMAT_UNSUPPORTED))
          }

          this.target.fileName = `${targetName}.${extension}`
          this.target.path = path.join(this.target.dir, this.target.fileName)

          try {
            joResult = await jo.rotate(file.path, { quality: 100 })
            fs.writeFileSync(this.target.path, joResult.buffer)
          } catch (error) {
            fs.renameSync(file.path, this.target.path)
          }

          return resolve()
        })
        form.parse(source, (error, fields, files) => {
          if (error || !Object.keys(files).length) {
            reject(new RichError('Image source is broken', errorCodes.ERR_IMAGE_SOURCE_BROKEN))
          }
        })
      })
    } else {
      throw new RichError('Image source is broken', errorCodes.ERR_IMAGE_SOURCE_BROKEN)
    }

    return this
  }

  /**
   * This method is optional step for image processing.
   * @param {Object} transformer - sharp operations.
   * @return {Promise<Object, Error>} - return a current instance. Throw errors when file system troubles.
   */
  process (transformer) {
    return new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(this.target.path)

      readStream.on('open', () => {
        const writeStream = fs.createWriteStream(this.target.path)

        writeStream.on('error', reject)
        writeStream.on('finish', () => resolve(this))
        readStream
          .pipe(transformer)
          .pipe(writeStream)
      })
      readStream.on('error', reject)
    })
  }
}
