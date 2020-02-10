import ImageSaver from '../../src/index'

describe('Unit / index', () => {
  it('exports the ImageSaver class by default', () => {
    const saver = new ImageSaver({ targetDir: './' })

    expect(saver).to.be.an.instanceOf(ImageSaver)
  })
})
