/**
 * WordPress dependencies
 */
import { registerPlugin } from '@wordpress/plugins';
import { media } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { PluginMoreMenuItem } from '@wordpress/editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { speak } from '@wordpress/a11y';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../preferences-modal/constants';
import { WelcomeGuide } from './welcome-guide';

function WelcomeGuideMenuItem() {
	const isActive = useSelect(
		( select ) =>
			select( preferencesStore ).get( PREFERENCES_NAME, 'welcomeGuide' ),
		[]
	);
	const { toggle } = useDispatch( preferencesStore );
	const speakMessage = () => {
		if ( isActive ) {
			speak(
				__( 'Media welcome guide deactivated', 'media-experiments' )
			);
		} else {
			speak( __( 'Media welcome guide activated', 'media-experiments' ) );
		}
	};
	return (
		<>
			<PluginMoreMenuItem
				icon={ media }
				onClick={ () => {
					toggle( PREFERENCES_NAME, 'welcomeGuide' );
					speakMessage();
				} }
				role="menuitemcheckbox"
			>
				{ __( 'Media Welcome Guide', 'media-experiments' ) }
			</PluginMoreMenuItem>
			{ isActive ? <WelcomeGuide /> : null }
		</>
	);
}

registerPlugin( 'media-experiments-welcome-guide', {
	render: WelcomeGuideMenuItem,
} );
