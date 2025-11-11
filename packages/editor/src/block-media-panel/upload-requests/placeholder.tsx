/**
 * External dependencies
 */
import { QRCodeSVG } from 'qrcode.react';

/**
 * WordPress dependencies
 */
import {
	Button,
	TextControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
	Placeholder,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { copy, upload } from '@wordpress/icons';
import { useDispatch } from '@wordpress/data';
import type { Post } from '@wordpress/core-data';
import { useCopyToClipboard } from '@wordpress/compose';
import { store as noticesStore } from '@wordpress/notices';

interface InlinePlaceholderProps {
	uploadRequest: Post | null;
	onCancel: () => void;
}

/**
 * Renders an inline upload request placeholder.
 *
 * Displays a QR code and an input field to copy the upload request URL
 * within the block itself instead of a modal.
 *
 * @param $0
 * @param $0.uploadRequest The current upload request.
 * @param $0.onCancel      Callback for when the upload is cancelled.
 */
export function InlinePlaceholder( {
	uploadRequest,
	onCancel,
}: InlinePlaceholderProps ) {
	const { createNotice } = useDispatch( noticesStore );
	const copyRef = useCopyToClipboard( uploadRequest?.link || '', () => {
		void createNotice(
			'info',
			__( 'Copied URL to clipboard.', 'media-experiments' ),
			{
				isDismissible: true,
				type: 'snackbar',
			}
		);
	} );

	if ( ! uploadRequest ) {
		return null;
	}

	return (
		<Placeholder
			icon={ upload }
			label={ __( 'Upload from device', 'media-experiments' ) }
			className="mexp-upload-requests-placeholder"
			instructions={ __(
				'Scan the QR code or use the URL below to upload media from another device',
				'media-experiments'
			) }
		>
			<div className="mexp-upload-requests-placeholder__content">
				<div className="mexp-upload-requests-placeholder__qrcode">
					<QRCodeSVG value={ uploadRequest.link } />
				</div>

				<div className="mexp-upload-requests-placeholder__url">
					<div className="mexp-upload-requests-placeholder__input-wrapper">
						<TextControl
							__nextHasNoMarginBottom
							value={ uploadRequest.link }
							readOnly={ true }
							onChange={ () => {} }
							onFocus={ ( event ) => {
								event.target.select();
							} }
							label={ __( 'Upload URL', 'media-experiments' ) }
							hideLabelFromVision
						/>

						<Button
							variant="secondary"
							ref={ copyRef }
							icon={ copy }
							showTooltip={ true }
							label={ __(
								'Copy to clipboard',
								'media-experiments'
							) }
						/>
					</div>

					<Text className="mexp-upload-requests-placeholder__notice">
						{ __(
							'Waiting for upload… You can continue editing other parts of your post.',
							'media-experiments'
						) }
					</Text>

					<Button
						variant="tertiary"
						onClick={ onCancel }
						className="mexp-upload-requests-placeholder__cancel"
					>
						{ __( 'Cancel', 'media-experiments' ) }
					</Button>
				</div>
			</div>
		</Placeholder>
	);
}
