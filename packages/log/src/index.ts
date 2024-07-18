/**
 * Internal dependencies
 */
import { logged } from './utils';

import type { MarkOptions, MeasureOptions } from './types';

export type { MeasureOptions };

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

/**
 * Starts a timer and returns a callback to stop it.
 *
 * @param message Message to show after stopping.
 * @return Callback function or undefined in production mode.
 *
 * @example
 * ```js
 * import { start } from '@mexp/log';
 *
 * const stop = start( 'Doing stuff' );
 * // ...
 * stop();
 * ```
 */
export function start( message: string ): undefined | ( () => void ) {
	if ( ! isDev() ) {
		// Forces consumer to use optional chaining to avoid errors in prod.
		return undefined;
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

export interface TimingObject {
	name: string;
	measure: PerformanceMeasureOptions;
}

export function createTiming(
	measureName: string,
	measureOptions: PerformanceMeasureOptions
): TimingObject {
	return {
		name: measureName,
		measure: measureOptions,
	};
}

export function measure( {
	measureName,
	startTime,
	endTime = performance.now(),
	hintText,
	detailsPairs = [],
	color = 'primary',
	track = 'Media Experiments',
}: MeasureOptions ) {
	if ( ! isDev() ) {
		return;
	}

	performance.measure( measureName, {
		start: startTime,
		end: endTime,
		detail: {
			devtools: {
				metadata: {
					// An identifier for the data type contained in the payload
					dataType: 'track-entry',
					// An identifier for the extension. Not used / displayed.
					extensionName: 'Media Experiments',
				},
				color,
				// All entries will be grouped under this track.
				track,
				// A short description shown over the entry when hovered.
				hintText,
				// key-value pairs added to the details drawer when the entry is selected.
				detailsPairs,
			},
		},
	} );
}

export function mark( {
	markName,
	hintText,
	detailsPairs = [],
	color = 'primary',
	track = 'Media Experiments',
}: MarkOptions ) {
	if ( ! isDev() ) {
		return;
	}

	performance.mark( markName, {
		detail: {
			devtools: {
				metadata: {
					// An identifier for the data type contained in the payload
					dataType: 'marker',
					// An identifier for the extension. Not used / displayed.
					extensionName: 'Media Experiments',
				},
				color,
				// All entries will be grouped under this track.
				track,
				// A short description shown over the entry when hovered.
				hintText,
				// key-value pairs added to the details drawer when the entry is selected.
				detailsPairs,
			},
		},
	} );
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
