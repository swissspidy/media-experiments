/**
 * External dependencies
 */
import type { ComponentProps, PropsWithChildren } from 'react';

/**
 * WordPress dependencies
 */
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Why is this still experimental?
	__experimentalUnitControl as UnitControl,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../constants';
import type { MediaPreferences } from '../types';

type FeatureNumberControlProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof UnitControl >,
		'value' | 'onChange' | 'children'
	> & { featureName: keyof MediaPreferences }
>;

export function FeatureNumberControl( props: FeatureNumberControlProps ) {
	const { featureName, ...remainingProps } = props;
	const value = useSelect(
		( select ) =>
			( select( preferencesStore ).get(
				PREFERENCES_NAME,
				featureName
			) as string ) || undefined,
		[ featureName ]
	);
	const { set } = useDispatch( preferencesStore );
	const onChange = ( newValue?: string ) => {
		void set(
			PREFERENCES_NAME,
			featureName,
			// Need to strip unit from received value.
			newValue ? Number( newValue.replace( /\D/g, '' ) ) : 0
		);
	};
	return (
		<UnitControl
			onChange={ onChange }
			value={ value }
			{ ...remainingProps }
		/>
	);
}
