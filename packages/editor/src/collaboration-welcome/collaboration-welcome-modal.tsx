/**
 * WordPress dependencies
 */
import { useState, useEffect } from '@wordpress/element';
import { Modal, Button, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore } from '@wordpress/core-data';
import { store as noticesStore } from '@wordpress/notices';
import { store as preferencesStore } from '@wordpress/preferences';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../constants';

export function CollaborationWelcomeModal() {
	const [ isOpen, setIsOpen ] = useState( false );
	const [ displayName, setDisplayName ] = useState( '' );
	const [ isSaving, setIsSaving ] = useState( false );

	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { set: setPreference } = useDispatch( preferencesStore );

	const { currentUser, welcomeShown } = useSelect( ( select ) => {
		return {
			currentUser: select( coreStore ).getCurrentUser(),
			welcomeShown: select( preferencesStore ).get(
				PREFERENCES_NAME,
				'collabWelcomeShown'
			),
		};
	}, [] );

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

				const isTempUser =
					userMeta?.meta?.mexp_is_temp_collab_user || false;

				if ( isTempUser && ! welcomeShown ) {
					setIsOpen( true );
					setDisplayName( currentUser.name || '' );
				}
			} catch {
				// Silently fail if we can't check user meta
			}
		};

		void checkTempUser();
	}, [ currentUser, welcomeShown ] );

	const handleSave = async () => {
		if ( ! currentUser?.id ) {
			return;
		}

		setIsSaving( true );

		try {
			// Update display name if changed
			if ( displayName && displayName !== currentUser.name ) {
				await apiFetch( {
					path: `/wp/v2/users/${ currentUser.id }`,
					method: 'POST',
					data: {
						name: displayName,
					},
				} );

				void createSuccessNotice(
					__(
						'Your display name has been updated.',
						'media-experiments'
					),
					{ type: 'snackbar' }
				);
			}

			// Mark welcome as shown in preferences
			void setPreference( PREFERENCES_NAME, 'collabWelcomeShown', true );

			setIsOpen( false );
		} catch {
			void createErrorNotice(
				__( 'Failed to save changes.', 'media-experiments' ),
				{ type: 'snackbar' }
			);
		} finally {
			setIsSaving( false );
		}
	};

	const handleSkip = () => {
		// Mark welcome as shown in preferences
		void setPreference( PREFERENCES_NAME, 'collabWelcomeShown', true );
		setIsOpen( false );
	};

	if ( ! isOpen ) {
		return null;
	}

	return (
		<Modal
			title={ __( 'Welcome, Collaborator!', 'media-experiments' ) }
			onRequestClose={ handleSkip }
			className="mexp-collaboration-welcome-modal"
		>
			<p>
				{ __(
					'You have been invited to collaborate on this post. You can edit the content and make changes as needed.',
					'media-experiments'
				) }
			</p>
			<p>
				{ __(
					'Your changes will be visible to the post owner and you can collaborate in real-time.',
					'media-experiments'
				) }
			</p>

			<TextControl
				label={ __(
					'Your display name (optional)',
					'media-experiments'
				) }
				value={ displayName }
				onChange={ setDisplayName }
				help={ __(
					'Choose a name to identify yourself. This helps differentiate between multiple collaborators.',
					'media-experiments'
				) }
			/>

			<div
				style={ {
					display: 'flex',
					justifyContent: 'flex-end',
					gap: '8px',
					marginTop: '16px',
				} }
			>
				<Button variant="tertiary" onClick={ handleSkip }>
					{ __( 'Skip', 'media-experiments' ) }
				</Button>
				<Button
					variant="primary"
					onClick={ handleSave }
					isBusy={ isSaving }
					disabled={ isSaving }
				>
					{ __( 'Continue', 'media-experiments' ) }
				</Button>
			</div>
		</Modal>
	);
}
