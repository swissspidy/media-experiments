import { registerPlugin } from '@wordpress/plugins';
import { PluginMoreMenuItem as PluginMoreMenuItem65 } from '@wordpress/edit-post';
import { PluginMoreMenuItem as PluginMoreMenuItem66 } from '@wordpress/editor';
import { media } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import {
	dispatch as globalDispatch,
	useDispatch,
	useSelect,
} from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import type { ImageFormat } from '@mexp/upload-media';
import { getExtensionFromMimeType } from '@mexp/mime';
import { store as interfaceStore } from '@mexp/interface';

import type { MediaPreferences } from '../types';
import { Modal } from './modal';
import { PREFERENCES_NAME } from './constants';

import './editor.css';

// PluginMoreMenuItem from @wordpress/edit-post is deprecated since WP 6.6.
const PluginMoreMenuItem = PluginMoreMenuItem66 || PluginMoreMenuItem65;

function PreferencesMenuItem() {
	const { openModal } = useDispatch( interfaceStore );
	const isModalActive = useSelect( ( select ) => {
		return select( interfaceStore ).isModalActive( PREFERENCES_NAME );
	}, [] );

	return (
		<>
			<PluginMoreMenuItem
				icon={ media }
				onClick={ () => {
					void openModal( PREFERENCES_NAME );
				} }
			>
				{ __( 'Media Preferences', 'media-experiments' ) }
			</PluginMoreMenuItem>
			{ isModalActive && <Modal /> }
		</>
	);
}

registerPlugin( 'media-experiments-preferences', {
	render: PreferencesMenuItem,
} );

function getExtension( mimeType: string ): ImageFormat {
	return ( getExtensionFromMimeType( mimeType ) || 'jpeg' ) as ImageFormat;
}

const defaultPreferences: MediaPreferences = {
	// General.
	requireApproval: true,
	optimizeOnUpload: true,
	thumbnailGeneration: 'smart',
	imageLibrary: window.crossOriginIsolated ? 'vips' : 'browser',
	bigImageSizeThreshold: window.mediaExperiments.bigImageSizeThreshold,
	bigVideoSizeThreshold: window.mediaExperiments.bigVideoSizeThreshold,
	keepOriginal: false,
	// Formats.
	default_outputFormat: 'jpeg',
	default_quality: 82,
	default_interlaced: window.mediaExperiments.jpegInterlaced,
	jpeg_outputFormat: getExtension(
		window.mediaExperiments.defaultImageOutputFormats[ 'image/jpeg' ] ||
			'image/jpeg'
	),
	jpeg_quality: 82,
	jpeg_interlaced: window.mediaExperiments.jpegInterlaced,
	png_outputFormat: getExtension(
		window.mediaExperiments.defaultImageOutputFormats[ 'image/png' ] ||
			'image/png'
	),
	png_quality: 82,
	png_interlaced: window.mediaExperiments.pngInterlaced,
	webp_outputFormat: getExtension(
		window.mediaExperiments.defaultImageOutputFormats[ 'image/webp' ] ||
			'image/webp'
	),
	webp_quality: 86,
	webp_interlaced: false,
	avif_outputFormat: getExtension(
		window.mediaExperiments.defaultImageOutputFormats[ 'image/avif' ] ||
			'image/avif'
	),
	avif_quality: 80,
	avif_interlaced: false,
	heic_outputFormat: getExtension(
		window.mediaExperiments.defaultImageOutputFormats[ 'image/heic' ] ||
			'image/jpeg'
	),
	heic_quality: 80,
	heic_interlaced: window.mediaExperiments.jpegInterlaced,
	gif_outputFormat: getExtension(
		window.mediaExperiments.defaultImageOutputFormats[ 'image/gif' ] ||
			'image/webp'
	),
	gif_quality: 80,
	gif_interlaced: window.mediaExperiments.gifInterlaced,
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
