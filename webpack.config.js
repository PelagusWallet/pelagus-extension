const path = require("path")
const webpack = require("webpack")
const { merge: webpackMerge } = require("webpack-merge")
const Dotenv = require("dotenv-webpack")
const TerserPlugin = require("terser-webpack-plugin")
const LiveReloadPlugin = require("webpack-livereload-plugin")
const CopyPlugin = require("copy-webpack-plugin")
const ForkTsCheckerWebpackPlugin = require("fork-ts-checker-webpack-plugin")
require("dotenv-defaults/config")

const supportedBrowsers = ["chrome"]

// Replicated and adjusted for each target browser and the current build mode.
const baseConfig = {
  devtool: "source-map",
  stats: "errors-only",
  entry: {
    popup: "./src/popup.ts",
    tab: "./src/tab.ts",
    background: "./src/background.ts",
    offscreen: "./src/offscreen.ts",
    "window-provider": "./src/window-provider.ts",
    "provider-bridge": "./src/provider-bridge.ts",
  },
  module: {
    rules: [
      {
        test: /\.(tsx|ts|jsx)?$/,
        exclude: /node_modules(?!\/@pelagus-provider)|webpack/,
        use: [
          {
            loader: "babel-loader",
            options: {
              cacheDirectory: true,
            },
          },
        ],
      },
    ],
  },
  output: {
    // path: is set browser-specifically below
    filename: "[name].js",
    hashFunction: "xxhash64",
  },
  resolve: {
    extensions: [".tsx", ".ts", ".js", ".jsx"],
    fallback: {
      stream: require.resolve("stream-browserify"),
      process: require.resolve("process/browser"),
      crypto: require.resolve("crypto-browserify"),
    },
  },
  plugins: [
    new Dotenv({
      defaults: true,
      systemvars: true,
      safe: true,
    }),
    new ForkTsCheckerWebpackPlugin({
      typescript: {
        diagnosticOptions: {
          semantic: true,
          syntactic: true,
        },
        mode: "write-references",
      },
    }),
    // polyfill the process and Buffer APIs
    new webpack.ProvidePlugin({
      Buffer: ["buffer", "Buffer"],
      process: ["process"],
    }),
    new CopyPlugin({
      patterns: [
        {
          from: "node_modules/@pelagus/pelagus-ui/public/",
        },
      ],
    }),
    new webpack.DefinePlugin({
      "process.env.VERSION": JSON.stringify(process.env.npm_package_version),
    }),
  ],
  optimization: {
    splitChunks: { automaticNameDelimiter: "-" },
  },
}

// Configuration adjustments for specific build modes, customized by browser.
const modeConfigs = {
  development: {
    plugins: [new LiveReloadPlugin()],
  },
  production: {
    optimization: {
      minimize: true,
      minimizer: [
        new TerserPlugin({
          terserOptions: {
            format: {
              comments: false,
            },
          },
          extractComments: false,
        }),
      ],
    },
  },
}

// Browser-specific configuration adjustments.
const browserConfigs = {
  chrome: {
    output: {
      path: path.resolve(__dirname, "dist/chrome"),
    },
    plugins: [
      new CopyPlugin({
        patterns: [
          {
            from: "manifest/manifest.json",
            to: "manifest.json",
          },
        ],
      }),
    ],
  },
}

// Build configuration for each supported browser and mode.
const configs = []

supportedBrowsers.forEach((browser) => {
  Object.keys(modeConfigs).forEach((mode) => {
    const config = webpackMerge(
      baseConfig,
      modeConfigs[mode],
      browserConfigs[browser],
      {
        mode,
        name: `${browser}-${mode}`,
      }
    )
    configs.push(config)
  })
})

module.exports = configs 