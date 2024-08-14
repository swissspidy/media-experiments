function formatDuration( time: number ): string {
	return time.toLocaleString( 'en-US', {
		minimumIntegerDigits: 2,
		useGrouping: false,
	} );
}

/**
 * Converts length in seconds to MM:SS.SSS format.
 *
 * @param seconds Original length in seconds.
 * @return Formatted length.
 */
export function formatSecondsToMinutesSeconds( seconds: number ): string {
	if ( ! seconds ) {
		return '00:00';
	}

	seconds = seconds % 3600;
	const minutes = Math.floor( seconds / 60 );
	seconds = seconds % 60;

	return `${ formatDuration( minutes ) }:${ formatDuration( seconds ) }`;
}
