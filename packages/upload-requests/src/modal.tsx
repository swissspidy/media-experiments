import { QRCodeSVG } from 'qrcode.react';

import {
	Button,
	Modal as BaseModal,
	TextControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis
	__experimentalText as Text,
} from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { copy } from '@wordpress/icons';
import { useDispatch } from '@wordpress/data';
import { type Post } from '@wordpress/core-data';
import { useCopyToClipboard } from '@wordpress/compose';
import { store as noticesStore } from '@wordpress/notices';

import './editor.css';

interface ModalProps {
	onRequestClose: () => void;
	uploadRequest: Post | null;
}
export function Modal( { onRequestClose, uploadRequest }: ModalProps ) {
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
		<BaseModal
			title={ __( 'Upload from device', 'media-experiments' ) }
			onRequestClose={ onRequestClose }
			className="mexp-upload-requests-modal"
		>
			<p>
				<Text>
					{ __(
						'Scan the following QR code using your phone:',
						'media-experiments'
					) }
				</Text>
			</p>
			<div className="mexp-upload-requests-modal__qrcode">
				<QRCodeSVG value={ uploadRequest.link } />
			</div>

			<p>
				<Text>
					{ __(
						'Alternatively, directly use this URL to get started:',
						'media-experiments'
					) }
				</Text>
			</p>

			<div className="mexp-upload-requests-modal__input_wrapper">
				<TextControl
					__nextHasNoMarginBottom
					value={ uploadRequest.link }
					readOnly={ true }
					onChange={ () => {} }
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

			<p>
				<Text>
					{ __(
						'This window will automatically close after the upload.',
						'media-experiments'
					) }
				</Text>
			</p>

			<div className="mexp-upload-requests-modal__buttons">
				<Button variant="secondary" onClick={ onRequestClose }>
					{ __( 'Cancel', 'media-experiments' ) }
				</Button>
			</div>
		</BaseModal>
	);
}
