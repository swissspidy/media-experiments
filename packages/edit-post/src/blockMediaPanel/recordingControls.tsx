import {
	BaseControl,
	Button,
	ToolbarButton,
	ToolbarDropdownMenu,
	useBaseControlProps,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import { store as recordingStore } from '../mediaRecording/store';
import { Fragment } from '@wordpress/element';
import { BlockControls } from '@wordpress/block-editor';
import { capturePhoto, check } from '@wordpress/icons';

import { ReactComponent as BlurOn } from '../icons/blurOn.svg';
import { ReactComponent as BlurOff } from '../icons/blurOff.svg';

function InputControls() {
	const { setVideoInput, setAudioInput, toggleHasAudio } =
		useDispatch( recordingStore );

	const {
		videoInput,
		audioInput,
		hasVideo,
		hasAudio,
		videoDevices,
		audioDevices,
		recordingType,
	} = useSelect( ( select ) => {
		const mediaDevices = select( recordingStore ).getDevices();
		return {
			recordingType: select( recordingStore ).getRecordingType(),
			videoInput: select( recordingStore ).getVideoInput(),
			audioInput: select( recordingStore ).getAudioInput(),
			hasVideo: select( recordingStore ).hasVideo(),
			hasAudio: select( recordingStore ).hasAudio(),
			videoDevices: mediaDevices.filter(
				( { kind } ) => kind === 'videoinput'
			),
			audioDevices: mediaDevices.filter(
				( { kind } ) => kind === 'audioinput'
			),
		};
	}, [] );

	// TODO: The default camera and microphone should be retrieved from preferences.

	const videoControls = videoDevices.map( ( device ) => ( {
		title: device.label,
		onClick: () => {
			void setVideoInput( device.deviceId );
		},
		isActive: videoInput === device.deviceId,
		role: 'menuitemradio',
		icon: hasVideo && videoInput === device.deviceId ? check : undefined,
	} ) );

	// Videos can be recorded with or without audio.
	const audioControls = audioDevices.map( ( device ) => ( {
		title: device.label,
		onClick: () => {
			void setAudioInput( device.deviceId );
		},
		isActive: audioInput === device.deviceId,
		role: 'menuitemradio',
		icon: hasAudio && audioInput === device.deviceId ? check : undefined,
	} ) );

	if ( 'video' === recordingType ) {
		audioControls.unshift( {
			title: __( 'No Microphone', 'media-experiments' ),
			onClick: () => {
				void toggleHasAudio();
			},
			isActive: ! hasAudio,
			role: 'menuitemradio',
			icon: ! hasAudio ? check : undefined,
		} );
	}

	return (
		<>
			{ 'audio' !== recordingType && (
				<ToolbarDropdownMenu
					label={ __( 'Select Camera', 'media-experiments' ) }
					icon="camera"
					controls={ videoControls }
					toggleProps={ {
						disabled: videoDevices.length === 0,
					} }
				/>
			) }
			{ 'image' !== recordingType && (
				<ToolbarDropdownMenu
					label={ __( 'Select Microphone', 'media-experiments' ) }
					icon="microphone"
					controls={ audioControls }
				/>
			) }
		</>
	);
}

interface ToolbarControlsProps {
	onInsert: ( url?: string ) => void;
}

function ToolbarControls( { onInsert }: ToolbarControlsProps ) {
	const {
		toggleBlurEffect,
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		retryRecording,
		captureImage,
		leaveRecordingMode,
	} = useDispatch( recordingStore );
	const { videoEffect, status, recordingType, url } = useSelect(
		( select ) => ( {
			videoEffect: select( recordingStore ).getVideoEffect(),
			status: select( recordingStore ).getRecordingStatus(),
			recordingType: select( recordingStore ).getRecordingType(),
			url: select( recordingStore ).getUrl(),
		} ),
		[]
	);

	const isReady = 'ready' === status;
	const isStopped = 'stopped' === status;
	const isPaused = 'paused' === status;
	const isRecordingOrCountdown = [ 'countdown', 'recording' ].includes(
		status
	);
	const isRecording = 'recording' === status;

	return (
		<Fragment>
			<BlockControls group="block">
				<InputControls />
			</BlockControls>
			{ 'audio' !== recordingType && (
				<BlockControls group="inline">
					<ToolbarButton
						onClick={ () => {
							void toggleBlurEffect();
						} }
						isPressed={ 'blur' === videoEffect }
						icon={
							'blur' === videoEffect ? (
								<BlurOff width={ 32 } height={ 32 } />
							) : (
								<BlurOn width={ 32 } height={ 32 } />
							)
						}
						label={
							'blur' === videoEffect
								? __(
										'Disable Background Blur',
										'media-experiments'
								  )
								: __(
										'Enable Background Blur',
										'media-experiments'
								  )
						}
						extraProps={ {
							disabled: ! isReady,
						} }
					/>
				</BlockControls>
			) }
			<BlockControls group="other">
				{ 'image' !== recordingType && (
					<Fragment>
						{ ! isStopped && (
							<ToolbarButton
								onClick={ () => {
									if ( isRecordingOrCountdown ) {
										void stopRecording();
									} else {
										void startRecording();
									}
								} }
								extraProps={ {
									disabled:
										! isReady && ! isRecordingOrCountdown,
								} }
							>
								{ ! isRecordingOrCountdown
									? __( 'Start', 'media-experiments' )
									: __( 'Stop', 'media-experiments' ) }
							</ToolbarButton>
						) }
						{ isRecording && (
							<ToolbarButton
								onClick={ () => {
									void pauseRecording();
								} }
							>
								{ __( 'Pause', 'media-experiments' ) }
							</ToolbarButton>
						) }
						{ isPaused && (
							<ToolbarButton
								onClick={ () => {
									void resumeRecording();
								} }
							>
								{ __( 'Resume', 'media-experiments' ) }
							</ToolbarButton>
						) }
					</Fragment>
				) }
				{ 'image' === recordingType && ! isStopped && (
					<ToolbarButton
						onClick={ () => {
							void captureImage();
						} }
						icon={ capturePhoto }
						label={ __( 'Capture Photo', 'media-experiments' ) }
						extraProps={ {
							disabled: ! isReady,
						} }
					/>
				) }
				{ isStopped && (
					<Fragment>
						<ToolbarButton
							onClick={ () => {
								// Upload the file and leave recording mode.

								// TODO: Revisit implementation.
								// Right now, the video block itself already handles uploading
								// when it sees a blob URL, so just calling `setAttributes` is enough.
								// TODO: How to set media source 'media-recording'? Or not needed?

								// TODO: Maybe pass Attachment object instead of just the URL?
								onInsert( url );

								void leaveRecordingMode();
							} }
						>
							{ __( 'Insert', 'media-experiments' ) }
						</ToolbarButton>
						<ToolbarButton
							onClick={ () => {
								void retryRecording();
							} }
						>
							{ __( 'Retry', 'media-experiments' ) }
						</ToolbarButton>
					</Fragment>
				) }
			</BlockControls>
		</Fragment>
	);
}

interface RecordingControlsProps {
	url?: string;
	clientId: string;
	onInsert: ( url?: string ) => void;
}

export function RecordingControls( {
	url,
	clientId,
	onInsert,
}: RecordingControlsProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const { enterRecordingMode, leaveRecordingMode } =
		useDispatch( recordingStore );

	const isInRecordingMode = useSelect(
		( select ) => select( recordingStore ).isInRecordingMode(),
		[]
	);

	const onClick = () => {
		if ( isInRecordingMode ) {
			void leaveRecordingMode();
		} else {
			void enterRecordingMode( clientId );
		}
	};

	if ( url ) {
		return null;
	}

	return (
		<BaseControl { ...baseControlProps }>
			<BaseControl.VisualLabel>
				{ __( 'Self Recording', 'media-experiments' ) }
			</BaseControl.VisualLabel>
			{ isInRecordingMode ? (
				<ToolbarControls onInsert={ onInsert } />
			) : null }
			<p>
				{ __(
					"Use your device's camera and microphone to record video, audio, or take a still picture",
					'media-experiments'
				) }
			</p>
			<Button variant="primary" onClick={ onClick } { ...controlProps }>
				{ isInRecordingMode
					? __( 'Exit', 'media-experiments' )
					: __( 'Start', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
