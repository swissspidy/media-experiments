import { createHigherOrderComponent } from '@wordpress/compose';
import { BlockControls, useBlockProps, Warning } from '@wordpress/block-editor';
import { addFilter } from '@wordpress/hooks';
import { useDispatch, useSelect } from '@wordpress/data';
import { ToolbarButton, ToolbarDropdownMenu } from '@wordpress/components';
import { audio, check, capturePhoto } from '@wordpress/icons';
import { Fragment, useEffect, useState } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

import { getMediaTypeFromMimeType } from '@mexp/media-utils';

import { store as recordingStore } from './store';
import AudioAnalyzer from './audioAnalyzer';

import { ReactComponent as BlurOn } from './icons/blurOn.svg';
import { ReactComponent as BlurOff } from './icons/blurOff.svg';

const SUPPORTED_BLOCKS = ['core/image', 'core/audio', 'core/video'];

function InputControls() {
	const { setVideoInput, setAudioInput, toggleHasAudio } =
		useDispatch(recordingStore);

	const {
		videoInput,
		audioInput,
		hasVideo,
		hasAudio,
		videoDevices,
		audioDevices,
		recordingType,
	} = useSelect((select) => {
		const mediaDevices = select(recordingStore).getDevices();
		return {
			recordingType: select(recordingStore).getRecordingType(),
			videoInput: select(recordingStore).getVideoInput(),
			audioInput: select(recordingStore).getAudioInput(),
			hasVideo: select(recordingStore).hasVideo(),
			hasAudio: select(recordingStore).hasAudio(),
			videoDevices: mediaDevices.filter(
				({ kind }) => kind === 'videoinput'
			),
			audioDevices: mediaDevices.filter(
				({ kind }) => kind === 'audioinput'
			),
		};
	}, []);

	// TODO: The default camera and microphone should be retrieved from preferences.

	const videoControls = videoDevices.map((device) => ({
		title: device.label,
		onClick: () => setVideoInput(device.deviceId),
		isActive: videoInput === device.deviceId,
		role: 'menuitemradio',
		icon: hasVideo && videoInput === device.deviceId && check,
	}));

	// Videos can be recorded with or without audio.
	const audioControls = [
		'video' === recordingType && {
			title: __('No Microphone', 'media-experiments'),
			onClick: () => toggleHasAudio(),
			isActive: !hasAudio,
			role: 'menuitemradio',
			icon: !hasAudio && check,
		},
		...audioDevices.map((device) => ({
			title: device.label,
			onClick: () => setAudioInput(device.deviceId),
			isActive: audioInput === device.deviceId,
			role: 'menuitemradio',
			icon: hasAudio && audioInput === device.deviceId && check,
		})),
	].filter(Boolean);

	return (
		<Fragment>
			{'audio' !== recordingType && (
				<ToolbarDropdownMenu
					label={__('Select Camera', 'media-experiments')}
					icon="camera"
					controls={videoControls}
					toggleProps={{
						disabled: videoDevices.length === 0,
					}}
				/>
			)}
			{'image' !== recordingType && (
				<ToolbarDropdownMenu
					label={__('Select Microphone', 'media-experiments')}
					icon="microphone"
					controls={audioControls}
				/>
			)}
		</Fragment>
	);
}

function ErrorDialog() {
	const { hasVideo, error } = useSelect(
		(select) => ({
			hasVideo: select(recordingStore).hasVideo(),
			error: select(recordingStore).getError(),
		}),
		[]
	);

	let errorMessage = error?.message;

	// Use some more human-readable error messages for most common scenarios.
	// See https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#exceptions
	if (!window.isSecureContext) {
		errorMessage = __(
			'Requires a secure browsing context (HTTPS)',
			'media-experiments'
		);
	} else if (error?.name === 'NotAllowedError') {
		errorMessage = __('Permission denied', 'media-experiments');
	} else if (
		!hasVideo ||
		error?.name === 'NotFoundError' ||
		error?.name === 'OverConstrainedError'
	) {
		errorMessage = __('No camera found', 'media-experiments');
	}

	return <Warning>{errorMessage}</Warning>;
}

function PermissionsDialog() {
	return (
		<Warning>
			{__(
				'To get started, you need to allow access to your camera and microphone.',
				'media-experiments'
			)}
		</Warning>
	);
}

