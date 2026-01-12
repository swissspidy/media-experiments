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
export function start(
	message: string
): undefined | ( ( stopMessage?: string ) => void ) {
	if ( ! isDev() ) {
		// Forces consumer to use optional chaining to avoid errors in prod.
		return undefined;
	}

	const before = performance.now();

	return ( stopMessage?: string ) => {
		const elapsed = performance.now() - before;

		stopMessage = stopMessage ? ` | ${ stopMessage }` : '';

		// eslint-disable-next-line no-console
		console.log(
			`${ message }${ stopMessage } | %c${ elapsed.toFixed( 3 ) } ms`,
			'color: lime;'
		);

		// Throwing an error and catching it immediately to improve debugging
		// A consumer can use 'pause on caught exceptions'
		// https://github.com/facebook/react/issues/4216
		try {
			throw Error( `${ message } | ${ elapsed } ms` );
		} catch {
			// Do nothing.
		}
	};
}

/**
 * Small wrapper around `performance.measure`.
 *
 * Only works if not in production mode.
 *
 * @param $0             Parameters object passed to the function.
 * @param $0.measureName A string representing the name of the measure.
 * @param $0.startTime   Start time.
 * @param $0.endTime     End time. Defaults to `performance.now()`
 * @param $0.tooltipText A short description shown over the entry when hovered.
 * @param $0.properties  key-value pairs added to the details drawer when the entry is selected.
 * @param $0.color       The color the entry will be displayed with in the timeline.
 * @param $0.track       The name (and identifier) of the extension track the entry belongs to.
 */
export function measure( {
	measureName,
	startTime,
	endTime = performance.now(),
	tooltipText,
	properties = [],
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
				// An identifier for the data type contained in the payload
				dataType: 'track-entry',
				color,
				// All entries will be grouped under this track.
				track,
				// A short description shown over the entry when hovered.
				tooltipText,
				// key-value pairs added to the details drawer when the entry is selected.
				properties,
			},
		},
	} );
}

export function mark( {
	markName,
	tooltipText,
	properties = [],
	color = 'primary',
	track = 'Media Experiments',
}: MarkOptions ) {
	if ( ! isDev() ) {
		return;
	}

	performance.mark( markName, {
		detail: {
			devtools: {
				// An identifier for the data type contained in the payload
				dataType: 'marker',
				color,
				// All entries will be grouped under this track.
				track,
				// A short description shown over the entry when hovered.
				tooltipText,
				// key-value pairs added to the details drawer when the entry is selected.
				properties,
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
	} catch {
		// Do nothing.
	}

	logged.add( message );
}
