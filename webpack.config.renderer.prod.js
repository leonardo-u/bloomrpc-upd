/**
 * Build config for production electron renderer process
 */

const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin');
const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
const CopyPlugin = require('copy-webpack-plugin');
const { merge } = require('webpack-merge');
const TerserPlugin = require('terser-webpack-plugin');
const baseConfig = require('./webpack.config.base');
const CheckNodeEnv = require('./internals/scripts/CheckNodeEnv');

CheckNodeEnv('production');

module.exports = merge(baseConfig, {
  devtool: 'source-map',
  mode: 'production',
  target: 'electron-renderer',

  entry: {
    app: './app/index',
    about: './app/about/about-window-renderer',
  },

  output: {
    path: path.join(__dirname, 'app/dist'),
    publicPath: './dist/',
    filename: '[name].renderer.prod.js',
  },

  module: {
    rules: [
      {
        test: /\.global\.css$/,
        use: [
          { loader: MiniCssExtractPlugin.loader, options: { publicPath: './' } },
          { loader: 'css-loader', options: { sourceMap: true } },
        ],
      },
      {
        test: /^((?!\.global).)*\.css$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          {
            loader: 'css-loader',
            options: {
              modules: { localIdentName: '[name]__[local]__[hash:base64:5]' },
              sourceMap: true,
            },
          },
        ],
      },
      {
        test: /\.global\.(scss|sass)$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          { loader: 'css-loader', options: { sourceMap: true, importLoaders: 1 } },
          { loader: 'sass-loader', options: { sourceMap: true, api: 'modern' } },
        ],
      },
      {
        test: /^((?!\.global).)*\.(scss|sass)$/,
        use: [
          { loader: MiniCssExtractPlugin.loader },
          {
            loader: 'css-loader',
            options: {
              modules: { localIdentName: '[name]__[local]__[hash:base64:5]' },
              importLoaders: 1,
              sourceMap: true,
            },
          },
          { loader: 'sass-loader', options: { sourceMap: true, api: 'modern' } },
        ],
      },
      {
        test: /\.(woff2?|ttf|eot|otf)(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/inline',
      },
      {
        test: /\.svg(\?v=\d+\.\d+\.\d+)?$/,
        type: 'asset/inline',
        generator: { dataUrl: { mimetype: 'image/svg+xml' } },
      },
      {
        test: /\.(?:ico|gif|png|jpg|jpeg|webp)$/,
        type: 'asset/inline',
      },
    ],
  },

  optimization: {
    minimizer: [
      new TerserPlugin({ parallel: true }),
      new CssMinimizerPlugin(),
    ],
  },

  plugins: [
    new webpack.EnvironmentPlugin({ NODE_ENV: 'production' }),
    new MiniCssExtractPlugin({ filename: 'style.css' }),
    new CopyPlugin({
      patterns: [{ from: './app/about/about.css', to: 'about.css' }],
    }),
    new BundleAnalyzerPlugin({
      analyzerMode: process.env.OPEN_ANALYZER === 'true' ? 'server' : 'disabled',
      openAnalyzer: process.env.OPEN_ANALYZER === 'true',
    }),
    new webpack.DefinePlugin({
      __static: `process.resourcesPath + "/static"`,
    }),
  ],
});
