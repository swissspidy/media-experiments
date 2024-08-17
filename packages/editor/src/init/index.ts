/**
 * External dependencies
 */
import {
	uploadMedia as originalUploadMedia,
	sideloadMedia as originalSideloadMedia,
} from '@mexp/media-utils';
import { type ImageFormat, store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import {
	dispatch as globalDispatch,
	dispatch,
	select,
	subscribe,
} from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../preferences-modal/constants';
import type { MediaPreferences, RestBaseRecord } from '../types';
import {
	editorUploadMedia,
	editorValidateFileSize,
	editorValidateMimeType,
} from './media-utils';

const noop = () => {};

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * This function is intended to eventually live
 * in the `@wordpress/block-editor` package, allowing
 * to perform the client-side file processing before eventually
 * uploading the media to WordPress.
 *
 * @param $0                Parameters object passed to the function.
 * @param $0.allowedTypes   Array with the types of media that can be uploaded, if unset all types are allowed.
 * @param $0.additionalData Additional data to include in the request.
 * @param $0.filesList      List of files.
 * @param $0.onError        Function called when an error happens.
 * @param $0.onFileChange   Function called each time a file or a temporary representation of the file is available.
 * @param $0.onSuccess      Function called once a file has completely finished uploading, including thumbnails.
 * @param $0.onBatchSuccess Function called once all files in a group have completely finished uploading, including thumbnails.
 */
export default function blockEditorUploadMedia( {
	allowedTypes,
	additionalData = {},
	filesList,
	onError = noop,
	onFileChange,
	onSuccess,
	onBatchSuccess,
}: Parameters< typeof originalUploadMedia >[ 0 ] & {
	onError?: ( message: string ) => void;
	onBatchSuccess: () => void;
} ) {
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
				editorValidateMimeType( mediaFile, allowedTypes );
			} catch ( error: unknown ) {
				onError( error as Error );
				continue;
			}
		}

		// Verify if file is greater than the maximum file upload size allowed for the site.
		// TODO: Consider removing, as file could potentially be compressed first.
		try {
			editorValidateFileSize( mediaFile );
		} catch ( error: unknown ) {
			onError( error as Error );
			continue;
		}

		validFiles.push( mediaFile );
	}

	void dispatch( uploadStore ).addItems( {
		files: validFiles,
		onChange: onFileChange,
		onSuccess,
		onBatchSuccess,
		onError: ( { message }: Error ) => onError( message ),
		additionalData,
	} );
}

function getExtension( mimeType: string ): ImageFormat {
	return ( mimeType.split( '/' )[ 1 ] || 'jpeg' ) as ImageFormat;
}

// Initialize default settings as soon as base data is available.
const unsubscribeCoreStore = subscribe( () => {
	const siteData = select( coreStore ).getEntityRecord<
		// @ts-ignore
		RestBaseRecord | undefined
	>( 'root', '__unstableBase', undefined, {
		_fields: [
			'image_size_threshold',
			'video_size_threshold',
			'image_output_formats',
			'jpeg_interlaced',
			'png_interlaced',
			'gif_interlaced',
			'image_sizes',
		],
	} );

	if ( ! siteData ) {
		return;
	}

	const defaultPreferences: MediaPreferences = {
		// General.
		requireApproval: true,
		optimizeOnUpload: true,
		thumbnailGeneration: 'smart',
		imageLibrary: window.crossOriginIsolated ? 'vips' : 'browser',
		bigImageSizeThreshold: siteData.image_size_threshold,
		bigVideoSizeThreshold: siteData.video_size_threshold,
		keepOriginal: false,
		// Formats.
		default_outputFormat: 'jpeg',
		default_quality: 82,
		default_interlaced: siteData.jpeg_interlaced,
		jpeg_outputFormat: getExtension(
			siteData.image_output_formats[ 'image/jpeg' ] || 'image/jpeg'
		),
		jpeg_quality: 82,
		jpeg_interlaced: siteData.jpeg_interlaced,
		png_outputFormat: getExtension(
			siteData.image_output_formats[ 'image/png' ] || 'image/png'
		),
		png_quality: 82,
		png_interlaced: siteData.png_interlaced,
		webp_outputFormat: getExtension(
			siteData.image_output_formats[ 'image/webp' ] || 'image/webp'
		),
		webp_quality: 86,
		webp_interlaced: false,
		avif_outputFormat: getExtension(
			siteData.image_output_formats[ 'image/avif' ] || 'image/avif'
		),
		avif_quality: 80,
		avif_interlaced: false,
		heic_outputFormat: getExtension(
			siteData.image_output_formats[ 'image/heic' ] || 'image/jpeg'
		),
		heic_quality: 80,
		heic_interlaced: siteData.jpeg_interlaced,
		gif_outputFormat: getExtension(
			siteData.image_output_formats[ 'image/gif' ] || 'image/webp'
		),
		gif_quality: 80,
		gif_interlaced: siteData.gif_interlaced,
		gif_convert: true,
		video_outputFormat: 'mp4',
		audio_outputFormat: 'mp3',
		// Media recording.
		videoInput: undefined,
		audioInput: undefined,
		videoEffect: 'none',
	};

	void globalDispatch( preferencesStore ).setDefaults(
		PREFERENCES_NAME,
		defaultPreferences
	);

	void dispatch( uploadStore ).updateSettings( {
		imageSizes: siteData.image_sizes,
	} );

	unsubscribeCoreStore();
}, coreStore );

/*
 Make the upload queue aware of the function for uploading to the server.
*/
void dispatch( uploadStore ).updateSettings( {
	mediaUpload: editorUploadMedia,
	mediaSideload: originalSideloadMedia,
} );

// Subscribe to state updates so that we can override the mediaUpload() function at the right time.
subscribe( () => {
	if ( ! select( editorStore ).getEditorSettings().maxUploadFileSize ) {
		return;
	}

	if ( ! select( blockEditorStore ).getSettings().mediaUpload ) {
		return;
	}

	if (
		select( blockEditorStore ).getSettings().mediaUpload ===
		blockEditorUploadMedia
	) {
		return;
	}

	// Update block-editor with the new function that moves everything through a queue.
	void dispatch( blockEditorStore ).updateSettings( {
		mediaUpload: blockEditorUploadMedia,
	} );
}, blockEditorStore );
