import { registerPlugin } from '@wordpress/plugins';
import { PluginMoreMenuItem } from '@wordpress/edit-post';
import { media } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import {
	dispatch as globalDispatch,
	useDispatch,
	useSelect,
} from '@wordpress/data';
import { store as interfaceStore } from '@wordpress/interface';
import { store as preferencesStore } from '@wordpress/preferences';

import type { MediaPreferences } from '../types';
import { Modal } from './modal';
import { PREFERENCES_NAME } from './constants';

import './editor.css';

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

const defaultPreferences: MediaPreferences = {
	// General.
	requireApproval: true,
	optimizeOnUpload: true,
	thumbnailGeneration: 'smart',
	imageLibrary: 'vips',
	bigImageSizeThreshold: window.mediaExperiments.bigImageSizeThreshold,
	bigVideoSizeThreshold: window.mediaExperiments.bigVideoSizeThreshold,
	// Formats.
	default_outputFormat: 'jpeg',
	jpeg_outputFormat: 'jpeg',
	jpeg_quality: 82,
	png_outputFormat: 'webp',
	png_quality: 82,
	webp_outputFormat: 'webp',
	webp_quality: 86,
	avif_outputFormat: 'avif',
	avif_quality: 80,
	heic_outputFormat: 'avif',
	heic_quality: 80,
	gif_outputFormat: 'webp',
	gif_quality: 80,
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
