import path from 'path'
import fs from 'fs'
import uuidv4 from 'uuid/v4'
import wget from 'node-wget'
import jo from 'jpeg-autorotate'
import { IncomingForm } from 'formidable'
import sharp from 'sharp'
import RichError from 'luna-rich-error'

const codes = {
  UNSUPPORTED_IMAGE_TYPE: 'UNSUPPORTED_IMAGE_TYPE',
  REACHED_IMAGES_LIMIT: 'REACHED_IMAGES_LIMIT'
}
const download = (url, dest) => new Promise((resolve, reject) => {
  const extension = url.split('.')
    .pop()
    .split('?')[0]

  if (!['jpg', 'png'].includes(extension)) {
    return reject(new RichError('Unsupported image format. Please, upload only JPG, PNG file.', 415, codes.UNSUPPORTED_IMAGE_TYPE))
  }
  return wget(
    { url, dest, timeout: 10000 },
    (error, response) => error ? reject(error) : resolve(response)
  )
})

export const saveRemote = (imgUrl) => {
  const newFileName = `${uuidv4(imgUrl)}.jpg`

  return download(imgUrl, path.join(__dirname, '../img', newFileName))
    .then(() => newFileName)
}

export const saveBlurredRemote = (imgUrl) => {
  const newFileName = `${uuidv4(imgUrl)}.jpg`
  const tempFilePath = path.join(__dirname, '../img', `temp_${newFileName}`)

  return download(imgUrl, tempFilePath)
    .then(() => sharp(tempFilePath)
      .resize(100, 100)
      .blur(3)
      .jpeg({ quality: 60 })
      .toFile(path.join(__dirname, '../img', newFileName)))
    .then(() => {
      fs.unlink(tempFilePath, () => {})

      return newFileName
    })
}

export const saveInput = (request, imagesAmount) => new Promise((resolve, reject) => {
  const form = new IncomingForm({ uploadDir: path.join(__dirname, '../img'), keepExtensions: true })

  form.on('file', (_, file) => {
    if (file.name === 'temp.jpg' && imagesAmount === 6) {
      return reject(new RichError('Images limit is reached', 416, codes.REACHED_IMAGES_LIMIT))
    }

    const oldFileName = file.name !== 'temp.jpg' && file.name
    const newFileName = `${uuidv4()}.jpg`

    jo.rotate(file.path, { quality: 90 })
      .then(({ buffer }) => {
        fs.writeFile(path.join(__dirname, '../img', newFileName), buffer, (error) => {
          if (error) {
            return reject(error)
          }
          return oldFileName
            ? fs.unlink(path.join(__dirname, '../img', oldFileName), () => resolve({ newFileName, oldFileName }))
            : resolve({ newFileName })
        })
      })
      .catch(() => {
        fs.rename(
          file.path,
          path.join(__dirname, '../img', newFileName),
          (error) => {
            if (error) {
              reject(error)
            } else {
              if (oldFileName) {
                fs.unlink(path.join(__dirname, '../img', oldFileName), () => resolve({ newFileName, oldFileName }))
              } else {
                resolve({ newFileName })
              }
            }
          }
        )
      })
  })
  form.on('error', reject)
  form.parse(request)
})
