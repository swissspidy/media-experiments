import type { ChangeEvent } from 'react';

import { createRoot, useState } from '@wordpress/element';
import {
	Button,
	FormFileUpload,
	SnackbarList, // eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import { type Attachment, uploadMedia } from '@mexp/upload-media';

import './view.css';

// TODO: Restrict based on actual upload request.
const ALLOWED_MEDIA_TYPES = [ 'image', 'video', 'audio' ];
const MULTIPLE = false;
const ACCEPT = [ 'image/*', 'video/*', 'audio/*', '.pdf' ].join( ',' );

function App() {
	const { createErrorNotice, createSuccessNotice, removeNotice } =
		useDispatch( noticesStore );
	const notices = useSelect(
		( select ) => select( noticesStore ).getNotices(),
		[]
	);
	const snackbarNotices = notices.filter(
		( { type } ) => type === 'snackbar'
	);

	const [ attachment, setAttachment ] = useState< Partial< Attachment > >(
		{}
	);

	const onUpload = ( event: ChangeEvent< HTMLInputElement > ) => {
		uploadMedia( {
			allowedTypes: ALLOWED_MEDIA_TYPES,
			filesList: event.target.files ? [ ...event.target.files ] : [],
			wpAllowedMimeTypes: window.mediaExperiments.allowedMimeTypes,
			onError: ( message ) => {
				void createErrorNotice( message.message, { type: 'snackbar' } );
			},
			additionalData: {
				upload_request: window.mediaExperiments.uploadRequest,
			},
			onFileChange: ( [ media ] ) => {
				if ( ! media.id ) {
					return;
				}

				setAttachment( media );

				void createSuccessNotice(
					__(
						'File successfully uploaded. You may now close this page.',
						'media-experiments'
					),
					{ type: 'snackbar' }
				);
			},
		} );
	};

	return (
		<>
			{ ! attachment.id ? (
				<FormFileUpload
					onChange={ onUpload }
					accept={ ACCEPT }
					multiple={ MULTIPLE }
					render={ ( { openFileDialog } ) => (
						<Button variant="primary" onClick={ openFileDialog }>
							{ __( 'Upload media', 'media-experiments' ) }
						</Button>
					) }
				/>
			) : (
				<Text>
					{ __(
						'File successfully uploaded. You may now close this page.',
						'media-experiments'
					) }
				</Text>
			) }
			<SnackbarList
				notices={ snackbarNotices }
				className="components-editor-notices__snackbar"
				onRemove={ removeNotice }
			/>
		</>
	);
}

const container = document.getElementById(
	'media-experiments-upload-request-root'
);
if ( container ) {
	const root = createRoot( container );
	root.render( <App /> );
}
