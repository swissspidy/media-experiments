/**
 * External dependencies
 */
import {
	transformAttachment,
	type Attachment,
	type RestAttachment,
} from '@mexp/media-utils';
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
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { Modal } from './modal';
import { InlinePlaceholder } from './placeholder';

interface UploadRequestControlsProps {
	onInsert: ( media: Partial< Attachment >[] ) => void;
	allowedTypes?: string[];
	multiple?: boolean;
	accept?: string[];
	inline?: boolean;
	clientId?: string;
}

const UPLOAD_REQUEST_CHECK_INTERVAL = 5; // Seconds.
const UPLOAD_REQUEST_MAX_LIFETIME = 15 * 60; // Seconds.

export function UploadRequestControls( props: UploadRequestControlsProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {
		__nextHasNoMarginBottom: true,
	} );

	const { openModal, closeModal } = useDispatch( interfaceStore );
	// @ts-ignore -- invalidateResolution is not yet exposed in GB types.
	const { deleteEntityRecord, invalidateResolution } =
		useDispatch( coreStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );
	const { lockPostSaving, unlockPostSaving } = useDispatch( editorStore );

	const {
		isModalActive,
		hasUploadPermissions,
		currentPostId,
		getEntityRecords,
	} = useSelect(
		( select ) => {
			const { getSettings } = select( blockEditorStore );
			const modalName = props.inline
				? `media-experiments/upload-request-${ props.clientId }`
				: 'media-experiments/upload-request';
			return {
				isModalActive: select( interfaceStore ).isModalActive(
					modalName
				),
				hasUploadPermissions: Boolean( getSettings().mediaUpload ),
				currentPostId: select( editorStore ).getCurrentPostId(),
				getEntityRecords: select( coreStore ).getEntityRecords,
			};
		},
		[ props.inline, props.clientId ]
	);

	const [ uploadRequest, setUploadRequest ] = useState< Post | null >( null );

	const uploadRequestSlug = uploadRequest ? uploadRequest.slug : null;

	const deleteUploadRequest = useCallback(
		async function deleteUploadRequest() {
			if ( ! uploadRequestSlug ) {
				return;
			}
			try {
				await deleteEntityRecord(
					'postType',
					'mexp-upload-request',
					uploadRequestSlug,
					{},
					{ throwOnError: true }
				);
			} catch {
				// Do nothing.
			}
		},
		[ deleteEntityRecord, uploadRequestSlug ]
	);

	useEffect( () => {
		const timeout = setInterval( () => {
			if ( ! uploadRequestSlug || ! isModalActive ) {
				return;
			}

			void invalidateResolution( 'getEntityRecords', [
				'postType',
				'attachment',
				{
					upload_request: uploadRequestSlug,
					context: 'edit',
				},
			] );

			const attachments: RestAttachment[] | null = getEntityRecords(
				'postType',
				'attachment',
				{
					upload_request: uploadRequestSlug,
					context: 'edit',
				}
			);

			if ( attachments && attachments.length > 0 ) {
				props.onInsert( attachments.map( transformAttachment ) );
				void deleteUploadRequest();
				void closeModal();
				void unlockPostSaving( 'media-experiments/upload-request' );
				void createSuccessNotice(
					__( 'Media successfully uploaded.', 'media-experiments' ),
					{
						type: 'snackbar',
					}
				);

				clearInterval( timeout );
			}

			// TODO: Check to see if an attachment has been uploaded already.
		}, UPLOAD_REQUEST_CHECK_INTERVAL * 1000 );

		return () => clearInterval( timeout );
	}, [
		uploadRequestSlug,
		isModalActive,
		invalidateResolution,
		getEntityRecords,
		props,
		deleteUploadRequest,
		closeModal,
		unlockPostSaving,
		createSuccessNotice,
	] );

	useEffect( () => {
		const timeout = setInterval( () => {
			if ( ! uploadRequestSlug || ! isModalActive ) {
				return;
			}

			void deleteUploadRequest();
			void closeModal();
			void unlockPostSaving( 'media-experiments/upload-request' );
			void createErrorNotice(
				__( 'Upload expired.', 'media-experiments' ),
				{
					type: 'snackbar',
				}
			);

			clearInterval( timeout );
		}, UPLOAD_REQUEST_MAX_LIFETIME * 1000 );

		return () => clearInterval( timeout );
	}, [
		uploadRequestSlug,
		isModalActive,
		deleteUploadRequest,
		closeModal,
		unlockPostSaving,
		createErrorNotice,
	] );

	async function createNewUploadRequest() {
		setUploadRequest(
			await apiFetch< Post >( {
				path: `/wp/v2/upload-requests`,
				data: {
					status: 'publish',
					parent: currentPostId,
					meta: {
						mexp_allowed_types: props.allowedTypes
							? props.allowedTypes.join( ',' )
							: undefined,
						mexp_multiple: Boolean( props.multiple ),
						mexp_accept: props.accept
							? props.accept.join( ',' )
							: undefined,
					},
				},
				method: 'POST',
			} )
		);
	}

	async function onClick() {
		try {
			await createNewUploadRequest();
			const modalName = props.inline
				? `media-experiments/upload-request-${ props.clientId }`
				: 'media-experiments/upload-request';
			void openModal( modalName );
			void lockPostSaving( 'media-experiments/upload-request' );
		} catch {
			void createErrorNotice(
				__(
					'Could not start upload process. Please try again.',
					'media-experiments'
				),
				{
					type: 'snackbar',
				}
			);
		}
	}

	function onClose() {
		void deleteUploadRequest();
		void closeModal();
		void unlockPostSaving( 'media-experiments/upload-request' );
	}

	if ( ! hasUploadPermissions ) {
		return null;
	}

	// Inline mode - show placeholder in the block
	if ( props.inline ) {
		if ( isModalActive && uploadRequest ) {
			return (
				<InlinePlaceholder
					uploadRequest={ uploadRequest }
					onCancel={ onClose }
				/>
			);
		}
		return null;
	}

	// Modal mode - show button and modal
	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Upload from device', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			<p>
				{ __(
					'Use another device such as a mobile phone to upload media',
					'media-experiments'
				) }
			</p>
			<Button variant="secondary" onClick={ onClick } { ...controlProps }>
				{ __( 'Upload', 'media-experiments' ) }
			</Button>

			{ isModalActive && (
				<Modal
					onRequestClose={ onClose }
					uploadRequest={ uploadRequest }
				/>
			) }
		</BaseControl>
	);
}
