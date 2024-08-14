/**
 * External dependencies
 */
import { store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import { useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

/**
 * Warns the user if there are unsaved changes before leaving the editor.
 * Compatible with Post Editor and Site Editor.
 *
 * @return {Component} The component.
 */
export function UnfinishedUploadsWarning() {
	const isUploading = useSelect(
		( select ) => select( uploadStore ).isUploading,
		[]
	);

	useEffect( () => {
		/**
		 * Warns the user if there are unsaved changes before leaving the editor.
		 *
		 * @param {Event} event `beforeunload` event.
		 *
		 * @return {string | undefined} Warning prompt message, if unsaved changes exist.
		 */
		const warnIfUploadsInProgress = ( event: BeforeUnloadEvent ) => {
			if ( isUploading() ) {
				event.returnValue = __(
					'There are still some uploads in progress. If you proceed, they will be lost.',
					'media-experiments'
				);
				return event.returnValue;
			}
		};

		window.addEventListener( 'beforeunload', warnIfUploadsInProgress );

		return () => {
			window.removeEventListener(
				'beforeunload',
				warnIfUploadsInProgress
			);
		};
	}, [ isUploading ] );

	return null;
}
