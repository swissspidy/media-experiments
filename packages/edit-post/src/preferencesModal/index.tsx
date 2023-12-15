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
	bigImageSizeThreshold: window.mediaExperiments.bigImageSizeThreshold,
	clientSideThumbnails: true,
	optimizeOnUpload: true,
	imageLibrary: 'vips',
	imageFormat: 'jpeg',
	imageQuality: 82, // 82 for jpeg, 86 for webp.
	// Media recording.
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
};

void globalDispatch( preferencesStore ).setDefaults(
	PREFERENCES_NAME,
	defaultPreferences
);
