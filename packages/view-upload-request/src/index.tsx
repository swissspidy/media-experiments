import type { ChangeEvent } from 'react';

import {
	createRoot,
	useState,
	useRef,
	useEffect,
	StrictMode,
} from '@wordpress/element';
import {
	Button,
	FormFileUpload,
	Spinner,
	SnackbarList,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import {
	type Attachment,
	uploadMedia,
	store as uploadStore,
} from '@mexp/upload-media';

import './view.css';

function App() {
	const { createErrorNotice, createSuccessNotice, removeNotice } =
		useDispatch( noticesStore );

	const isUploading = useSelect(
		( select ) => select( uploadStore ).getItems().length > 0,
		[]
	);
	const wasUploading = useRef( false );

	useEffect( () => {
		if ( ! isUploading && wasUploading.current ) {
			void createSuccessNotice(
				__(
					'File successfully uploaded. You may now close this page.',
					'media-experiments'
				),
				{ type: 'snackbar' }
			);
		}

		wasUploading.current = isUploading;
	}, [ createSuccessNotice, isUploading ] );

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
			allowedTypes: window.mediaExperiments.allowedTypes,
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
			},
		} );
	};

	return (
		<>
			{ ! attachment.id ? (
				<FormFileUpload
					onChange={ onUpload }
					accept={
						window.mediaExperiments.accept
							? window.mediaExperiments.accept.join( ',' )
							: '*'
					}
					multiple={ window.mediaExperiments.multiple }
					render={ ( { openFileDialog } ) => (
						<Button
							variant="primary"
							onClick={ openFileDialog }
							disabled={ isUploading }
						>
							{ isUploading ? (
								<>
									<Spinner />
									{ __( 'Uploading…', 'media-experiments' ) }
								</>
							) : (
								__( 'Upload media', 'media-experiments' )
							) }
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
	root.render(
		<StrictMode>
			<App />
		</StrictMode>
	);
}
