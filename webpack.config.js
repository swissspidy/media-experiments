const { resolve, dirname, basename } = require( 'path' );
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
	resolve: {
		extensions: [ '.jsx', '.ts', '.tsx', '...' ],
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
		new MiniCSSExtractPlugin( {
			filename: '[name].css',
		} ),
		new RtlCssPlugin( {
			filename: `../build/[name]-rtl.css`,
		} ),
	],
	optimization: {
		...defaultConfig.optimization,
		splitChunks: {
			...defaultConfig.optimization.splitChunks,
			cacheGroups: {
				editor: {
					type: 'css/mini-extract',
					test: /[\\/]styles\.css$/,
					chunks: 'all',
					enforce: true,
					name( _, chunks, cacheGroupKey ) {
						const chunkName = chunks[ 0 ].name;
						return `${ dirname( chunkName ) }/${ basename(
							chunkName
						) }-${ cacheGroupKey }`;
					},
				},
				blocks: {
					type: 'css/mini-extract',
					test: /[\\/]blocks\.css$/,
					chunks: 'all',
					enforce: true,
					name( _, chunks, cacheGroupKey ) {
						const chunkName = chunks[ 0 ].name;
						return `${ dirname( chunkName ) }/${ basename(
							chunkName
						) }-${ cacheGroupKey }`;
					},
				},
				default: false,
			},
		},
	},
};
