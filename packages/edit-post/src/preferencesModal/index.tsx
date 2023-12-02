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

import type { ImageFormat } from '@mexp/upload-media';

import './styles.css';
import { Modal } from './modal';
import { PREFERENCES_NAME } from './constants';

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

const defaultPreferences: {
	videoInput?: string;
	audioInput?: string;
	videoEffect: 'none' | 'blur';
	requireApproval: boolean;
	imageFormat: ImageFormat;
	imageQuality: number;
} = {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
	requireApproval: true,
	imageFormat: 'jpeg-browser',
	imageQuality: 82,
};

void globalDispatch( preferencesStore ).setDefaults(
	PREFERENCES_NAME,
	defaultPreferences
);
