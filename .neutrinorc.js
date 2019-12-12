module.exports = {
  use: [
    '@neutrinojs/standardjs',
    [
      '@neutrinojs/library',
      {
        name: 'image-saver',
        target: 'node',
        libraryTarget: 'commonjs2',
        babel: {
          presets: [
            ['babel-preset-env', {
              targets: {
                node: '10'
              }
            }]
          ],
          'plugins': ['dynamic-import-node']
        }
      }
    ],
    '@neutrinojs/mocha',
    (neutrino) => {
      neutrino.config.when(process.env.NODE_ENV === 'production', (config) => {
        config.plugin('babel-minify')
          .tap(() => ([
            { removeConsole: true, removeDebugger: true },
            { sourceMap: '' }
          ]));
      });
    }
  ]
};
