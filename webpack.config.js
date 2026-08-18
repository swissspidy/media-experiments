/**
 * External dependencies
 */
const { resolve, dirname, basename } = require( 'node:path' );

const { DefinePlugin } = require( 'webpack' );
const MiniCSSExtractPlugin = require( 'mini-css-extract-plugin' );
const { WebWorkerPlugin } = require( '@shopify/web-worker/webpack' );
/**
 * WordPress dependencies
 */
const DependencyExtractionWebpackPlugin = require( '@wordpress/dependency-extraction-webpack-plugin' );
const {
	defaultRequestToExternal,
	defaultRequestToHandle,
} = require( '@wordpress/dependency-extraction-webpack-plugin/lib/util' );
const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );
const { hasBabelConfig, hasArgInCLI } = require( '@wordpress/scripts/utils' );

/*
 * WordPress packages that are not (yet) shipped with WordPress core and
 * therefore have no `wp-*` script handle to depend on. They have to be
 * bundled instead of turned into an external.
 */
const BUNDLED_WORDPRESS_PACKAGES = [
	'@wordpress/vips',
	'@wordpress/worker-threads',
];

/**
 * Decides whether a module request becomes a WordPress script external.
 *
 * Returning `undefined` normally makes the plugin fall back to its own
 * defaults, so those defaults are applied here instead and `useDefaults` is
 * turned off. That way `undefined` really does mean "bundle this".
 *
 * @param {string} request Module request.
 * @return {string|string[]|undefined} External definition, or `undefined` to bundle.
 */
function requestToExternal( request ) {
	if (
		BUNDLED_WORDPRESS_PACKAGES.some(
			( pkg ) => request === pkg || request.startsWith( `${ pkg }/` )
		)
	) {
		return undefined;
	}

	return defaultRequestToExternal( request );
}

/**
 * Maps a module request to the WordPress script handle it depends on.
 *
 * Needed because `useDefaults` is turned off for `requestToExternal`.
 *
 * @param {string} request Module request.
 * @return {string|undefined} Script handle.
 */
function requestToHandle( request ) {
	return defaultRequestToHandle( request );
}

const isProduction = process.env.NODE_ENV === 'production';
const hasReactFastRefresh = hasArgInCLI( '--hot' ) && ! isProduction;

const {
	version: mediaPipeVersion,
	// eslint-disable-next-line import/no-extraneous-dependencies
} = require( '@mediapipe/selfie_segmentation/package.json' );

// eslint-disable-next-line import/no-extraneous-dependencies
const { version: pdfJsVersion } = require( 'pdfjs-dist/package.json' );

// eslint-disable-next-line import/no-extraneous-dependencies
const { version: ffmpegVersion } = require( '@ffmpeg/core/package.json' );

const mediapipeCdnUrl = `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@${ mediaPipeVersion }`;
const pdfJsCdnUrl = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${ pdfJsVersion }/build/pdf.worker.mjs`;
const ffmpegCdnUrl = `https://cdn.jsdelivr.net/npm/@ffmpeg/core@${ ffmpegVersion }/dist/ffmpeg-core.js`;

module.exports = {
	...defaultConfig,
	entry: {
		'media-experiments': resolve(
			__dirname,
			'packages/editor/src/index.ts'
		),
		'view-upload-request': resolve(
			__dirname,
			'packages/view-upload-request/src/index.tsx'
		),
	},
	output: {
		filename: '[name].js',
		// TODO: Maybe make [chunkhash] a part of the filename?
		chunkFilename: '[name].js?v=[chunkhash]',
		path: resolve( __dirname, 'build' ),
		globalObject: 'self', // This is the default, but required for @shopify/web-worker.
	},
	resolve: {
		// Ensure "require" has a higher priority when matching export conditions.
		// https://webpack.js.org/configuration/resolve/#resolveconditionnames
		// https://github.com/kleisauke/wasm-vips/issues/50#issuecomment-1664118137
		conditionNames: [ 'require', 'import' ],
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
	module: {
		rules: [
			{
				test: /\.([jt])sx?$/,
				exclude: /node_modules/,
				use: [
					{
						loader: require.resolve( 'babel-loader' ),
						options: {
							// Babel uses a directory within local node_modules
							// by default. Use the environment variable option
							// to enable more persistent caching.
							cacheDirectory:
								process.env.BABEL_CACHE_DIRECTORY || true,

							// Provide a fallback configuration if there's not
							// one explicitly available in the project.
							...( ! hasBabelConfig() && {
								babelrc: false,
								configFile: false,
								presets: [
									require.resolve(
										'@wordpress/babel-preset-default'
									),
								],
								plugins: [
									require.resolve(
										'@shopify/web-worker/babel'
									),
									hasReactFastRefresh &&
										require.resolve(
											'react-refresh/babel'
										),
									require.resolve( '@mexp/log/babel-plugin' ),
								].filter( Boolean ),
							} ),
						},
					},
				],
			},
			{
				test: /\.wasm$/,
				type: 'asset/inline',
			},
			...defaultConfig.module.rules.slice( 1 ),
		],
	},
	plugins: [
		...defaultConfig.plugins.filter(
			( plugin ) =>
				! ( plugin instanceof MiniCSSExtractPlugin ) &&
				! ( plugin instanceof DependencyExtractionWebpackPlugin )
		),
		new DependencyExtractionWebpackPlugin( {
			requestToExternal,
			requestToHandle,
			useDefaults: false,
		} ),
		new WebWorkerPlugin(),
		new MiniCSSExtractPlugin( {
			filename: '[name].css',
		} ),
		new DefinePlugin( {
			FFMPEG_CDN_URL: JSON.stringify( ffmpegCdnUrl ),
			MEDIAPIPE_CDN_URL: JSON.stringify( mediapipeCdnUrl ),
			PDFJS_CDN_URL: JSON.stringify( pdfJsCdnUrl ),
		} ),
	],
	optimization: {
		...defaultConfig.optimization,
		splitChunks: {
			...defaultConfig.optimization.splitChunks,
			cacheGroups: {
				editor: {
					type: 'css/mini-extract',
					test: /[\\/]editor\.css$/,
					chunks: ( chunk ) => {
						return chunk.name === 'media-experiments';
					},
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
				view: {
					type: 'css/mini-extract',
					test: /[\\/]view\.css$/,
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
