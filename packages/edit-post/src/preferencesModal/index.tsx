import { registerPlugin } from '@wordpress/plugins';
import { PluginMoreMenuItem } from '@wordpress/edit-post';
import { media } from '@wordpress/icons';
import { __ } from '@wordpress/i18n';
import { useMemo } from '@wordpress/element';
import {
	useDispatch,
	useSelect,
	withSelect,
	withDispatch,
	dispatch as globalDispatch,
} from '@wordpress/data';
import { compose } from '@wordpress/compose';
import {
	PreferencesModal,
	PreferencesModalTabs,
	PreferencesModalSection,
	___unstablePreferencesModalBaseOption as BaseOption,
	store as interfaceStore,
} from '@wordpress/interface';
import { store as preferencesStore } from '@wordpress/preferences';
import {
	SelectControl,
	// eslint-disable-next-line @wordpress/no-unsafe-wp-apis -- Why is this still experimental?
	__experimentalNumberControl as NumberControl,
} from '@wordpress/components';
import type {
	ComponentProps,
	FunctionComponent,
	PropsWithChildren,
} from 'react';

import './styles.css';
import { store as recordingStore } from '../mediaRecording/store';

const PREFERENCES_NAME = 'media-experiments/preferences';

type EnableFeatureProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof BaseOption >,
		'isChecked' | 'onChange' | 'children'
	> & { featureName: string }
>;

const EnableFeature = compose(
	withSelect( ( select, { featureName }: EnableFeatureProps ) => {
		return {
			isChecked: Boolean(
				select( preferencesStore ).get( PREFERENCES_NAME, featureName )
			),
		};
	} ),
	withDispatch(
		(
			dispatch,
			{ featureName, onToggle = () => {} }: EnableFeatureProps
		) => ( {
			onChange: () => {
				onToggle();
				dispatch( preferencesStore ).toggle(
					PREFERENCES_NAME,
					featureName
				);
			},
		} )
	)
)( BaseOption ) as FunctionComponent< EnableFeatureProps >;

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

const SelectFeature = compose(
	withSelect( ( select, { featureName }: SelectFeatureProps ) => {
		return {
			value:
				select( preferencesStore ).get(
					PREFERENCES_NAME,
					featureName
				) || undefined,
		};
	} ),
	withDispatch( ( dispatch, { featureName }: SelectFeatureProps ) => ( {
		onChange: ( value: string | number ) => {
			dispatch( preferencesStore ).set(
				PREFERENCES_NAME,
				featureName,
				value
			);
		},
	} ) )
)( BaseSelectOption ) as FunctionComponent< SelectFeatureProps >;

type FeatureNumberControlProps = PropsWithChildren<
	Omit<
		ComponentProps< typeof NumberControl >,
		'value' | 'onChange' | 'children'
	> & { featureName: string }
>;

const FeatureNumberControl = compose(
	withSelect( ( select, { featureName }: FeatureNumberControlProps ) => {
		return {
			value:
				select( preferencesStore ).get(
					PREFERENCES_NAME,
					featureName
				) || undefined,
		};
	} ),
	withDispatch( ( dispatch, { featureName }: SelectFeatureProps ) => ( {
		onChange: ( value: string | number ) => {
			dispatch( preferencesStore ).set(
				PREFERENCES_NAME,
				featureName,
				value
			);
		},
	} ) )
)( NumberControl ) as FunctionComponent< FeatureNumberControlProps >;

const EMPTY_ARRAY: never[] = [];

function Modal() {
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

function PreferencesMenuItem() {
	const { openModal } = useDispatch( interfaceStore );
	const isModalActive = useSelect( ( select ) => {
		return select( interfaceStore ).isModalActive( PREFERENCES_NAME );
	}, [] );

	return (
		<>
			<PluginMoreMenuItem
				icon={ media }
				onClick={ () => {
					openModal( PREFERENCES_NAME );
				} }
			>
				{ __( 'Media Preferences', 'media-experiments' ) }
			</PluginMoreMenuItem>
			{ isModalActive && <Modal /> }
		</>
	);
}

registerPlugin( 'media-experiments-preferences', {
	render: PreferencesMenuItem,
} );

void globalDispatch( preferencesStore ).setDefaults( PREFERENCES_NAME, {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
	requireApproval: true,
	imageFormat: 'webp',
	imageQuality: 82,
} );
