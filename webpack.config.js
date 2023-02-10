const { resolve } = require('path');
const RtlCssPlugin = require('rtlcss-webpack-plugin');
const MiniCSSExtractPlugin = require('mini-css-extract-plugin');
const defaultConfig = require('@wordpress/scripts/config/webpack.config');

module.exports = {
	...defaultConfig,
	output: {
		filename: 'media-experiments.js',
		path: resolve(process.cwd(), 'build'),
	},
	resolve: {
		extensions: ['.jsx', '.ts', '.tsx', '...'],
		fallback: {
			crypto: false,
			path: false,
			util: false,
			zlib: false,
			assert: false,
			stream: false,
			fs: false,
		},
	},
	plugins: [
		...defaultConfig.plugins.filter(
			(plugin) => !(plugin instanceof MiniCSSExtractPlugin)
		),
		new MiniCSSExtractPlugin({ filename: 'media-experiments.css' }),
		new RtlCssPlugin({
			filename: `../build/media-experiments-rtl.css`,
		}),
	],
};
