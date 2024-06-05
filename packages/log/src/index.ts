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

interface UploadTimingOptions {
	measureName: string;
	startTime: number | string;
	endTime?: number | string;
	// The color the entry will be displayed with in the timeline. Can only be a value from the
	// palette defined in DevToolsColor
	color?: DevToolsColor;
	// The name (and identifier) of the extension track the entry belongs to. Entries intended to
	// be displayed to the same track should contain the same value in this property.
	track?: string;
	// A short description shown over the entry when hovered.
	hintText?: string;
	// key-value pairs added to the details drawer when the entry is selected.
	detailsPairs?: [ string, string ][];
}

// export function getUploadTiming(
// 	{
// 		measureName,
// 		startTime,
// 		endTime = performance.now(),
// 		hintText,
// 		detailsPairs = [],
// 		color = 'primary',
// 		track = 'Media Experiments',
// 	}: UploadTimingOptions
// ) {
// 	const measure = {
// 		start: startTime,
// 		end: performance.now(),
// 		detail: {
// 			devtools: {
// 				metadata: {
// 					extensionName: "React Extension",
// 					dataType: "track-entry",
// 				},
// 				color: "tertiary-light",
// 				track: "An Extension Track",
// 				hintText: "This is a rendering task",
// 				detailsPairs: [
// 					["Description", "This is a child task"],
// 					["Tip", "Do something about it"],
// 				],
// 			},
// 		},
// 	};
//
// 	return {
// 		name: measureName,
// 		measure: measureOptions,
// 	};
// }

type DevToolsColor =
	| 'primary'
	| 'primary-light'
	| 'primary-dark'
	| 'secondary'
	| 'secondary-light'
	| 'secondary-dark'
	| 'tertiary'
	| 'tertiary-light'
	| 'tertiary-dark'
	| 'error';

interface MeasureOptions {
	measureName: string;
	startTime: number | string;
	endTime?: number | string;
	// The color the entry will be displayed with in the timeline. Can only be a value from the
	// palette defined in DevToolsColor
	color?: DevToolsColor;
	// The name (and identifier) of the extension track the entry belongs to. Entries intended to
	// be displayed to the same track should contain the same value in this property.
	track?: string;
	// A short description shown over the entry when hovered.
	hintText?: string;
	// key-value pairs added to the details drawer when the entry is selected.
	detailsPairs?: [ string, string ][];
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

interface MarkOptions {
	markName: string;
	// The color the entry will be displayed with in the timeline. Can only be a value from the
	// palette defined in DevToolsColor
	color?: DevToolsColor;
	// The name (and identifier) of the extension track the entry belongs to. Entries intended to
	// be displayed to the same track should contain the same value in this property.
	track?: string;
	// A short description shown over the entry when hovered.
	hintText?: string;
	// key-value pairs added to the details drawer when the entry is selected.
	detailsPairs?: [ string, string ][];
}

export function mark( {
	markName,
	hintText,
	detailsPairs = [],
	color = 'primary',
	track = 'Media Experiments',
}: MarkOptions ) {
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
