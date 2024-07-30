import type { ChangeEvent } from 'react';

import {
	StrictMode,
	createRoot,
	useEffect,
	useRef,
	useState,
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
import { dispatch, useDispatch, useSelect } from '@wordpress/data';
import { store as noticesStore } from '@wordpress/notices';

import {
	type Attachment,
	uploadMedia as originalUploadMedia,
	sideloadMedia as originalSideloadMedia,
	validateFileSize,
	validateMimeType,
} from '@mexp/media-utils';
import { store as uploadStore } from '@mexp/upload-media';

import './view.css';

/**
 * Upload a media file when the file upload button is activated.
 *
 * Similar to the mediaUpload() function from `@wordpress/editor`,
 * this is a wrapper around uploadMedia() from `@mexp/media-utils`.
 *
 * @param $0
 * @param $0.additionalData
 * @param $0.filesList
 * @param $0.onError
 * @param $0.onFileChange
 */
function uploadMedia( {
	additionalData = {},
	filesList,
	onError = noop,
	onFileChange,
}: Parameters< typeof originalUploadMedia >[ 0 ] ) {
	originalUploadMedia( {
		allowedTypes: window.mediaExperiments.allowedTypes,
		wpAllowedMimeTypes: window.mediaExperiments.allowedMimeTypes,
		maxUploadFileSize: window.mediaExperiments.maxUploadFileSize,
		filesList,
		additionalData,
		onFileChange,
		onError,
	} );
}

const noop = () => {};

/**
 * Upload a media file when the file upload button is activated.
 *
 * @param $0                   Parameters object passed to the function.
 * @param $0.allowedTypes      Array with the types of media that can be uploaded, if unset all types are allowed.
 * @param $0.additionalData    Additional data to include in the request.
 * @param $0.filesList         List of files.
 * @param $0.maxUploadFileSize Maximum upload size in bytes allowed for the site.
 * @param $0.onError           Function called when an error happens.
 * @param $0.onFileChange      Function called each time a file or a temporary representation of the file is available.
 */
function uploadRequestUploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	maxUploadFileSize,
	onError = noop,
	onFileChange,
}: Parameters< typeof originalUploadMedia >[ 0 ] ) {
	const validFiles = [];

	for ( const mediaFile of filesList ) {
		// TODO: Consider using the _async_ isHeifImage() function from `@mexp/upload-media`
		const isHeifImage = [ 'image/heic', 'image/heif' ].includes(
			mediaFile.type
		);

		/*
		 Check if the caller (e.g. a block) supports this mime type.
		 Special case for file types such as HEIC which will be converted before upload anyway.
		 Another check will be done before upload.
		*/
		if ( ! isHeifImage ) {
			try {
				validateMimeType( mediaFile, allowedTypes );
			} catch ( error: unknown ) {
				onError( error as Error );
				continue;
			}
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		// TODO: Consider removing, as file could potentially be compressed first.
		try {
			validateFileSize( mediaFile, maxUploadFileSize );
		} catch ( error: unknown ) {
			onError( error as Error );
			continue;
		}

		validFiles.push( mediaFile );
	}

	void dispatch( uploadStore ).addItems( {
		files: validFiles,
		onChange: onFileChange,
		onError,
		additionalData,
	} );
}

/*
 Make the upload queue aware of the function for uploading to the server.
 The list of available image sizes is passed via an inline script
 and needs to be saved in the store first.
*/
void dispatch( uploadStore ).updateSettings( {
	mediaUpload: uploadMedia,
	mediaSideload: originalSideloadMedia,
	imageSizes: window.mediaExperiments.availableImageSizes,
} );

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
		uploadRequestUploadMedia( {
			filesList: event.target.files ? [ ...event.target.files ] : [],
			onError: ( error ) => {
				void createErrorNotice( error.message, { type: 'snackbar' } );
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
