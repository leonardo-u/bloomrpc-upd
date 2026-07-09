/**
 * Webpack config for production electron main process
 */

const webpack = require('webpack');
const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const baseConfig = require('./webpack.config.base');
const CheckNodeEnv = require('./internals/scripts/CheckNodeEnv');

CheckNodeEnv('production');

module.exports = merge(baseConfig, {
  devtool: 'source-map',
  mode: 'production',
  target: 'electron-main',

  entry: './app/main.dev',

  output: {
    path: __dirname,
    filename: './app/main.prod.js',
  },

  optimization: {
    minimizer: [new TerserPlugin({ parallel: true })],
  },

  plugins: [
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true',
    }),
    new webpack.EnvironmentPlugin({
      NODE_ENV: 'production',
      DEBUG_PROD: 'false',
    }),
    new webpack.DefinePlugin({
      __static: `process.resourcesPath + "/static"`,
    }),
  ],

  node: {
    __dirname: false,
    __filename: false,
  },
});
