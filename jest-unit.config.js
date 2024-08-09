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
};
