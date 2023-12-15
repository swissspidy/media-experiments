import type { ComponentProps, PropsWithChildren } from 'react';

import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Why is this still experimental?
	__experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';

import type { MediaPreferences } from '../types';
import { PREFERENCES_NAME } from './constants';

type FeatureNumberControlProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof NumberControl >,
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
		void set( PREFERENCES_NAME, featureName, newValue );
	};
	return (
		<NumberControl
			onChange={ onChange }
			value={ value }
			{ ...remainingProps }
		/>
	);
}
