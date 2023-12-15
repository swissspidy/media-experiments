import type { ComponentProps, PropsWithChildren } from 'react';

import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { ___unstablePreferencesModalBaseOption as BaseOption } from '@wordpress/interface';

import type { MediaPreferences } from '../types';
import { PREFERENCES_NAME } from './constants';

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
