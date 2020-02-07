import path from 'path'
import fs from 'fs'
import uuidv4 from 'uuid/v4'
import wget from 'wget-improved'
import jo from 'jpeg-autorotate'
import { IncomingForm } from 'formidable'
import { HttpError, RichError } from '@noname.team/errors'

const download = ({
  url,
  to,
  extensions = ['jpg', 'png'],
  onStart = fileSize => fileSize,
  onProgress = progress => progress,
  wgetOptions = {}
}) => new Promise((resolve, reject) => {
  const extension = url.split('.')
    .pop()
    .split('?')[0]

  if (!extensions.includes(extension)) {
    return reject(new HttpError(415))
  }

  wget.download(url, to, wgetOptions)
    .on('error', reject)
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
   * @return {Object} - an instance.
   */
  constructor ({ targetDir, onlyReplacement } = {}) {
    /**
     * @type {Object}
     * @property {string} target.dir
     * @property {string} target.path
     */
    this.target = {
      dir: targetDir,
      path: ''
    }
    /** @property {boolean} */
    this.onlyReplacement = onlyReplacement

    this.download = this.download.bind(this)
    this.process = this.process.bind(this)
  }

  /**
   * This method is a firstable step of image saving.
   * @param {Object} config - input configuration.
   * @param {!(string|Object)} config.source - image source. String means that this is URL or you can provide an Object that is for Http Request instance
   * @param {?string} [config.targetFileName=`${uuidv4()}.jpg`] - is output file name.
   * @return {Promise<Object, HttpError>} - return a current instance. Throw HttpError with a code 416 when this.onlyReplacement, but you are going to download a new file.
   */
  async download ({ source, targetFileName = `${uuidv4()}.jpg` }) {
    this.target.path = path.join(this.target.dir, targetFileName)

    switch (typeof source) {
      case 'string': {
        const sourceFileName = source.split('/')
          .pop()
          .split('?')[0]

        if (this.onlyReplacement && sourceFileName !== targetFileName) {
          throw new RichError('Images limit is reached', 'ERR_IMAGES_LIMIT_REACHED')
        }

        await download({ url: source, to: this.target.path })
        break
      }
      default: {
        await new Promise((resolve, reject) => {
          const form = new IncomingForm({ uploadDir: this.target.dir, keepExtensions: true })

          form.on('file', async (_, file) => {
            let joResult

            if (this.onlyReplacement && file.name !== targetFileName) {
              return reject(new RichError('Images limit is reached', 'ERR_IMAGES_LIMIT_REACHED'))
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
   * @return {Promise<Object, HttpError>} - return a current instance. Throw errors when file system troubles.
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
