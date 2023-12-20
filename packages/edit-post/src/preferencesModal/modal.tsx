import { useDispatch, useSelect } from '@wordpress/data';
import {
	PreferencesModal,
	PreferencesModalSection,
	PreferencesModalTabs,
	store as interfaceStore,
} from '@wordpress/interface';
import { useMemo } from '@wordpress/element';
import { __, _x, sprintf } from '@wordpress/i18n';

import { store as recordingStore } from '../mediaRecording/store';
import { FeatureNumberControl } from './numberControl';
import { SelectFeature } from './selectFeature';
import { EnableFeature } from './enableFeature';

type InputFormat = 'jpeg' | 'webp' | 'avif' | 'png' | 'heic' | 'gif';
type InputFormatLabel = 'JPEG' | 'PNG' | 'WebP' | 'AVIF' | 'HEIC' | 'GIF';

const inputFormats: InputFormatLabel[] = [
	'JPEG',
	'PNG',
	'WebP',
	'AVIF',
	'HEIC',
	'GIF',
];

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

	const sections = useMemo(
		() => [
			{
				name: 'general',
				tabLabel: __( 'General', 'media-experiments' ),
				content: (
					<PreferencesModalSection
						title={ __( 'General', 'media-experiments' ) }
						description={ __(
							'Customize options related to the media upload flow.',
							'media-experiments'
						) }
					>
						<EnableFeature
							featureName="requireApproval"
							help={ __(
								'Require approval step when optimizing existing videos or images.',
								'media-experiments'
							) }
							label={ __( 'Approval step', 'media-experiments' ) }
						/>
						<EnableFeature
							featureName="optimizeOnUpload"
							help={ __(
								'Compress and optimize media items before uploading to the server.',
								'media-experiments'
							) }
							label={ __(
								'Pre-upload compression',
								'media-experiments'
							) }
						/>
						<SelectFeature
							featureName="thumbnailGeneration"
							help={ __(
								'Preferred method for thumbnail generation.',
								'media-experiments'
							) }
							label={ __(
								'Thumbnail generation',
								'media-experiments'
							) }
							options={ [
								{
									label: __(
										'Legacy (server-side)',
										'media-experiments'
									),
									value: 'server',
								},
								{
									label: __(
										'Regular (client-side)',
										'media-experiments'
									),
									value: 'client',
								},
								{
									label: __(
										'Smart (saliency-aware)',
										'media-experiments'
									),
									value: 'smart',
								},
							] }
						/>
						<SelectFeature
							featureName="imageLibrary"
							help={ __(
								'Preferred library to use for image conversion.',
								'media-experiments'
							) }
							label={ __( 'Image Library', 'media-experiments' ) }
							options={ [
								{
									label: __( 'Browser', 'media-experiments' ),
									value: 'browser',
								},
								{
									label: __( 'libvips', 'media-experiments' ),
									value: 'vips',
								},
							] }
						/>
						<FeatureNumberControl
							className="interface-preferences-modal__option interface-preferences-modal__option--number"
							label={ __(
								'Big image size threshold',
								'media-experiments'
							) }
							isShiftStepEnabled={ true }
							featureName="bigImageSizeThreshold"
							shiftStep={ 10 }
							max={ 10000 }
							min={ 0 }
							units={ [
								{
									value: 'px',
									label: 'px',
									a11yLabel: __(
										'Pixels (px)',
										'media-experiments'
									),
									step: 1,
								},
							] }
						/>
					</PreferencesModalSection>
				),
			},
			{
				name: 'formats',
				tabLabel: __( 'Formats', 'media-experiments' ),
				content: (
					<>
						<PreferencesModalSection
							title={ _x(
								'Default',
								'image format',
								'media-experiments'
							) }
							description={ __(
								'Specify the default format for newly generated images, such as poster images.',
								'media-experiments'
							) }
						>
							<SelectFeature
								featureName="default_outputFormat"
								help={ __(
									'Default file type for new images.',
									'media-experiments'
								) }
								label={ __(
									'Image Format',
									'media-experiments'
								) }
								options={ [
									{
										label: 'JPEG',
										value: 'jpeg',
									},
									{
										label: 'PNG',
										value: 'png',
									},
									{
										label: 'GIF',
										value: 'gif',
									},
									{
										label: 'WebP',
										value: 'webp',
									},
									{
										label: 'AVIF',
										value: 'avif',
									},
								] }
							/>
						</PreferencesModalSection>
						{ inputFormats.map( ( inputFormat ) => (
							<PreferencesModalSection
								key={ inputFormat }
								title={ inputFormat }
								description={ sprintf(
									/* translators: %s: image format. */
									__(
										'Tweak the behavior for %s images.',
										'media-experiments'
									),
									inputFormat
								) }
							>
								<SelectFeature
									featureName={ `${
										inputFormat.toLowerCase() as InputFormat
									}_outputFormat` }
									help={ __(
										'Preferred file type to convert images to.',
										'media-experiments'
									) }
									label={ __(
										'Image Format',
										'media-experiments'
									) }
									options={ [
										{
											label: 'JPEG',
											value: 'jpeg',
										},
										{
											label: 'PNG',
											value: 'png',
										},
										{
											label: 'GIF',
											value: 'gif',
										},
										{
											label: 'WebP',
											value: 'webp',
										},
										{
											label: 'AVIF',
											value: 'avif',
										},
									].map( ( option ) => {
										if ( inputFormat === option.label ) {
											option.label = sprintf(
												/* translators: %s: image format */
												__(
													'%s (unchanged)',
													'media-experiments'
												),
												inputFormat
											);
										}
										return option;
									} ) }
								/>
								{ /* default for jpeg: 82, for webp: 86 */ }
								<FeatureNumberControl
									className="interface-preferences-modal__option interface-preferences-modal__option--number"
									label={ __(
										'Image Quality',
										'media-experiments'
									) }
									isShiftStepEnabled={ true }
									featureName={ `${
										inputFormat.toLowerCase() as InputFormat
									}_quality` }
									shiftStep={ 5 }
									max={ 100 }
									min={ 1 }
									units={ [
										{
											value: '%',
											label: '%',
											a11yLabel: __(
												'Percent (%)',
												'media-experiments'
											),
											step: 1,
										},
									] }
								/>
								{ 'GIF' === inputFormat ? (
									<EnableFeature
										featureName="gif_convert"
										help={ __(
											'Convert animated GIFs to videos.',
											'media-experiments'
										) }
										label={ __(
											'Convert animated GIFs',
											'media-experiments'
										) }
									/>
								) : null }
							</PreferencesModalSection>
						) ) }
					</>
				),
			},
			{
				name: 'recording',
				tabLabel: __( 'Recording', 'media-experiments' ),
				content: (
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
							label={ __( 'Microphone', 'media-experiments' ) }
							options={ audioDevices.map( ( device ) => ( {
								label: device.label,
								value: device.deviceId,
							} ) ) }
						/>
					</PreferencesModalSection>
				),
			},
		],
		[ videoDevices, audioDevices ]
	);

	return (
		<PreferencesModal closeModal={ closeModal }>
			<PreferencesModalTabs sections={ sections } />
		</PreferencesModal>
	);
}
