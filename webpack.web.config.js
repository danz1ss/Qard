const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const { GenerateSW } = require('workbox-webpack-plugin');

module.exports = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/web/index.tsx',
  target: 'web',
  output: {
    path: path.resolve(__dirname, 'dist/web'),
    filename: 'app.[contenthash].js',
    publicPath: '/',
    clean: true,
  },
  module: {
    rules: [
      { test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
      { test: /\.css$/, use: ['style-loader', 'css-loader'] },
      { test: /\.(woff2?|ttf|eot)$/, type: 'asset/resource', generator: { filename: 'fonts/[name][ext]' } },
    ],
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js', '.json'],
    fallback: { fs: false, path: false, crypto: false },
  },
  plugins: [
    new HtmlWebpackPlugin({ template: './src/web/index.html' }),
    new CopyWebpackPlugin({
      patterns: [
        { from: 'node_modules/sql.js/dist/sql-wasm.wasm', to: 'sql-wasm.wasm' },
        { from: 'src/web/manifest.webmanifest', to: 'manifest.webmanifest' },
        { from: 'src/web/icons', to: 'icons' },
      ],
    }),
    new webpack.DefinePlugin({
      __AI_PROXY_URL__: JSON.stringify(process.env.AI_PROXY_URL || 'http://localhost:8787'),
    }),
    ...(process.env.NODE_ENV === 'production'
      ? [
          new GenerateSW({
            swDest: 'sw.js',
            clientsClaim: true,
            skipWaiting: true,
            navigateFallback: '/index.html',
            maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
          }),
        ]
      : []),
  ],
  devServer: {
    static: path.resolve(__dirname, 'dist/web'),
    port: 8080,
    historyApiFallback: true,
  },
};
