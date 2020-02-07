import path from 'path'
import fs from 'fs'
import uuidv4 from 'uuid/v4'
import wget from 'wget-improved'
import jo from 'jpeg-autorotate'
import { IncomingForm } from 'formidable'
import sharp from 'sharp'
import { HttpError } from '@noname.team/errors'

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
     * @property {string} targetDir
     */
    this.targetDir = targetDir
    /**
     * @property {boolean} onlyReplacement
     */
    this.onlyReplacement = onlyReplacement
    /**
     * @property {?Object} sharp
     */
    this.sharp = null
    this.download = this.download.bind(this)
  }

  /**
   * This method is a step 1 of image saving.
   * @param {Object} config - input configuration.
   * @param {!(string|Object)} config.source - image source. String means that this is URL or you can provide an Object that is for Http Request instance
   * @param {?string} [config.targetFileName=`${uuidv4()}.jpg`] - is output file name.
   * @param {?boolean} config.skipProcessing - if you want to skip sharp initializing and you just need the file
   * @return {Promise<?Object, HttpError>} - return a Sharp object which you can handle in your way. Throw HttpError with a code 416 when this.onlyReplacement, but you are going to download a new file.
   */
  async download ({
    source,
    targetFileName = `${uuidv4()}.jpg`,
    skipProcessing
  }) {
    const targetPath = path.join(this.targetDir, targetFileName)

    switch (typeof source) {
      case 'string': {
        const sourceFileName = source.split('/')
          .pop()
          .split('?')[0]

        if (this.onlyReplacement && sourceFileName !== targetFileName) {
          throw new HttpError(416)
        }

        await download({ url: source, to: targetPath })
        break
      }
      default: {
        await new Promise((resolve, reject) => {
          const form = new IncomingForm({ uploadDir: this.targetDir, keepExtensions: true })

          form.on('file', async (_, file) => {
            let joResult

            if (this.onlyReplacement && file.name !== targetFileName) {
              return reject(new HttpError(416))
            }

            try {
              joResult = await jo.rotate(file.path)
              fs.writeFileSync(targetPath, joResult.buffer)
            } catch (error) {
              fs.renameSync(file.path, targetPath)
            }
            resolve()
          })
          form.on('error', reject)
          form.parse(source)
        })
        break
      }
    }

    this.sharp = skipProcessing ? null : sharp(targetPath)

    return this
  }
}
