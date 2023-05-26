const defaultConfig = require('@wordpress/scripts/config/jest-unit.config');

module.exports = {
	...defaultConfig,
	testPathIgnorePatterns: [
		'/.git/',
		'/node_modules/',
		'<rootDir>/vendor/',
		'<rootDir>/.*/dist/',
		'<rootDir>/.*/dist-types/',
	],
	coverageReporters: ['lcov'],
	coverageDirectory: '<rootDir>/artifacts/logs',
	collectCoverageFrom: ['<rootDir>/packages/*/src/**', '!**/test/**'],
	coveragePathIgnorePatterns: ['/@types/'],
};
