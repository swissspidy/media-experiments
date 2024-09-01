/**
 * External dependencies
 */
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
import { mediaUpload, mediaSideload } from './editor/media-utils';
import { uploadMedia as originalUploadMedia } from './editor/media-upload';

/**
 * Upload a media file when the file upload button is activated
 * or when adding a file to the editor via drag & drop.
 *
 * This function is intended to eventually live
 * in the `@wordpress/editor` package, wrapping the one
 * from `@wordpress/block-editor`.
 *
 * @param args Parameters object passed to the function.
 */
export default function uploadMedia(
	args: Parameters< typeof originalUploadMedia >[ 0 ] & {
		onSuccess?: Parameters<
			typeof originalUploadMedia
		>[ 0 ][ 'onFileChange' ];
	}
) {
	// @ts-ignore -- invalidateResolution is not yet exposed in GB types.
	const { invalidateResolution, invalidateResolutionForStoreSelector } =
		dispatch( coreStore );

	originalUploadMedia( {
		...args,
		onSuccess: ( attachments ) => {
			for ( const media of attachments ) {
				if ( media.id ) {
					// FIXME: Needs testing.
					void invalidateResolution( 'getMedia', [
						media.id,
						{ context: 'view' },
					] );
					void invalidateResolution( 'getMedia', [
						media.id,
						{ context: 'edit' },
					] );
					void invalidateResolutionForStoreSelector( 'getMedia' );

					// TODO: Trigger new call here.
				}
			}
			args.onSuccess?.( attachments );
		},
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
	mediaUpload,
	mediaSideload,
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
		select( blockEditorStore ).getSettings().mediaUpload === uploadMedia
	) {
		return;
	}

	// Update block-editor with the new function that moves everything through a queue.
	void dispatch( blockEditorStore ).updateSettings( {
		mediaUpload: uploadMedia,
	} );
}, blockEditorStore );
