import path from 'path'
import fs from 'fs'
import uuidv4 from 'uuid/v4'
import wget from 'wget-improved'
import jo from 'jpeg-autorotate'
import { IncomingForm } from 'formidable'
import { RichError } from '@noname.team/errors'
import { error_codes as errorCodes } from './const.json'

const download = ({
  url,
  to,
  extensions = ['jpg', 'png'],
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

  const extension = urlParsed.pathname.split('.')
    .pop()

  if (!extensions.includes(extension)) {
    return reject(new RichError('Unsupported image format', errorCodes.ERR_IMAGE_FORMAT_UNSUPPORTED))
  }

  wget.download(url, to, wgetOptions)
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
   * @param {?boolean} [config.onlyReplacement] - in case if you don't want to create a new file, e.g. limit case.
   * @param {?Array<string>} [config.validExtensions] - acceptable image extensions.
   * @return {Object} - an instance.
   */
  constructor ({
    targetDir,
    onlyReplacement,
    validExtensions
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
    this.onlyReplacement = onlyReplacement
    /** @property {boolean} */
    this.validExtensions = validExtensions

    this.download = this.download.bind(this)
    this.process = this.process.bind(this)
  }

  /**
   * This method is a firstable step of image saving.
   * @param {!(string|Object)} source - image source. String means that this is URL or you can provide an Object that is for Http Request instance
   * @param {?string} [targetFileName=`${uuidv4()}.jpg`] - is output file name.
   * @return {Promise<Object, Error>} - return a current instance. Throw an Error when this.onlyReplacement, and you are going to download a new file.
   */
  async download (source, targetFileName = `${uuidv4()}.jpg`) {
    this.target.fileName = targetFileName
    this.target.path = path.join(this.target.dir, this.target.fileName)

    switch (typeof source) {
      case 'string': {
        const sourceFileName = source.split('/')
          .pop()
          .split('?')[0]

        if (this.onlyReplacement && sourceFileName !== this.target.fileName) {
          throw new RichError('Images limit is reached', errorCodes.ERR_IMAGES_LIMIT_REACHED)
        }

        await download({
          url: source,
          to: this.target.path,
          extensions: this.validExtensions
        })
        break
      }
      default: {
        await new Promise((resolve, reject) => {
          const form = new IncomingForm({ uploadDir: this.target.dir, keepExtensions: true })

          form.on('file', async (_, file) => {
            let joResult

            if (this.onlyReplacement && file.name !== this.target.fileName) {
              return reject(new RichError('Images limit is reached', errorCodes.ERR_IMAGES_LIMIT_REACHED))
            }

            try {
              joResult = await jo.rotate(file.path)
              fs.writeFileSync(this.target.path, joResult.buffer)
            } catch (error) {
              fs.renameSync(file.path, this.target.path)
            }
            resolve()
          })
          form.on('error', reject)
          form.parse(source)
        })
        break
      }
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
