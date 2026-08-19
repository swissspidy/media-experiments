/**
 * External dependencies
 */
import { createRequire } from 'node:module';
import globals from 'globals';
import oxlint from 'eslint-plugin-oxlint';
import reactHooks from 'eslint-plugin-react-hooks';

const require = createRequire( import.meta.url );

/**
 * WordPress dependencies
 */
const wordpress = require( '@wordpress/eslint-plugin' );

/**
 * ESLint v10 refuses to redefine a plugin under the same key unless the
 * reference is identical. The `@wordpress/eslint-plugin` configs are assembled
 * from sub-configs that each carry their own copy of the plugin object, so
 * normalise them to a single shared reference before spreading.
 *
 * @param {Object[]} configs Flat config array.
 * @return {Object[]} The same array with plugin references deduplicated.
 */
function dedupePlugins( configs ) {
	const seen = Object.create( null );
	for ( const config of configs ) {
		if ( ! config.plugins ) {
			continue;
		}
		for ( const name of Object.keys( config.plugins ) ) {
			if ( name in seen ) {
				config.plugins[ name ] = seen[ name ];
			} else {
				seen[ name ] = config.plugins[ name ];
			}
		}
	}
	return configs;
}

export default [
	{
		ignores: [
			'artifacts/**',
			'build/**',
			'dist/**',
			'packages/*/dist/**',
			'packages/*/dist-types/**',
			'node_modules/**',
			'vendor/**',
		],
	},
	...dedupePlugins( [
		...wordpress.configs.recommended,
		...wordpress.configs.i18n,
		...oxlint.configs[ 'flat/all' ],
	] ),
	/*
	 * React Compiler diagnostics. These used to come from the standalone
	 * `eslint-plugin-react-compiler`, which React Compiler 1.0 folded into
	 * `eslint-plugin-react-hooks` as individual rules.
	 */
	reactHooks.configs.flat.recommended,
	{
		rules: {
			// Matches the previous `validateRefAccessDuringRender: false`.
			'react-hooks/refs': 'off',
		},
	},
	{
		languageOptions: {
			globals: {
				...globals.browser,
				FFMPEG_CDN_URL: 'readonly',
				MEDIAPIPE_CDN_URL: 'readonly',
				PDFJS_CDN_URL: 'readonly',
			},
			parserOptions: {
				requireConfigFile: false,
				babelOptions: {
					presets: [ '@wordpress/babel-preset-default' ],
				},
				warnOnUnsupportedTypeScriptVersion: false,
			},
		},
		settings: {
			'import/resolver': '@mexp/eslint-import-resolver',
		},
		rules: {
			'@wordpress/dependency-group': 'error',
			'@wordpress/no-unused-vars-before-return': [
				'error',
				{ excludePattern: '^use' },
			],
			'@wordpress/i18n-no-flanking-whitespace': 'error',
			'@wordpress/i18n-text-domain': [
				'error',
				{ allowedTextDomain: 'media-experiments' },
			],
			eqeqeq: 'error',
			camelcase: [
				'error',
				{
					allow: [
						'__webpack_.*__',
						'WP_REST_API_.*',
						'featured_media',
						'alt_text',
						'source_url',
						'mime_type',
						'mexp_.*',
						'image_size',
						'site_icon',
						'site_logo',
						'generate_sub_sizes',
						'convert_format',
						'upload_request',
						'[a-z]+_outputFormat',
						'[a-z]+_quality',
						'[a-z]+_interlaced',
						'gif_convert',
						'media_details',
						'option_string',
					],
				},
			],
		},
	},
	{
		files: [ 'tests/e2e/specs/**/*.ts' ],
		...wordpress.configs[ 'test-playwright' ].reduce(
			( acc, config ) => ( {
				...acc,
				...config,
				plugins: { ...acc.plugins, ...config.plugins },
				rules: { ...acc.rules, ...config.rules },
			} ),
			{}
		),
	},
	{
		files: [ 'tests/e2e/specs/**/*.ts' ],
		rules: { 'playwright/no-skipped-test': 'off' },
	},
	{
		// Playwright fixtures take a `use` callback, which is not a React hook.
		files: [ 'tests/e2e/fixtures/**/*.ts' ],
		rules: { 'react-hooks/rules-of-hooks': 'off' },
	},
	...wordpress.configs[ 'test-unit' ].map( ( config ) => ( {
		...config,
		files: [ 'tests/js/**/*.js', 'packages/*/src/**/test/**/*.[jt]s?(x)' ],
	} ) ),
];