function Countdown() {
	const { countdown, isCounting } = useSelect(
		(select) => ({
			countdown: select(recordingStore).getCountdown(),
			isCounting:
				'countdown' === select(recordingStore).getRecordingStatus(),
		}),
		[]
	);

	if (isCounting) {
		return <Fragment>{`Countdown: ${countdown}`}</Fragment>;
	}

	return null;
}

function Duration() {
	const { duration, isRecording } = useSelect(
		(select) => ({
			duration: select(recordingStore).getDuration(),
			isRecording: ['recording', 'paused'].includes(
				select(recordingStore).getRecordingStatus()
			),
		}),
		[]
	);

	if (isRecording && duration >= 0) {
		return <Fragment>{`Duration: ${duration}`}</Fragment>;
	}

	return null;
}

function Recorder() {
	const [streamNode, setStreamNode] = useState<HTMLVideoElement | null>();
	const {
		videoInput,
		status,
		error,
		liveStream,
		url,
		recordingType,
		mediaType,
		dimensions,
		isGifMode,
		isMuted,
	} = useSelect((select) => {
		const file = select(recordingStore).getFile();
		const isGif = select(recordingStore).isGifMode();

		return {
			videoInput: select(recordingStore).getVideoInput(),
			status: select(recordingStore).getRecordingStatus(),
			error: select(recordingStore).getError(),
			liveStream: select(recordingStore).getMediaStream(),
			recordingType: select(recordingStore).getRecordingType(),
			mediaType: file ? getMediaTypeFromMimeType(file.type) : null,
			url: select(recordingStore).getUrl(),
			dimensions: select(recordingStore).getDimensions(),
			isGifMode: isGif,
			isMuted: !select(recordingStore).hasAudio || isGif,
		};
	}, []);

	useEffect(() => {
		if (!streamNode) {
			return;
		}

		if (liveStream) {
			streamNode.srcObject = liveStream;
		}

		if (!liveStream) {
			streamNode.srcObject = null;
		}
	}, [streamNode, liveStream]);

	const isFailed = 'failed' === status || Boolean(error);
	const needsPermissions =
		('idle' === status || 'acquiringMedia' === status) && !videoInput;

	if (isFailed) {
		return <ErrorDialog />;
	}

	if (needsPermissions) {
		return <PermissionsDialog />;
	}

	if (url) {
		switch (mediaType) {
			case 'image':
				return (
					<img
						src={url}
						decoding="async"
						alt={__('Image capture', 'media-experiments')}
						width={dimensions.width}
						height={dimensions.height}
					/>
				);

			case 'video':
				return (
					<video
						controls
						muted={isMuted}
						loop={isGifMode}
						src={url}
					/>
				);

			case 'audio':
				return <audio controls src={url} />;

			default:
			// This should never happen.
		}
	}

	// TODO: Don't show livestream if we're still capturing the image.
	// "capturingImage" or "stopping" state.

	if (liveStream) {
		return (
			<Fragment>
				<Countdown />
				<Duration />
				{'audio' === recordingType ? (
					<AudioAnalyzer source={liveStream} />
				) : (
					<video
						ref={setStreamNode}
						disablePictureInPicture
						autoPlay
						muted
					/>
				)}
			</Fragment>
		);
	}

	// TODO: Maybe show fallback loading state or something.
	return (
		<Fragment>
			<Countdown />
			<Duration />
			{'Loading...'}
		</Fragment>
	);
}

interface RecordingBlockControlsProps {
	setAttributes: (attributes: Record<string, unknown>) => void;
}

