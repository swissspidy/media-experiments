/**
 * External dependencies
 */
import type { ReactNode } from 'react';

/**
 * Internal dependencies
 */
import './editor.css';

interface PreferencesModalSectionProps {
	children: ReactNode;
	description: string;
	title: string;
}

export function PreferencesModalSection( {
	description,
	title,
	children,
}: PreferencesModalSectionProps ) {
	return (
		<fieldset className="preferences-modal__section">
			<legend className="preferences-modal__section-legend">
				<h2 className="preferences-modal__section-title">{ title }</h2>
				{ description && (
					<p className="preferences-modal__section-description">
						{ description }
					</p>
				) }
			</legend>
			<div className="preferences-modal__section-content">
				{ children }
			</div>
		</fieldset>
	);
}
