import { readFileSync } from 'fs';
import { join } from 'path';

import { isAnimatedGif } from '../utils';

describe( 'isAnimatedGif', () => {
	it( 'should detect animated GIF', () => {
		const buffer = readFileSync(
			join( __dirname, '/testUtils/nyancat.gif' )
		);
		const arrayBuffer = buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		);
		const result = isAnimatedGif( arrayBuffer );

		expect( result ).toStrictEqual( true );
	} );

	it( 'should not detect non-animated GIF', () => {
		const buffer = readFileSync(
			join( __dirname, '/testUtils/still.gif' )
		);
		const arrayBuffer = buffer.slice(
			buffer.byteOffset,
			buffer.byteOffset + buffer.byteLength
		);
		const result = isAnimatedGif( arrayBuffer );

		expect( result ).toStrictEqual( false );
	} );
} );
