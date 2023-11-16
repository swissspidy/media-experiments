const { resolve } = require( 'path' );
const RtlCssPlugin = require( 'rtlcss-webpack-plugin' );
const MiniCSSExtractPlugin = require( 'mini-css-extract-plugin' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: {
		'media-experiments': resolve(
			__dirname,
			'packages/edit-post/src/index.ts'
		),
	},
	output: {
		filename: '[name].js',
		path: resolve( __dirname, 'build' ),
	},
	module: {
		...defaultConfig.module,
		// Avoid having to provide full file extension for imports in jSquash packages.
		// See https://webpack.js.org/configuration/module/#resolvefullyspecified
		// See https://github.com/jamsinclair/jSquash/issues/38
		rules: [
			...defaultConfig.module.rules,
			{
				test: /\.m?js/,
				resolve: {
					fullySpecified: false,
				},
			},
		],
	},
	resolve: {
		extensions: [ '.jsx', '.ts', '.tsx', '...' ],
		// Avoid having to provide full file extension for imports.
		// See https://webpack.js.org/configuration/module/#resolvefullyspecified
		fullySpecified: false,
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
			( plugin ) => ! ( plugin instanceof MiniCSSExtractPlugin )
		),
		new MiniCSSExtractPlugin( { filename: 'media-experiments.css' } ),
		new RtlCssPlugin( {
			filename: `../build/media-experiments-rtl.css`,
		} ),
	],
};
