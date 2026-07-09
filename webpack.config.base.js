/**
 * Base webpack config used across other specific configs
 */

const path = require('path');
const webpack = require('webpack');
const pkgDep = require('./package.json');

module.exports = {
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: [{ loader: 'ts-loader', options: { transpileOnly: true } }],
        exclude: /node_modules/,
      },
    ],
  },

  output: {
    path: path.join(__dirname, 'app'),
    // https://github.com/webpack/webpack/issues/1114
    libraryTarget: 'commonjs2',
  },

  resolve: {
    extensions: ['.js', '.jsx', '.json', '.ts', '.tsx'],
    modules: [path.join(__dirname, 'app'), 'node_modules'],
  },

  plugins: [
    new webpack.EnvironmentPlugin({ NODE_ENV: 'production' }),
    new webpack.DefinePlugin({
      PRODUCT_NAME: JSON.stringify(pkgDep.productName),
      COPYRIGHT: JSON.stringify(pkgDep.license),
      HOMEPAGE: JSON.stringify(pkgDep.homepage),
      DESCRIPTION: JSON.stringify(pkgDep.description),
      LICENSE: JSON.stringify(pkgDep.license),
      BUG_REPORT_URL: JSON.stringify(pkgDep.bugs.url),
      VERSION: JSON.stringify(pkgDep.version),
    }),
  ],
};
