import ImageSaver from '../../src/image-saver'

describe('Unit / image-saver', () => {
  it('exports the ImageSaver class by default', () => {
    const saver = new ImageSaver({ targetDir: './' })

    expect(saver).to.be.an.instanceOf(ImageSaver)
  })
})
