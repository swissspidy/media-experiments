import {
	BaseControl,
	Button,
	useBaseControlProps,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as coreStore, type Post } from '@wordpress/core-data';
import {
	lazy,
	Suspense,
	useState,
	useEffect,
	useCallback,
} from '@wordpress/element';
import { store as interfaceStore } from '@wordpress/interface';
import { store as blockEditorStore } from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';
import { store as noticesStore } from '@wordpress/notices';

import type { RestAttachment } from '@mexp/upload-media';

interface UploadRequestControlsProps {
	url?: string;
	onInsert: ( url?: string ) => void;
}

const UPLOAD_REQUEST_CHECK_INTERVAL = 5; // Seconds.
const UPLOAD_REQUEST_MAX_LIFETIME = 15 * 60; // Seconds.

export function UploadRequestControls( props: UploadRequestControlsProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const { openModal, closeModal } = useDispatch( interfaceStore );
	// @ts-ignore -- invalidateResolution is not yet exposed in GB types.
	const { saveEntityRecord, deleteEntityRecord, invalidateResolution } =
		useDispatch( coreStore );
	const { createSuccessNotice, createErrorNotice } =
		useDispatch( noticesStore );

	const {
		isModalActive,
		hasUploadPermissions,
		currentPostId,
		getEntityRecords,
	} = useSelect( ( select ) => {
		const { getSettings } = select( blockEditorStore );
		return {
			isModalActive: select( interfaceStore ).isModalActive(
				'media-experiments/upload-request'
			),
			hasUploadPermissions: Boolean( getSettings().mediaUpload ),
			currentPostId: select( editorStore ).getCurrentPostId(),
			getEntityRecords: select( coreStore ).getEntityRecords,
		};
	}, [] );

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
				{ upload_request: uploadRequestSlug },
			] );

			const attachments: RestAttachment[] | null = getEntityRecords(
				'postType',
				'attachment',
				{
					upload_request: uploadRequestSlug,
				}
			);

			if ( attachments && attachments.length > 0 ) {
				props.onInsert( attachments[ 0 ].source_url );
				void deleteUploadRequest();
				void closeModal();
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
		createSuccessNotice,
	] );

	useEffect( () => {
		const timeout = setInterval( () => {
			if ( ! uploadRequestSlug || ! isModalActive ) {
				return;
			}

			void deleteUploadRequest();
			void closeModal();
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
		createErrorNotice,
	] );

	async function createNewUploadRequest() {
		const module = await import(
			/* webpackChunkName: 'upload-requests-modal' */ '@mexp/upload-requests'
		);

		// TODO: Do not use saveEntityRecord as it causes another GET request
		//       to /wp/v2/upload-requests/ which has not been implemented.
		// Maybe just use apiFetch directly?
		setUploadRequest(
			await saveEntityRecord( 'postType', 'mexp-upload-request', {
				slug: module.getUniqueId(),
				status: 'publish',
				parent: currentPostId,
			} )
		);
	}

	async function onClick() {
		try {
			await createNewUploadRequest();
			void openModal( 'media-experiments/upload-request' );
		} catch ( err ) {
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
	}

	if ( props.url ) {
		return null;
	}

	if ( ! hasUploadPermissions ) {
		return null;
	}

	const Modal = lazy( () =>
		import(
			/* webpackChunkName: 'upload-requests-modal' */ '@mexp/upload-requests'
		).then( ( module ) => ( { default: module.Modal } ) )
	);

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
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ __( 'Upload', 'media-experiments' ) }
			</Button>

			{ isModalActive && (
				<Suspense>
					<Modal
						onRequestClose={ onClose }
						uploadRequest={ uploadRequest }
					/>
				</Suspense>
			) }
		</BaseControl>
	);
}
