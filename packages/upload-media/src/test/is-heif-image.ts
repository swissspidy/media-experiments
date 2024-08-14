/**
 * External dependencies
 */
import { openAsBlob } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Internal dependencies
 */
import { isHeifImage } from '../utils';

describe( 'isHeifImage', () => {
	it.each( [
		[ 'mif1.heic', true ],
		[ 'msf1.heic', true ],
		[ 'heic.heic', true ],
	] )( 'determines file type of %s', async ( fileName, expected ) => {
		const file = await openAsBlob(
			resolve( __dirname, './fixtures', fileName )
		);
		expect( isHeifImage( await file.arrayBuffer() ) ).toBe( expected );
	} );
} );
