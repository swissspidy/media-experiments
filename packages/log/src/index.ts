/**
 * Internal dependencies
 */
import { logged } from './utils';

/**
 * Logs a message with `message` if environment is not `production`.
 *
 * @param {string} message Message to show in the log.
 *
 * @example
 * ```js
 * import { log } from '@mexp/log';
 *
 * function MyComponent( props ) {
 *   if ( ! props.title ) {
 *     log( '`props.title` was not passed' );
 *   }
 *   ...
 * }
 * ```
 */
export function log( message: string ) {
	// eslint-disable-next-line no-console
	return _log( message, console.log );
}

/**
 * Shows a warning with `message` if environment is not `production`.
 *
 * @param {string} message Message to show in the warning.
 *
 * @example
 * ```js
 * import { warn } from '@mexp/log';
 *
 * function MyComponent( props ) {
 *   if ( ! props.title ) {
 *     warn( '`props.title` was not passed' );
 *   }
 *   ...
 * }
 * ```
 */
export function warn( message: string ) {
	// eslint-disable-next-line no-console
	return _log( message, console.warn );
}

/**
 * Shows an error with `message` if environment is not `production`.
 *
 * @param {string} message Message to show in the warning.
 *
 * @example
 * ```js
 * import { error } from '@mexp/log';
 *
 * function MyComponent( props ) {
 *   if ( ! props.title ) {
 *     error( '`props.title` was not passed' );
 *   }
 *   ...
 * }
 * ```
 */
export function error( message: string ) {
	// eslint-disable-next-line no-console
	return _log( message, console.error );
}

export function start( message: string ) {
	if ( ! isDev() ) {
		return () => {};
	}

	const before = performance.now();

	return () => {
		const elapsed = performance.now() - before;

		// eslint-disable-next-line no-console
		console.log(
			`${ message } | %c${ elapsed.toFixed( 3 ) } ms`,
			'color: lime;'
		);

		// Throwing an error and catching it immediately to improve debugging
		// A consumer can use 'pause on caught exceptions'
		// https://github.com/facebook/react/issues/4216
		try {
			throw Error( `${ message } | ${ elapsed } ms` );
		} catch ( x ) {
			// Do nothing.
		}
	};
}

function isDev() {
	return typeof SCRIPT_DEBUG !== 'undefined' && SCRIPT_DEBUG;
}

// eslint-disable-next-line no-console
function _log( message: string, logFunc: typeof console.log = console.log ) {
	if ( ! isDev() ) {
		return;
	}

	// Skip if already logged.
	if ( logged.has( message ) ) {
		return;
	}

	// eslint-disable-next-line no-console
	logFunc( message );

	// Throwing an error and catching it immediately to improve debugging
	// A consumer can use 'pause on caught exceptions'
	// https://github.com/facebook/react/issues/4216
	try {
		throw Error( message );
	} catch ( x ) {
		// Do nothing.
	}

	logged.add( message );
}
