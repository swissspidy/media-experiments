import { useEffect } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Warns the user if a recording is in progress before leaving the editor.
 *
 * @see UnfinishedUploadsWarning
 *
 * @return {Component} The component.
 */
export function UnfinishedRecordingWarning() {
	useEffect( () => {
		/**
		 * Warns the user if there is an unfinished recording before leaving the editor.
		 *
		 * @param {Event} event `beforeunload` event.
		 *
		 * @return {string | undefined} Warning prompt message, if unsaved changes exist.
		 */
		const warnIfRecordingInProgress = ( event: BeforeUnloadEvent ) => {
			event.returnValue = __(
				'A recording is still in progress. If you proceed, it will be lost.',
				'media-experiments'
			);
			return event.returnValue;
		};

		window.addEventListener( 'beforeunload', warnIfRecordingInProgress );

		return () => {
			window.removeEventListener(
				'beforeunload',
				warnIfRecordingInProgress
			);
		};
	}, [] );

	return null;
}
