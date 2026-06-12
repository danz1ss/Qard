const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const mainConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/main/index.ts',
  target: 'electron-main',
  externals: {
    electron: 'commonjs2 electron'
  },
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'index.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  node: {
    __dirname: false,
    __filename: false
  }
};

const preloadConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/main/preload.ts',
  target: 'electron-preload',
  externals: {
    electron: 'commonjs2 electron'
  },
  output: {
    path: path.resolve(__dirname, 'dist/main'),
    filename: 'preload.js'
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ]
  },
  resolve: {
    extensions: ['.ts', '.js']
  },
  node: {
    __dirname: false,
    __filename: false
  }
};

const rendererConfig = {
  mode: process.env.NODE_ENV || 'development',
  entry: './src/renderer/index.tsx',
  target: 'electron-renderer',
  output: {
    path: path.resolve(__dirname, 'dist/renderer'),
    filename: 'renderer.js'
  },
  module: {
    rules: [
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js']
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: './src/renderer/index.html'
    })
  ]
};

module.exports = [mainConfig, preloadConfig, rendererConfig];
