/**
 * External dependencies
 */
import type { ComponentProps, PropsWithChildren } from 'react';

/**
 * WordPress dependencies
 */
import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import { SelectControl } from '@wordpress/components';

/**
 * Internal dependencies
 */
import { PREFERENCES_NAME } from '../constants';
import type { MediaPreferences } from '../types';

function BaseSelectOption( {
	help,
	label,
	value,
	options,
	onChange,
	children,
	disabled,
}: PropsWithChildren<
	Pick<
		ComponentProps< typeof SelectControl >,
		'help' | 'label' | 'value' | 'options' | 'onChange' | 'disabled'
	>
> ) {
	return (
		<div className="interface-preferences-modal__option interface-preferences-modal__option--select">
			{ /* @ts-ignore -- TODO: Fix type */ }
			<SelectControl
				__nextHasNoMarginBottom
				__next40pxDefaultSize
				help={ help }
				label={ label }
				value={ value }
				options={ options }
				onChange={ onChange }
				disabled={ disabled }
			/>
			{ children }
		</div>
	);
}

type SelectFeatureProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof BaseSelectOption >,
		'value' | 'onChange' | 'children'
	> & { featureName: keyof MediaPreferences }
>;

export function SelectFeature( props: SelectFeatureProps ) {
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
	const onChange = ( newValue: string ) => {
		void set( PREFERENCES_NAME, featureName, newValue );
	};
	return (
		<BaseSelectOption
			onChange={ onChange }
			value={ value }
			{ ...remainingProps }
		/>
	);
}
