/**
 * External dependencies
 */
import {
	store as recordingStore,
	type RecordingType,
} from '@mexp/media-recording';

/**
 * WordPress dependencies
 */
import {
	BaseControl,
	Button,
	ToolbarButton,
	ToolbarDropdownMenu,
	useBaseControlProps,
} from '@wordpress/components';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import { BlockControls } from '@wordpress/block-editor';
import { capturePhoto, check } from '@wordpress/icons';

/**
 * Internal dependencies
 */
import { ReactComponent as BlurOn } from '../icons/blur-on.svg';
import { ReactComponent as BlurOff } from '../icons/blur-off.svg';
import { ReactComponent as StartRecording } from '../icons/start-recording.svg';
import { ReactComponent as StopRecording } from '../icons/stop-recording.svg';
import { ReactComponent as PauseRecording } from '../icons/pause-recording.svg';
import { ReactComponent as ResumeRecording } from '../icons/resume-recording.svg';

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
		useMicrophone,
	} = useSelect( ( select ) => {
		const mediaDevices = select( recordingStore ).getDevices();
		const recordingTypes = select( recordingStore ).getRecordingTypes();
		return {
			useMicrophone:
				recordingTypes.includes( 'audio' ) ||
				recordingTypes.includes( 'video' ),
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

	if ( hasVideo ) {
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
			{ hasVideo && (
				<ToolbarDropdownMenu
					label={ __( 'Select Camera', 'media-experiments' ) }
					icon="camera"
					controls={ videoControls }
					toggleProps={ {
						disabled: videoDevices.length === 0,
					} }
				/>
			) }
			{ useMicrophone && (
				<ToolbarDropdownMenu
					label={ __( 'Select Microphone', 'media-experiments' ) }
					icon="microphone"
					controls={ audioControls }
				/>
			) }
		</>
	);
}

// See https://github.com/swissspidy/media-experiments/issues/530
const supportsCanvasBlur = 'filter' in CanvasRenderingContext2D.prototype;

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
	const { videoEffect, status, url, useMicrophone, hasVideo, hasCapture } =
		useSelect( ( select ) => {
			const recordingTypes = select( recordingStore ).getRecordingTypes();

			return {
				hasCapture: recordingTypes.includes( 'image' ),
				useMicrophone:
					recordingTypes.includes( 'audio' ) ||
					recordingTypes.includes( 'video' ),
				hasVideo: select( recordingStore ).hasVideo(),
				videoEffect: select( recordingStore ).getVideoEffect(),
				status: select( recordingStore ).getRecordingStatus(),
				url: select( recordingStore ).getUrl(),
			};
		}, [] );

	const isReady = 'ready' === status;
	const isStopped = 'stopped' === status;
	const isPaused = 'paused' === status;
	const isRecordingOrCountdown = [ 'countdown', 'recording' ].includes(
		status
	);
	const isRecording = 'recording' === status;

	return (
		<>
			<BlockControls group="block">
				<InputControls />
			</BlockControls>
			{ supportsCanvasBlur && hasVideo && (
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
										'Disable background blur',
										'media-experiments'
								  )
								: __(
										'Enable background blur',
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
				{ useMicrophone && ! isStopped ? (
					<>
						<ToolbarButton
							onClick={ () => {
								if ( isRecordingOrCountdown ) {
									void stopRecording();
								} else {
									void startRecording();
								}
							} }
							extraProps={ {
								disabled: ! isReady && ! isRecording,
							} }
							icon={
								! isRecordingOrCountdown ? (
									<StartRecording
										width={ 20 }
										height={ 20 }
									/>
								) : (
									<StopRecording width={ 20 } height={ 20 } />
								)
							}
							label={
								! isRecordingOrCountdown
									? __(
											'Start recording',
											'media-experiments'
									  )
									: __(
											'Stop recording',
											'media-experiments'
									  )
							}
						/>

						<ToolbarButton
							onClick={ () => {
								if ( isRecording ) {
									void pauseRecording();
								} else {
									void resumeRecording();
								}
							} }
							extraProps={ {
								disabled: ! isRecording && ! isPaused,
							} }
							icon={
								isPaused ? (
									<ResumeRecording
										width={ 24 }
										height={ 24 }
									/>
								) : (
									<PauseRecording
										width={ 20 }
										height={ 20 }
									/>
								)
							}
							label={
								isRecording
									? __(
											'Pause recording',
											'media-experiments'
									  )
									: __(
											'Resume recording',
											'media-experiments'
									  )
							}
						/>
					</>
				) : null }
				{ hasCapture && ! isStopped && (
					<ToolbarButton
						onClick={ () => {
							void captureImage();
						} }
						icon={ capturePhoto }
						label={ __( 'Capture photo', 'media-experiments' ) }
						extraProps={ {
							disabled: ! isReady,
						} }
					/>
				) }
				{ isStopped && (
					<>
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
					</>
				) }
			</BlockControls>
		</>
	);
}

interface RecordingControlsProps {
	url?: string;
	clientId: string;
	onInsert: ( url?: string ) => void;
	recordingTypes: RecordingType[];
}

export function RecordingControls( {
	url,
	clientId,
	onInsert,
	recordingTypes,
}: RecordingControlsProps ) {
	const { baseControlProps, controlProps } = useBaseControlProps( {} );

	const { enterRecordingMode, leaveRecordingMode } =
		useDispatch( recordingStore );

	const isInRecordingMode = useSelect(
		( select ) =>
			select( recordingStore ).isBlockInRecordingMode( clientId ),
		[ clientId ]
	);

	const onClick = () => {
		if ( isInRecordingMode ) {
			void leaveRecordingMode();
		} else {
			void enterRecordingMode( clientId, recordingTypes );
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
			<Button variant="secondary" onClick={ onClick } { ...controlProps }>
				{ isInRecordingMode
					? __( 'Exit', 'media-experiments' )
					: __( 'Start', 'media-experiments' ) }
			</Button>
		</BaseControl>
	);
}
