/**
 * External dependencies
 */
import { store as interfaceStore } from '@mexp/interface';

/**
 * WordPress dependencies
 */
import { createHigherOrderComponent } from '@wordpress/compose';
import { addFilter } from '@wordpress/hooks';
import { useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
import type { MediaPanelProps } from '../types';
import { UploadRequestControls } from '../block-media-panel/upload-requests/controls';

const SUPPORTED_BLOCKS = [
	'core/image',
	'core/audio',
	'core/video',
	'core/gallery',
];

const addUploadRequestPlaceholder = createHigherOrderComponent(
	( BlockEdit ) => ( props: MediaPanelProps ) => {
		const isInUploadMode = useSelect(
			( select ) => {
				// Check if the block-specific modal is active
				const modalName = `media-experiments/upload-request-${ props.clientId }`;
				return select( interfaceStore ).isModalActive( modalName );
			},
			[ props.clientId ]
		);

		if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		// If upload mode is active for this block, replace the block content with placeholder
		if ( isInUploadMode ) {
			// The UploadRequestControls with inline=true will render the placeholder
			// We pass inline explicitly to make sure it uses inline mode
			return (
				<UploadRequestControls
					onInsert={ () => {} }
					inline={ true }
					clientId={ props.clientId }
				/>
			);
		}

		return <BlockEdit { ...props } />;
	},
	'withUploadRequestPlaceholder'
);

addFilter(
	'editor.BlockEdit',
	'media-experiments/add-upload-request-placeholder',
	addUploadRequestPlaceholder,
	5
);
