/**
 * Internal dependencies
 */
import { warn } from '..';
import { logged } from '../utils';

const consoleSpy = jest.spyOn( console, 'warn' ).mockImplementation();

describe( 'warn', () => {
	const initialScriptDebug = SCRIPT_DEBUG;

	beforeEach( () => {
		consoleSpy.mockClear();
	} );

	afterEach( () => {
		SCRIPT_DEBUG = initialScriptDebug;
		logged.clear();
		consoleSpy.mockClear();
	} );

	it( 'logs to console.warn when SCRIPT_DEBUG is set to `true`', () => {
		SCRIPT_DEBUG = true;
		warn( 'warning' );

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenLastCalledWith( 'warning' );
	} );

	it( 'does not log to console.warn if SCRIPT_DEBUG not set to `true`', () => {
		SCRIPT_DEBUG = false;
		warn( 'warning' );

		// eslint-disable-next-line no-console
		expect( console.warn ).not.toHaveBeenCalled();
	} );

	it( 'should show a message once', () => {
		SCRIPT_DEBUG = true;
		warn( 'warning' );
		warn( 'warning' );

		// eslint-disable-next-line no-console
		expect( console.warn ).toHaveBeenCalledTimes( 1 );
	} );
} );
