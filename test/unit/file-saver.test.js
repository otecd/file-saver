import FileSaver from '../../src/file-saver'

describe('Unit / file-saver', () => {
  it('exports the FileSaver class by default', () => {
    const saver = new FileSaver({ targetDir: './' })

    expect(saver).to.be.an.instanceOf(FileSaver)
  })
})
