/**
 * External dependencies
 */
import { type ImageFormat, store as uploadStore } from '@mexp/upload-media';

/**
 * WordPress dependencies
 */
import { StrictMode, createRoot } from '@wordpress/element';
import { dispatch, select, subscribe } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { store as coreStore } from '@wordpress/core-data';
import { PREFERENCES_NAME } from './constants';
import type { RestBaseRecord } from './types';

import { App } from './app';

function getExtension( mimeType: string ): ImageFormat {
	return ( mimeType.split( '/' )[ 1 ] || 'jpeg' ) as ImageFormat;
}

function fetchBaseRecord() {
	return select( coreStore ).getEntityRecord<
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
}

// Initial fetch triggers state update in subscribe() block below.
fetchBaseRecord();

// Initialize default settings as soon as base data is available.
const unsubscribeCoreStore = subscribe( () => {
	const siteData = fetchBaseRecord();

	if ( ! siteData ) {
		return;
	}

	const defaultPreferences = {
		// General.
		requireApproval: true,
		optimizeOnUpload: true,
		thumbnailGeneration: 'smart',
		imageLibrary: window.crossOriginIsolated ? 'vips' : 'browser',
		bigImageSizeThreshold: siteData.image_size_threshold,
		bigVideoSizeThreshold: siteData.video_size_threshold,
		keepOriginal: false,
		convertUnsafe: true,
		// TODO: Revisit implementation.
		useAi: false,
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

	void dispatch( preferencesStore ).setDefaults(
		PREFERENCES_NAME,
		defaultPreferences
	);

	void dispatch( uploadStore ).updateSettings( {
		imageSizes: siteData.image_sizes,
	} );

	unsubscribeCoreStore();
}, coreStore );

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
