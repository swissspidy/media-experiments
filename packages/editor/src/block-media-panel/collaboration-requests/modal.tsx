/**
 * External dependencies
 */
import { QRCodeSVG } from 'qrcode.react';

/**
 * WordPress dependencies
 */
import {
	Button,
	CheckboxControl,
	Modal as BaseModal,
	TextControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { copy } from '@wordpress/icons';
import { useDispatch } from '@wordpress/data';
import type { Post } from '@wordpress/core-data';
import { useCopyToClipboard } from '@wordpress/compose';
import { store as noticesStore } from '@wordpress/notices';

/**
 * Internal dependencies
 */
import './editor.css';

interface ModalProps {
	onRequestClose: () => void;
	collaborationRequest: Post | null;
	allowedCapabilities: string[];
	onCapabilitiesChange: ( capabilities: string[] ) => void;
}

const CAPABILITY_OPTIONS = [
	{
		value: 'edit_post',
		label: __( 'Edit post content', 'media-experiments' ),
	},
	{
		value: 'upload_files',
		label: __( 'Upload media files', 'media-experiments' ),
	},
];

/**
 * Renders a collaboration request modal.
 *
 * Displays a QR code and an input field to copy the collaboration request URL.
 *
 * @param props                      Component props.
 * @param props.onRequestClose       Callback for when the modal is closed.
 * @param props.collaborationRequest The current collaboration request.
 * @param props.allowedCapabilities  Currently allowed capabilities.
 * @param props.onCapabilitiesChange Callback when capabilities change.
 */
export function Modal( {
	onRequestClose,
	collaborationRequest,
	allowedCapabilities,
	onCapabilitiesChange,
}: ModalProps ) {
	const { createNotice } = useDispatch( noticesStore );
	const copyRef = useCopyToClipboard(
		collaborationRequest?.link || '',
		() => {
			void createNotice(
				'info',
				__( 'Copied URL to clipboard.', 'media-experiments' ),
				{
					isDismissible: true,
					type: 'snackbar',
				}
			);
		}
	);

	if ( ! collaborationRequest ) {
		return null;
	}

	return (
		<BaseModal
			title={ __( 'Share for collaboration', 'media-experiments' ) }
			onRequestClose={ onRequestClose }
			className="mexp-collaboration-requests-modal"
		>
			<p>
				<Text>
					{ __(
						'Share the following link to allow someone to temporarily collaborate on this post without requiring a login:',
						'media-experiments'
					) }
				</Text>
			</p>

			<div className="mexp-collaboration-requests-modal__qrcode">
				<QRCodeSVG value={ collaborationRequest.link } />
			</div>

			<div className="mexp-collaboration-requests-modal__input_wrapper">
				<TextControl
					__nextHasNoMarginBottom
					value={ collaborationRequest.link }
					readOnly={ true }
					onFocus={ ( event ) => {
						event.target.select();
					} }
				/>

				<Button
					variant="secondary"
					ref={ copyRef }
					icon={ copy }
					showTooltip={ false }
					label={ __( 'Copy to clipboard', 'media-experiments' ) }
				/>
			</div>

			<div className="mexp-collaboration-requests-modal__capabilities">
				<Text>
					{ __(
						'Choose what the collaborator can do:',
						'media-experiments'
					) }
				</Text>
				{ CAPABILITY_OPTIONS.map( ( option ) => (
					<CheckboxControl
						key={ option.value }
						__nextHasNoMarginBottom
						label={ option.label }
						checked={ allowedCapabilities.includes( option.value ) }
						onChange={ ( checked ) => {
							if ( checked ) {
								onCapabilitiesChange( [
									...allowedCapabilities,
									option.value,
								] );
							} else {
								onCapabilitiesChange(
									allowedCapabilities.filter(
										( cap ) => cap !== option.value
									)
								);
							}
						} }
					/>
				) ) }
			</div>

			<p>
				<Text>
					{ __(
						'This link will expire after 15 minutes. Close this dialog to revoke access.',
						'media-experiments'
					) }
				</Text>
			</p>

			<div className="mexp-collaboration-requests-modal__buttons">
				<Button variant="secondary" onClick={ onRequestClose }>
					{ __( 'Close', 'media-experiments' ) }
				</Button>
			</div>
		</BaseModal>
	);
}
