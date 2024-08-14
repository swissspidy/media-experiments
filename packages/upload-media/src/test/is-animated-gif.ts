/**
 * External dependencies
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Internal dependencies
 */
import { isAnimatedGif } from '../utils';

describe( 'isAnimatedGif', () => {
	it( 'should detect animated GIF', () => {
		const buffer = readFileSync(
			join( __dirname, '/fixtures/nyancat.gif' )
		);
		const arrayBuffer = buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		);
		const result = isAnimatedGif( arrayBuffer );

		expect( result ).toStrictEqual( true );
	} );

	it( 'should not detect non-animated GIF', () => {
		const buffer = readFileSync( join( __dirname, '/fixtures/still.gif' ) );
		const arrayBuffer = buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		);
		const result = isAnimatedGif( arrayBuffer );

		expect( result ).toStrictEqual( false );
	} );
} );
