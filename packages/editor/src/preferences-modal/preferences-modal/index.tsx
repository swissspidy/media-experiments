/**
 * External dependencies
 */
import type { ReactNode } from 'react';

/**
 * WordPress dependencies
 */
import { Modal } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import './editor.css';

interface PreferencesModalProps {
	children: ReactNode;
	closeModal: () => void;
}

export function PreferencesModal( {
	closeModal,
	children,
}: PreferencesModalProps ) {
	return (
		<Modal
			className="preferences-modal"
			title={ __( 'Preferences', 'media-experiments' ) }
			onRequestClose={ closeModal }
		>
			{ children }
		</Modal>
	);
}
