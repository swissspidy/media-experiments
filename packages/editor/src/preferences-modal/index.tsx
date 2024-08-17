/**
 * External dependencies
 */
import { store as interfaceStore } from '@mexp/interface';

/**
 * WordPress dependencies
 */
import { registerPlugin } from '@wordpress/plugins';
import { PluginMoreMenuItem } from '@wordpress/editor';
import { media } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';

/**
 * Internal dependencies
 */
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
