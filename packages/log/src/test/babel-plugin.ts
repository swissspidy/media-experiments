/**
 * External dependencies
 */
// eslint-disable-next-line import/no-extraneous-dependencies
import { transform } from '@babel/core';

/**
 * Internal dependencies
 */
// @ts-ignore
import babelPlugin from '../babel-plugin';

function join( ...strings: string[] ) {
	return strings.join( '\n' );
}

function transformCode( input: string, options = {} ) {
	const result = transform( input, {
		configFile: false,
		plugins: [ [ babelPlugin, options ] ],
	} );
	return result?.code;
}

describe( 'babel-plugin', () => {
	it( 'should replace warn calls with import declaration', () => {
		const input = join( 'import { warn } from "@mexp/log";', 'warn("a");' );
		const expected = join(
			'import { warn } from "@mexp/log";',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("a") : void 0;'
		);

		expect( transformCode( input ) ).toEqual( expected );
	} );

	it( 'should not replace warn calls without import declaration', () => {
		const input = 'warn("a");';
		const expected = 'warn("a");';

		expect( transformCode( input ) ).toEqual( expected );
	} );

	it( 'should replace warn calls without import declaration with plugin options', () => {
		const input = 'warn("a");';
		const options = { callee: 'warn' };
		const expected =
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("a") : void 0;';

		expect( transformCode( input, options ) ).toEqual( expected );
	} );

	it( 'should replace multiple warn calls', () => {
		const input = join(
			'import { warn } from "@mexp/log";',
			'warn("a");',
			'warn("b");',
			'warn("c");'
		);
		const expected = join(
			'import { warn } from "@mexp/log";',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("a") : void 0;',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("b") : void 0;',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("c") : void 0;'
		);

		expect( transformCode( input ) ).toEqual( expected );
	} );

	it( 'should identify warn callee name', () => {
		const input = join(
			'import { warn } from "@mexp/log";',
			'warn("a");',
			'warn("b");',
			'warn("c");'
		);
		const expected = join(
			'import { warn } from "@mexp/log";',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("a") : void 0;',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("b") : void 0;',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("c") : void 0;'
		);

		expect( transformCode( input ) ).toEqual( expected );
	} );

	it( 'should identify warn callee name by', () => {
		const input = join(
			'import { warn } from "@mexp/log";',
			'warn("a");',
			'warn("b");',
			'warn("c");'
		);
		const expected = join(
			'import { warn } from "@mexp/log";',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("a") : void 0;',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("b") : void 0;',
			'typeof SCRIPT_DEBUG !== "undefined" && SCRIPT_DEBUG === true ? warn("c") : void 0;'
		);

		expect( transformCode( input ) ).toEqual( expected );
	} );
} );
