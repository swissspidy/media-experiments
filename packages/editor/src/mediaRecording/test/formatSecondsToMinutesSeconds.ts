/**
 * Internal dependencies
 */
import { formatSecondsToMinutesSeconds } from '../utils';

describe( 'formatSecondsToMinutesSeconds', () => {
	it.each( [
		[ 0, '00:00' ],
		[ 1, '00:01' ],
		[ 100, '01:40' ],
		[ 537, '08:57' ],
	] )( 'should format %d to %s', ( input, expected ) => {
		expect( formatSecondsToMinutesSeconds( input ) ).toBe( expected );
	} );
} );
