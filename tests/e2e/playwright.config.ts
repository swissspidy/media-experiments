/**
 * External dependencies
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { defineConfig } from '@playwright/test';

/**
 * WordPress dependencies
 */
const baseConfig = require( '@wordpress/scripts/config/playwright.config' );

const config = defineConfig( {
	...baseConfig,
} );

export default config;
