// Same shape as the real config; env.variant picks the checking plugins.
//   --env variant=diagnostics-threadsnotset      (current: DiagnosticsPlugin, threads "auto")
//   --env variant=legacy           (ESLintPlugin + StyleLintPlugin + ForkTsChecker)
//   --env checksDisabled
//   --env siteName=site-0          (build one site only)
const path = require('path');
const fs = require('node:fs');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const DiagnosticsPlugin = require('diagnostics-webpack-plugin');
const ESLintPlugin = require('eslint-webpack-plugin');
const StyleLintPlugin = require('stylelint-webpack-plugin');
const ForkTsCheckerWebpackPlugin = require('fork-ts-checker-webpack-plugin');
const webpackMerge = require('./webpack-merge.js');
const MemoryUsageWebpackPlugin = require('./memory-usage-webpack-plugin');

console.info(`Node.js heap limit = ${require('v8').getHeapStatistics().heap_size_limit / (1024 * 1024)} MiB`);

const checks = {
  'diagnostics-threadsnotset': () => [
    new DiagnosticsPlugin({
      checks: [
        { use: 'eslint', extensions: ['ts', 'tsx'] },
        { use: 'stylelint', files: ['./src/**/*.scss'] },
        { use: 'typescript', skipLibCheck: true, transpileOnly: true },
      ]
    })
  ],
  'legacy': () => [
    new ESLintPlugin({ extensions: ['ts', 'tsx'] }),
    new StyleLintPlugin({ files: ['./src/**/*.scss'] }),
    new ForkTsCheckerWebpackPlugin()
  ],
};

const config = env => ({
  mode: 'development',
  devtool: false,
  output: {
    path: path.resolve(__dirname, 'bundles'),
    filename: '[name].bundle.js',
    chunkLoadingGlobal: 'loadChunkReact',
    clean: true
  },
  stats: 'errors-only',
  resolve: { extensions: ['.tsx', '.ts', '.js'] },
  module: {
    rules: [
      { test: /\.tsx?$/, loader: 'ts-loader', options: env.checksDisabled ? { transpileOnly: true } : {} },
      {
        test: /\.s?css$/,
        use: [
          { loader: MiniCssExtractPlugin.loader, options: { esModule: false } },
          { loader: 'css-loader', options: { esModule: false } },
          { loader: 'resolve-url-loader' },
          { loader: 'sass-loader', options: { sourceMap: true } }
        ]
      }
    ]
  },
  optimization: {
    runtimeChunk: { name: 'runtime/runtime' },
    splitChunks: {
      cacheGroups: {
        thirdparty: { test: /[\\/]node_modules[\\/]/, name: 'common/vendors', chunks: 'all' },
        infrastructure: { test: /src[\\/]infrastructure[\\/]/, name: 'common/infrastructure', chunks: 'all' }
      }
    }
  },
  plugins: [
    new MemoryUsageWebpackPlugin(),
    new MiniCssExtractPlugin({ filename: '[name].bundle.css' }),
    ...(env.checksDisabled ? [] : checks[env.variant || 'diagnostics-threadsnotset']())
  ],
  target: ['web', 'es2022']
});

const partConfigs = env =>
  fs.globSync('./src/**/webpack.part.config.js',
    env.siteName ? { exclude: f => /sites[\\/]/.test(f) && !f.includes(env.siteName) } : {})
    .map(x => require(path.resolve(x)));

module.exports = env => webpackMerge(config(env), ...partConfigs(env));