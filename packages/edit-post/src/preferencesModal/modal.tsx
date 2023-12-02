import type { ComponentProps, PropsWithChildren } from 'react';

import { useDispatch, useSelect } from '@wordpress/data';
import { store as preferencesStore } from '@wordpress/preferences';
import {
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Why is this still experimental?
	__experimentalNumberControl as NumberControl,
	SelectControl,
} from '@wordpress/components';
import {
	___unstablePreferencesModalBaseOption as BaseOption,
	PreferencesModal,
	PreferencesModalSection,
	PreferencesModalTabs,
	store as interfaceStore,
} from '@wordpress/interface';
import { useMemo } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { store as recordingStore } from '../mediaRecording/store';
import { PREFERENCES_NAME } from './constants';

type EnableFeatureProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof BaseOption >,
		'isChecked' | 'onChange' | 'children'
	> & { featureName: string }
>;

function EnableFeature( props: EnableFeatureProps ) {
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

function BaseSelectOption( {
	help,
	label,
	value,
	options,
	onChange,
	children,
}: PropsWithChildren<
	Pick<
		ComponentProps< typeof SelectControl >,
		'help' | 'label' | 'value' | 'options' | 'onChange'
	>
> ) {
	return (
		<div className="interface-preferences-modal__option interface-preferences-modal__option--select">
			{ /* @ts-ignore -- TODO: Fix type */ }
			<SelectControl
				__nextHasNoMarginBottom
				help={ help }
				label={ label }
				value={ value }
				options={ options }
				onChange={ onChange }
			/>
			{ children }
		</div>
	);
}

type SelectFeatureProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof BaseSelectOption >,
		'value' | 'onChange' | 'children'
	> & { featureName: string }
>;

function SelectFeature( props: SelectFeatureProps ) {
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

type FeatureNumberControlProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof NumberControl >,
		'value' | 'onChange' | 'children'
	> & { featureName: string }
>;

function FeatureNumberControl( props: FeatureNumberControlProps ) {
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

const EMPTY_ARRAY: never[] = [];

export function Modal() {
	const { closeModal } = useDispatch( interfaceStore );

	// TODO: Address warning that this hook returns different values when called with the same state and parameters.
	const { videoDevices, audioDevices } = useSelect( ( select ) => {
		const mediaDevices = select( recordingStore ).getDevices();
		return {
			videoDevices: mediaDevices.length
				? mediaDevices.filter( ( { kind } ) => kind === 'videoinput' )
				: EMPTY_ARRAY,
			audioDevices: mediaDevices.length
				? mediaDevices.filter( ( { kind } ) => kind === 'audioinput' )
				: EMPTY_ARRAY,
		};
	}, [] );

	// Safari does not currently support WebP in HTMLCanvasElement.toBlob()
	// See https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob
	const isSafari = Boolean(
		window?.navigator.userAgent &&
			window.navigator.userAgent.includes( 'Safari' ) &&
			! window.navigator.userAgent.includes( 'Chrome' ) &&
			! window.navigator.userAgent.includes( 'Chromium' )
	);

	const sections = useMemo(
		() => [
			{
				name: 'general',
				tabLabel: __( 'General', 'media-experiments' ),
				content: (
					<>
						<PreferencesModalSection
							title={ __( 'General', 'media-experiments' ) }
							description={ __(
								'Customize options related to the media optimization flow.',
								'media-experiments'
							) }
						>
							<EnableFeature
								featureName="requireApproval"
								help={ __(
									'Require approval step when optimizing existing videos or images.',
									'media-experiments'
								) }
								label={ __( 'Approval', 'media-experiments' ) }
							/>
							<SelectFeature
								featureName="imageFormat"
								help={ __(
									'Preferred file format when converting images.',
									'media-experiments'
								) }
								label={ __(
									'Image Format',
									'media-experiments'
								) }
								options={ [
									{
										label: __(
											'JPEG (Browser)',
											'media-experiments'
										),
										value: 'jpeg-browser',
									},
									{
										label: __(
											'WebP (Browser)',
											'media-experiments'
										),
										value: 'webp-browser',
										disabled: isSafari,
									},
									{
										label: __(
											'WebP (FFmpeg)',
											'media-experiments'
										),
										value: 'webp-ffmpeg',
									},
									{
										label: __(
											'JPEG (libvips)',
											'media-experiments'
										),
										value: 'jpeg-vips',
									},
									{
										label: __(
											'JPEG (MozJPEG)',
											'media-experiments'
										),
										value: 'jpeg-mozjpeg',
									},
									{
										label: __(
											'AVIF (libavif)',
											'media-experiments'
										),
										value: 'avif',
									},
								] }
							/>
							{ /* default for jpeg: 82, for webp: 86 */ }
							<FeatureNumberControl
								className="interface-preferences-modal__option interface-preferences-modal__option--number"
								label={ __(
									'Image Quality',
									'media-experiments'
								) }
								isShiftStepEnabled={ true }
								featureName="imageQuality"
								shiftStep={ 5 }
								max={ 100 }
								min={ 1 }
							/>
						</PreferencesModalSection>
					</>
				),
			},
			{
				name: 'recording',
				tabLabel: __( 'Recording', 'media-experiments' ),
				content: (
					<>
						<PreferencesModalSection
							title={ __( 'Recording', 'media-experiments' ) }
							description={ __(
								'Customize options related to the media recording functionality.',
								'media-experiments'
							) }
						>
							<SelectFeature
								featureName="videoInput"
								help={ __(
									'Default camera to use when recording video or taking pictures.',
									'media-experiments'
								) }
								label={ __( 'Camera', 'media-experiments' ) }
								options={ videoDevices.map( ( device ) => ( {
									label: device.label,
									value: device.deviceId,
								} ) ) }
							/>
							<SelectFeature
								featureName="audioInput"
								help={ __(
									'Default microphone to use when recording video / audio.',
									'media-experiments'
								) }
								label={ __(
									'Microphone',
									'media-experiments'
								) }
								options={ audioDevices.map( ( device ) => ( {
									label: device.label,
									value: device.deviceId,
								} ) ) }
							/>
						</PreferencesModalSection>
					</>
				),
			},
		],
		[ videoDevices, audioDevices, isSafari ]
	);

	return (
		<PreferencesModal closeModal={ closeModal }>
			<PreferencesModalTabs sections={ sections } />
		</PreferencesModal>
	);
}
