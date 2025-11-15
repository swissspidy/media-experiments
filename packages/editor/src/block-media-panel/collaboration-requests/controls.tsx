/**
 * External dependencies
 */
import { store as interfaceStore } from '@mexp/interface';

/**
 * WordPress dependencies
 */
import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { type Post, store as coreStore } from '@wordpress/core-data';
import { useCallback, useEffect, useState } from '@wordpress/element';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { Modal } from './modal';

const COLLABORATION_REQUEST_MAX_LIFETIME = 15 * 60; // Seconds.

export function CollaborationRequestControls() {
	const { baseControlProps, controlProps } = useBaseControlProps( {
		__nextHasNoMarginBottom: true,
	} );

	const { openModal, closeModal } = useDispatch( interfaceStore );
	// @ts-ignore -- invalidateResolution is not yet exposed in GB types.
	const { deleteEntityRecord } = useDispatch( coreStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	const { isModalActive, hasEditPermissions, currentPostId } = useSelect(
		( select ) => {
			return {
				isModalActive: select( interfaceStore ).isModalActive(
					'media-experiments/collaboration-request'
				),
				hasEditPermissions: ! select( editorStore ).isEditedPostNew(),
				currentPostId: select( editorStore ).getCurrentPostId(),
			};
		},
		[]
	);

	const [ collaborationRequest, setCollaborationRequest ] =
		useState< Post | null >( null );
	const [ allowedCapabilities, setAllowedCapabilities ] = useState<
		string[]
	>( [ 'edit_post', 'upload_files' ] );

	const collaborationRequestSlug = collaborationRequest
		? collaborationRequest.slug
		: null;

	const deleteCollaborationRequest = useCallback(
		async function deleteCollaborationRequest() {
			if ( ! collaborationRequestSlug ) {
				return;
			}
			try {
				await deleteEntityRecord(
					'postType',
					'mexp-collab-request',
					collaborationRequestSlug,
					{},
					{ throwOnError: true }
				);
			} catch {
				// Do nothing.
			}
		},
		[ deleteEntityRecord, collaborationRequestSlug ]
	);

	// Update collaboration request when capabilities change
	useEffect( () => {
		if ( ! collaborationRequest ) {
			return;
		}

		async function updateRequest() {
			if ( ! collaborationRequest ) {
				return;
			}

			try {
				await apiFetch< Post >( {
					path: `/wp/v2/collaboration-requests/${ collaborationRequest.slug }`,
					data: {
						meta: {
							mexp_allowed_capabilities:
								allowedCapabilities.join( ',' ),
						},
					},
					method: 'POST',
				} );
			} catch {
				createErrorNotice(
					__(
						'Failed to update collaboration request capabilities.',
						'media-experiments'
					),
					{ type: 'snackbar' }
				);
			}
		}

		void updateRequest();
	}, [ allowedCapabilities, collaborationRequest ] );

	// Auto-expire after max lifetime
	useEffect( () => {
		const timeout = setInterval( () => {
			if ( ! collaborationRequestSlug || ! isModalActive ) {
				return;
			}

			void deleteCollaborationRequest();
			void closeModal();
			void createErrorNotice(
				__( 'Collaboration link expired.', 'media-experiments' ),
				{
					type: 'snackbar',
				}
			);

			clearInterval( timeout );
		}, COLLABORATION_REQUEST_MAX_LIFETIME * 1000 );

		return () => clearInterval( timeout );
	}, [
		collaborationRequestSlug,
		isModalActive,
		deleteCollaborationRequest,
		closeModal,
		createErrorNotice,
	] );

	async function createNewCollaborationRequest() {
		setCollaborationRequest(
			await apiFetch< Post >( {
				path: `/wp/v2/collaboration-requests`,
				data: {
					status: 'publish',
					parent: currentPostId,
					meta: {
						mexp_allowed_capabilities:
							allowedCapabilities.join( ',' ),
					},
				},
				method: 'POST',
			} )
		);
	}

	async function onClick() {
		try {
			await createNewCollaborationRequest();
			void openModal( 'media-experiments/collaboration-request' );
		} catch {
			void createErrorNotice(
				__(
					'Could not create collaboration link. Please try again.',
					'media-experiments'
				),
				{
					type: 'snackbar',
				}
			);
		}
	}

	function onClose() {
		void deleteCollaborationRequest();
		void closeModal();
		void createSuccessNotice(
			__( 'Collaboration link revoked.', 'media-experiments' ),
			{
				type: 'snackbar',
			}
		);
	}

	if ( ! hasEditPermissions ) {
		return null;
	}

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Temporary collaboration', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Share a link to allow someone to temporarily collaborate on this post without requiring a login',
					'media-experiments'
				) }
			</p>
			<Button variant="secondary" onClick={ onClick } { ...controlProps }>
				{ __( 'Share link', 'media-experiments' ) }
			</Button>

			{ isModalActive && (
				<Modal
					onRequestClose={ onClose }
					collaborationRequest={ collaborationRequest }
					allowedCapabilities={ allowedCapabilities }
					onCapabilitiesChange={ setAllowedCapabilities }
				/>
			) }
		</BaseControl>
	);
}
