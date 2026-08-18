/**
 * WordPress dependencies
 */
const defaultConfig = require( '@wordpress/scripts/config/jest-unit.config' );

module.exports = {
	...defaultConfig,
	testEnvironment: '<rootDir>/tests/js/environment.ts',
	setupFiles: [ '<rootDir>/tests/js/setup-globals.js' ],
	testPathIgnorePatterns: [
		'/.git/',
		'/node_modules/',
		'<rootDir>/vendor/',
		'<rootDir>/.*/dist/',
		'<rootDir>/.*/dist-types/',
	],
	coverageReporters: [ 'lcov' ],
	coverageDirectory: '<rootDir>/artifacts/logs',
	collectCoverageFrom: [ '<rootDir>/packages/*/src/**', '!**/test/**' ],
	coveragePathIgnorePatterns: [ '/@types/' ],
	globals: {
		SCRIPT_DEBUG: true,
		FFMPEG_CDN_URL: 'https://example.com',
		MEDIAPIPE_CDN_URL: 'https://example.com',
		PDFJS_CDN_URL: 'https://example.com',
	},
	moduleNameMapper: {
		'.+\\.wasm$': '<rootDir>/tests/js/wasm-stub.js',
	},
	/*
	 * These dependencies are published as ESM only, so Jest has to transform
	 * them instead of skipping everything under `node_modules`. The default
	 * transform only covers `.js`/`.ts`, hence the added `.mjs` entry.
	 */
	transform: {
		...defaultConfig.transform,
		'\\.mjs$': require.resolve(
			'@wordpress/scripts/config/babel-transform'
		),
	},
	/*
	 * `.*` before the allowlist (rather than anchoring right after
	 * `node_modules/`) so this also matches these packages when npm nests a
	 * second copy inside another package's own `node_modules/`, e.g.
	 * `node_modules/@wordpress/ui/node_modules/@wordpress/theme/`.
	 */
	transformIgnorePatterns: [
		'node_modules/(?!.*(mime|uuid|@wordpress/theme)/)',
	],
};
