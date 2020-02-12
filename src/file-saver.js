import path from 'path'
import fs from 'fs'
import { IncomingMessage } from 'http'
import uuidv4 from 'uuid/v4'
import { IncomingForm } from 'formidable'
import { RichError } from '@noname.team/errors'
import { downloadFileByURL } from '@noname.team/helpers/for/server'
import { error_codes as errorCodes } from './const.json'

/**
 * FileSaver class. Use it for files downloading and storing wherever you want.
 */
export default class FileSaver {
  /**
   * @param {Object} config - input configuration.
   * @param {!string} config.targetDir - is output system directory.
   * @param {?Array<string>} [config.validExtensions] - acceptable file extensions.
   * @return {Object} - an instance.
   */
  constructor ({ targetDir, validExtensions } = {}) {
    if (!targetDir) {
      throw new RichError('Required argument is missed', errorCodes.ERR_REQUIRED_ARGUMENT_MISSED)
    }

    /** @type {string} */
    this.targetDir = targetDir
    /** @type {boolean} */
    this.validExtensions = validExtensions || []

    this.download = this.download.bind(this)
  }

  /**
   * This method is a firstable step of image saving.
   * @param {!(string|Object)} source - image source. String means that this is URL or you can provide an Object that is for Http Request instance
   * @param {?string} [targetName=uuidv4()] - is output file name w/o extension.
   * @return {Promise<Object, Error>} - return a current instance.
   * @todo support multiple files by a single call
   */
  async download (source, targetName = uuidv4()) {
    if (!source) {
      throw new RichError('Required argument is missed', errorCodes.ERR_REQUIRED_ARGUMENT_MISSED)
    }

    let targetPath
    let targetFileName

    if (typeof source === 'string') {
      let urlParsed

      try {
        urlParsed = new URL(source)
      } catch (error) {
        throw new RichError(error.message || 'File source is broken', errorCodes.ERR_FILE_SOURCE_BROKEN)
      }

      const sourceFileName = urlParsed.pathname.split('/')
        .pop()
      const extension = sourceFileName.split('.')
        .pop()

      if (!this.validExtensions.includes(extension)) {
        throw new RichError('Unsupported file format', errorCodes.ERR_FILE_FORMAT_UNSUPPORTED)
      }

      targetFileName = `${targetName}.${extension}`
      targetPath = path.join(this.targetDir, targetFileName)

      try {
        await downloadFileByURL({ url: source, to: targetPath })
      } catch (error) {
        try {
          fs.unlinkSync(targetPath)
        } catch (errorUnlink) {
        }
        throw error
      }
    } else if (source instanceof IncomingMessage) {
      await new Promise((resolve, reject) => {
        const form = new IncomingForm({ uploadDir: this.targetDir, keepExtensions: true })

        form.on('file', async (_, file) => {
          const extension = file.name.split('.')
            .pop()

          if (!this.validExtensions.includes(extension)) {
            try {
              fs.unlinkSync(file.path)
            } catch (errorUnlink) {
            }
            return reject(new RichError('Unsupported file format', errorCodes.ERR_FILE_FORMAT_UNSUPPORTED))
          }

          targetFileName = `${targetName}.${extension}`
          targetPath = path.join(this.targetDir, targetFileName)
          fs.renameSync(file.path, targetPath)

          return resolve()
        })
        form.parse(source, (error, fields, files) => {
          if (error || !Object.keys(files).length) {
            throw new RichError('File source is broken', errorCodes.ERR_FILE_SOURCE_BROKEN)
          }
        })
      })
    } else {
      throw new RichError('File source is broken', errorCodes.ERR_FILE_SOURCE_BROKEN)
    }

    return targetFileName
  }
}
