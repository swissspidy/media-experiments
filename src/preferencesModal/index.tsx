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
	dispatch,
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
)(BaseOption);

function BaseSelectOption({ help, label, value, options, onChange, children }) {
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
)(BaseSelectOption);

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
				tabLabel: __('General'),
				content: (
					<>
						<PreferencesModalSection
							title={__('General')}
							description={__(
								'Customize options related to the media optimization flow.'
							)}
						>
							<EnableFeature
								featureName="requireApproval"
								help={__(
									'Require approval step when optimizing existing videos or images.'
								)}
								label={__('Approval')}
							/>
							<SelectFeature
								featureName="imageFormat"
								help={__(
									'Preferred file format when converting images.'
								)}
								label={__('Image Format')}
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
				tabLabel: __('Recording'),
				content: (
					<>
						<PreferencesModalSection
							title={__('Recording')}
							description={__(
								'Customize options related to the media recording functionality.'
							)}
						>
							<SelectFeature
								featureName="videoInput"
								help={__(
									'Default camera to use when recording video or taking pictures.'
								)}
								label={__('Camera')}
								options={videoDevices.map((device) => ({
									label: device.label,
									value: device.deviceId,
								}))}
							/>
							<SelectFeature
								featureName="audioInput"
								help={__(
									'Default microphone to use when recording video / audio.'
								)}
								label={__('Microphone')}
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

dispatch(preferencesStore).setDefaults(PREFERENCES_NAME, {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
	requireApproval: true,
	imageFormat: 'webp',
});
