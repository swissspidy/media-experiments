/**
 * External dependencies
 */
import type { ComponentProps, ReactNode } from 'react';

/**
 * WordPress dependencies
 */
import { ToggleControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import './editor.css';

interface BaseOptionProps
	extends Pick<
		ComponentProps< typeof ToggleControl >,
		'help' | 'label' | 'onChange'
	> {
	isChecked: boolean;
	children?: ReactNode;
}

export function BaseOption( {
	help,
	label,
	isChecked,
	onChange,
	children,
}: BaseOptionProps ) {
	return (
		<div className="preference-base-option">
			<ToggleControl
				__nextHasNoMarginBottom
				help={ help }
				label={ label }
				checked={ isChecked }
				onChange={ onChange }
			/>
			{ children }
		</div>
	);
}