function RecordingBlockControls({
	setAttributes,
}: RecordingBlockControlsProps) {
	const {
		toggleBlurEffect,
		startRecording,
		stopRecording,
		pauseRecording,
		resumeRecording,
		retryRecording,
		captureImage,
		leaveRecordingMode,
	} = useDispatch(recordingStore);
	const { videoEffect, status, recordingType, url } = useSelect(
		(select) => ({
			videoEffect: select(recordingStore).getVideoEffect(),
			status: select(recordingStore).getRecordingStatus(),
			recordingType: select(recordingStore).getRecordingType(),
			url: select(recordingStore).getUrl(),
		}),
		[]
	);

	const isReady = 'ready' === status;
	const isStopped = 'stopped' === status;
	const isPaused = 'paused' === status;
	const isRecordingOrCountdown = ['countdown', 'recording'].includes(status);
	const isRecording = 'recording' === status;

	return (
		<Fragment>
			<BlockControls group="block">
				<InputControls />
			</BlockControls>
			{'audio' !== recordingType && (
				<BlockControls group="inline">
					<ToolbarButton
						onClick={() => {
							toggleBlurEffect();
						}}
						isPressed={'blur' === videoEffect}
						icon={
							'blur' === videoEffect ? (
								<BlurOff width={32} height={32} />
							) : (
								<BlurOn width={32} height={32} />
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
						extraProps={{
							disabled: !isReady,
						}}
					/>
				</BlockControls>
			)}
			<BlockControls group="other">
				{'image' !== recordingType && (
					<Fragment>
						{!isStopped && (
							<ToolbarButton
								onClick={() => {
									if (isRecordingOrCountdown) {
										stopRecording();
									} else {
										startRecording();
									}
								}}
								extraProps={{
									disabled:
										!isReady && !isRecordingOrCountdown,
								}}
							>
								{!isRecordingOrCountdown
									? __('Start', 'media-experiments')
									: __('Stop', 'media-experiments')}
							</ToolbarButton>
						)}
						{isRecording && (
							<ToolbarButton
								onClick={() => {
									pauseRecording();
								}}
							>
								{__('Pause', 'media-experiments')}
							</ToolbarButton>
						)}
						{isPaused && (
							<ToolbarButton
								onClick={() => {
									resumeRecording();
								}}
							>
								{__('Resume', 'media-experiments')}
							</ToolbarButton>
						)}
					</Fragment>
				)}
				{'image' === recordingType && !isStopped && (
					<ToolbarButton
						onClick={() => {
							captureImage();
						}}
						icon={capturePhoto}
						label={__('Capture Photo', 'media-experiments')}
						extraProps={{
							disabled: !isReady,
						}}
					/>
				)}
				{isStopped && (
					<Fragment>
						<ToolbarButton
							onClick={() => {
								// Upload the file and leave recording mode.

								// TODO: Implement
								// Either the block itself implements the uploading part
								// and we just use setAttributes, or we have to
								// use mediaUpload ourselves and do it manually.
								// TODO: How to set media source 'media-recording'? Or not needed?
								switch (recordingType) {
									case 'audio':
									case 'image':
										setAttributes({ url });
										break;

									case 'video':
										setAttributes({ src: url });
										break;
								}

								leaveRecordingMode();
							}}
						>
							{__('Insert', 'media-experiments')}
						</ToolbarButton>
						<ToolbarButton
							onClick={() => {
								retryRecording();
							}}
						>
							{__('Retry', 'media-experiments')}
						</ToolbarButton>
					</Fragment>
				)}
			</BlockControls>
		</Fragment>
	);
}

const addMediaRecording = createHigherOrderComponent(
	(BlockEdit) => (props) => {
		const { updateMediaDevices } = useDispatch(recordingStore);
		const isInRecordingMode = useSelect(
			(select) => {
				return select(recordingStore).isBlockInRecordingMode(
					props.clientId
				);
			},
			[props.clientId]
		);

		const blockProps = useBlockProps({
			className: props.className,
		});

		useEffect(() => {
			// navigator.mediaDevices is undefined in insecure browsing contexts.
			if (!navigator.mediaDevices) {
				return undefined;
			}

			// Note: Safari will fire the devicechange event right after granting permissions,
			// and then calling enumerateDevices() will trigger another permission prompt.
			// TODO: Figure out a good way to work around that.
			navigator.mediaDevices.addEventListener(
				'devicechange',
				updateMediaDevices
			);

			return () => {
				navigator.mediaDevices.removeEventListener(
					'devicechange',
					updateMediaDevices
				);
			};
		}, [updateMediaDevices]);

		if (!SUPPORTED_BLOCKS.includes(props.name)) {
			return <BlockEdit {...props} />;
		}

		if (!isInRecordingMode) {
			return <BlockEdit {...props} />;
		}

		return (
			<div {...blockProps}>
				<RecordingBlockControls {...props} />
				<Recorder />
			</div>
		);
	},
	'withMediaRecording'
);

addFilter(
	'editor.BlockEdit',
	'media-experiments/add-media-recording',
	addMediaRecording,
	5
);
