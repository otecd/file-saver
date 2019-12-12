import path from 'path'
import fs from 'fs'
import uuidv4 from 'uuid/v4'
import wget from 'node-wget'
import jo from 'jpeg-autorotate'
import { IncomingForm } from 'formidable'
import sharp from 'sharp'
import RichError from '@noname.team/rich-error'

const download = (url, dest) => new Promise((resolve, reject) => {
  const extension = url.split('.')
    .pop()
    .split('?')[0]

  if (!['jpg', 'png'].includes(extension)) {
    return reject(new RichError('Unsupported image format. Please, upload only JPG, PNG file.', 415, RichError.codes.UNSUPPORTED_IMAGE_TYPE))
  }
  return wget(
    { url, dest, timeout: 10000 },
    (error, response) => error ? reject(error) : resolve(response)
  )
})

export default class ImageSaver {
  constructor ({
    url,
    request,
    onlyReplacement,
    blur,
    uploadDir
  } = {}) {
    if (url) {
      const newFileName = `${uuidv4(url)}.jpg`

      if (blur) {
        const tempFilePath = path.join(uploadDir, `temp_${newFileName}`)

        return download(url, tempFilePath)
          .then(() => sharp(tempFilePath)
            .resize(100, 100)
            .blur(3)
            .jpeg({ quality: 60 })
            .toFile(path.join(uploadDir, newFileName)))
          .then(() => {
            fs.unlink(tempFilePath, () => {})

            return newFileName
          })
      }

      return download(url, path.join(uploadDir, newFileName))
        .then(() => newFileName)
    }

    if (request) {
      return new Promise((resolve, reject) => {
        const form = new IncomingForm({ uploadDir, keepExtensions: true })

        form.on('file', (_, file) => {
          if (file.name === 'temp.jpg' && onlyReplacement) {
            return reject(new RichError('Images limit is reached', 416, RichError.codes.REACHED_IMAGES_LIMIT))
          }

          const oldFileName = file.name !== 'temp.jpg' && file.name
          const newFileName = `${uuidv4()}.jpg`
          const resultCb = (error) => {
            if (error) {
              reject(error)
            } else {
              if (oldFileName) {
                fs.unlink(path.join(uploadDir, oldFileName), () => resolve({ newFileName, oldFileName }))
              } else {
                resolve({ newFileName })
              }
            }
          }

          jo.rotate(file.path, { quality: 90 })
            .then(({ buffer }) => {
              fs.writeFile(path.join(uploadDir, newFileName), buffer, resultCb)
            })
            .catch(() => {
              fs.rename(file.path, path.join(uploadDir, newFileName), resultCb)
            })
        })
        form.on('error', reject)
        form.parse(request)
      })
    }

    return false
  }
}
