/**
 * WordPress dependencies
 */
import { registerPlugin } from '@wordpress/plugins';
import { media } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { PluginMoreMenuItem } from '@wordpress/editor';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { store as coreStore } from '@wordpress/core-data';
import { speak } from '@wordpress/a11y';
import { useEffect, useState } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../constants';
import { WelcomeGuide } from './welcome-guide';

function WelcomeGuideMenuItem() {
	const [ isTempUser, setIsTempUser ] = useState( false );

	const isActive = useSelect(
		( select ) =>
			select( preferencesStore ).get( PREFERENCES_NAME, 'welcomeGuide' ),
		[]
	);

	const currentUser = useSelect(
		( select ) => select( coreStore ).getCurrentUser(),
		[]
	);

	const { toggle } = useDispatch( preferencesStore );

	useEffect( () => {
		// Check if this is a temporary collaboration user
		const checkTempUser = async () => {
			if ( ! currentUser?.id ) {
				return;
			}

			try {
				const userMeta = await apiFetch< {
					meta?: {
						mexp_is_temp_collab_user?: boolean;
					};
				} >( {
					path: `/wp/v2/users/${ currentUser.id }?context=edit`,
					method: 'GET',
				} );

				const tempUser =
					userMeta?.meta?.mexp_is_temp_collab_user || false;
				setIsTempUser( tempUser );

				// Disable welcome guide for temp users
				if ( tempUser && isActive ) {
					toggle( PREFERENCES_NAME, 'welcomeGuide' );
				}
			} catch {
				// Silently fail if we can't check user meta
			}
		};

		void checkTempUser();
	}, [ currentUser, isActive, toggle ] );

	const speakMessage = () => {
		if ( isActive ) {
			speak(
				__( 'Media welcome guide deactivated', 'media-experiments' )
			);
		} else {
			speak( __( 'Media welcome guide activated', 'media-experiments' ) );
		}
	};

	// Don't show welcome guide menu item or guide for temp users
	if ( isTempUser ) {
		return null;
	}

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
