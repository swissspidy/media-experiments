/**
 * External dependencies
 */
import type { ComponentProps, PropsWithChildren } from 'react';

/**
 * WordPress dependencies
 */
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../constants';
import type { MediaPreferences } from '../types';
import { BaseOption } from './preference-base-option';

type EnableFeatureProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof BaseOption >,
		'isChecked' | 'onChange' | 'children'
	> & { featureName: keyof MediaPreferences }
>;

export function EnableFeature( props: EnableFeatureProps ) {
	const { featureName, ...remainingProps } = props;
	const isChecked = useSelect(
		( select ) =>
			Boolean(
				select( preferencesStore ).get( PREFERENCES_NAME, featureName )
			),
		[ featureName ]
	);
	const { toggle } = useDispatch( preferencesStore );
	const onChange = () => {
		void toggle( PREFERENCES_NAME, featureName );
	};
	return (
		<BaseOption
			onChange={ onChange }
			isChecked={ isChecked }
			{ ...remainingProps }
		/>
	);
}
