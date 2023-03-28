import { registerPlugin } from '@wordpress/plugins';
import {
	PluginMoreMenuItem,
	store as editPostStore,
} from '@wordpress/edit-post';
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
} from '@wordpress/interface';
import { store as preferencesStore } from '@wordpress/preferences';
import { SelectControl } from '@wordpress/components';
import type {
	ComponentProps,
	FunctionComponent,
	PropsWithChildren,
} from 'react';

import './styles.css';
import { store as recordingStore } from '../mediaRecording/store';

const PREFERENCES_NAME = 'media-experiments/preferences';

const EnableFeature = compose(
	withSelect((select, { featureName }) => {
		return {
			isChecked: Boolean(
				select(preferencesStore).get(PREFERENCES_NAME, featureName)
			),
		};
	}),
	withDispatch((dispatch, { featureName, onToggle = () => {} }) => ({
		onChange: () => {
			onToggle();
			dispatch(preferencesStore).toggle(PREFERENCES_NAME, featureName);
		},
	}))
)(BaseOption) as FunctionComponent<
	PropsWithChildren<
		Omit<
			ComponentProps<typeof BaseOption>,
			'isChecked' | 'onChange' | 'children'
		> & { featureName: string }
	>
>;

function BaseSelectOption({
	help,
	label,
	value,
	options,
	onChange,
	children,
}: PropsWithChildren<
	Pick<
		ComponentProps<typeof SelectControl>,
		'help' | 'label' | 'value' | 'options' | 'onChange'
	>
>) {
	return (
		<div className="interface-preferences-modal__option interface-preferences-modal__option--select">
			<SelectControl
				__nextHasNoMarginBottom
				help={help}
				label={label}
				value={value}
				options={options}
				onChange={onChange}
			/>
			{children}
		</div>
	);
}

const SelectFeature = compose(
	withSelect((select, { featureName }) => {
		return {
			value:
				select(preferencesStore).get(PREFERENCES_NAME, featureName) ||
				undefined,
		};
	}),
	withDispatch((dispatch, { featureName }) => ({
		onChange: (value) => {
			dispatch(preferencesStore).set(
				PREFERENCES_NAME,
				featureName,
				value
			);
		},
	}))
)(BaseSelectOption) as FunctionComponent<
	PropsWithChildren<
		Omit<
			ComponentProps<typeof BaseSelectOption>,
			'value' | 'onChange' | 'children'
		> & { featureName: string }
	>
>;

function Modal() {
	const { closeModal } = useDispatch(editPostStore);
	const isModalActive = useSelect((select) => {
		return select(editPostStore).isModalActive(PREFERENCES_NAME);
	}, []);

	const { videoDevices, audioDevices } = useSelect((select) => {
		const mediaDevices = select(recordingStore).getDevices();
		return {
			videoDevices: mediaDevices.filter(
				({ kind }) => kind === 'videoinput'
			),
			audioDevices: mediaDevices.filter(
				({ kind }) => kind === 'audioinput'
			),
		};
	}, []);

	const sections = useMemo(
		() => [
			{
				name: 'general',
				tabLabel: __('General', 'media-experiments'),
				content: (
					<>
						<PreferencesModalSection
							title={__('General', 'media-experiments')}
							description={__(
								'Customize options related to the media optimization flow.',
								'media-experiments'
							)}
						>
							<EnableFeature
								featureName="requireApproval"
								help={__(
									'Require approval step when optimizing existing videos or images.',
									'media-experiments'
								)}
								label={__('Approval', 'media-experiments')}
							/>
							<SelectFeature
								featureName="imageFormat"
								help={__(
									'Preferred file format when converting images.',
									'media-experiments'
								)}
								label={__('Image Format', 'media-experiments')}
								options={[
									{
										label: __(
											'WebP (Default)',
											'media-experiments'
										),
										value: 'webp',
									},
									{
										label: __('JPEG', 'media-experiments'),
										value: 'jpeg',
									},
									{
										label: __(
											'JPEG (MozJPEG)',
											'media-experiments'
										),
										value: 'mozjpeg',
									},
								]}
							/>
						</PreferencesModalSection>
					</>
				),
			},
			{
				name: 'recording',
				tabLabel: __('Recording', 'media-experiments'),
				content: (
					<>
						<PreferencesModalSection
							title={__('Recording', 'media-experiments')}
							description={__(
								'Customize options related to the media recording functionality.',
								'media-experiments'
							)}
						>
							<SelectFeature
								featureName="videoInput"
								help={__(
									'Default camera to use when recording video or taking pictures.',
									'media-experiments'
								)}
								label={__('Camera', 'media-experiments')}
								options={videoDevices.map((device) => ({
									label: device.label,
									value: device.deviceId,
								}))}
							/>
							<SelectFeature
								featureName="audioInput"
								help={__(
									'Default microphone to use when recording video / audio.',
									'media-experiments'
								)}
								label={__('Microphone', 'media-experiments')}
								options={audioDevices.map((device) => ({
									label: device.label,
									value: device.deviceId,
								}))}
							/>
						</PreferencesModalSection>
					</>
				),
			},
		],
		[videoDevices, audioDevices]
	);

	if (!isModalActive) {
		return null;
	}

	return (
		<PreferencesModal closeModal={closeModal}>
			<PreferencesModalTabs sections={sections} />
		</PreferencesModal>
	);
}

function PreferencesMenuItem() {
	const { openModal } = useDispatch(editPostStore);

	return (
		<>
			<PluginMoreMenuItem
				icon={media}
				onClick={() => {
					openModal(PREFERENCES_NAME);
				}}
			>
				{__('Media Preferences', 'media-experiments')}
			</PluginMoreMenuItem>
			<Modal />
		</>
	);
}

registerPlugin('media-experiments-preferences', {
	render: PreferencesMenuItem,
});

globalDispatch(preferencesStore).setDefaults(PREFERENCES_NAME, {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
	requireApproval: true,
	imageFormat: 'webp',
});
