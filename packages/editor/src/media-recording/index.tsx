/**
 * External dependencies
 */
import { store as recordingStore } from '@mexp/media-recording';

/**
 * WordPress dependencies
 */
import { createHigherOrderComponent } from '@wordpress/compose';
import { Warning, useBlockProps } from '@wordpress/block-editor';
import { addFilter } from '@wordpress/hooks';
import { useDispatch, useSelect } from '@wordpress/data';
import { useEffect, useRef } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

/**
 * Internal dependencies
 */
import type { MediaPanelProps } from '../types';
import './blocks.css';
import { formatSecondsToMinutesSeconds } from './utils';
import { UnfinishedRecordingWarning } from './unfinished-recording-warning';
import AudioAnalyzer from './audio-analyzer';
import { useIsGifVariation } from '../utils/hooks';
import { GifLooper } from '../utils/gif-looper';

const SUPPORTED_BLOCKS = [
	'core/image',
	'core/audio',
	'core/video',
	'core/cover',
	'core/media-text',
];

function ErrorDialog() {
	const { hasVideo, error } = useSelect(
		( select ) => ( {
			hasVideo: select( recordingStore ).hasVideo(),
			error: select( recordingStore ).getError(),
		} ),
		[]
	);

	let errorMessage = error?.message;

	// Use some more human-readable error messages for most common scenarios.
	// See https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#exceptions
	if ( ! window.isSecureContext ) {
		errorMessage = __(
			'Requires a secure browsing context (HTTPS)',
			'media-experiments'
		);
	} else if ( error?.name === 'NotAllowedError' ) {
		errorMessage = __( 'Permission denied', 'media-experiments' );
	} else if (
		! hasVideo ||
		error?.name === 'NotFoundError' ||
		error?.name === 'OverConstrainedError'
	) {
		errorMessage = __( 'No camera found', 'media-experiments' );
	}

	return <Warning>{ errorMessage }</Warning>;
}

function PermissionsDialog() {
	return (
		<Warning>
			{ __(
				'To get started, you need to allow access to your camera and microphone.',
				'media-experiments'
			) }
		</Warning>
	);
}

function Countdown() {
	const { countdown, isCounting } = useSelect(
		( select ) => ( {
			countdown: select( recordingStore ).getCountdown(),
			isCounting:
				'countdown' === select( recordingStore ).getRecordingStatus(),
		} ),
		[]
	);

	if ( isCounting ) {
		return <div className="mexp-recording__countdown">{ countdown }</div>;
	}

	return null;
}

function OverlayText() {
	const { duration, isRecording } = useSelect(
		( select ) => ( {
			duration: select( recordingStore ).getDuration(),
			isRecording: [ 'recording', 'paused' ].includes(
				select( recordingStore ).getRecordingStatus()
			),
		} ),
		[]
	);

	if ( isRecording && duration >= 0 ) {
		return (
			<>
				<div className="mexp-recording__duration">
					{ formatSecondsToMinutesSeconds( duration ) }
				</div>
				<div className="mexp-recording__rec">{ 'REC' }</div>
			</>
		);
	}

	return null;
}

function Recorder( { clientId }: MediaPanelProps ) {
	const streamNodeRef = useRef< HTMLVideoElement >( null );
	const {
		videoInput,
		status,
		error,
		liveStream,
		url,
		recordingTypes,
		mediaType,
		dimensions,
		isMuted,
	} = useSelect( ( select ) => {
		const file = select( recordingStore ).getFile();

		return {
			videoInput: select( recordingStore ).getVideoInput(),
			status: select( recordingStore ).getRecordingStatus(),
			error: select( recordingStore ).getError(),
			liveStream: select( recordingStore ).getMediaStream(),
			recordingTypes: select( recordingStore ).getRecordingTypes(),
			mediaType: file ? file.type.split( '/' )[ 0 ] : null,
			url: select( recordingStore ).getUrl(),
			dimensions: select( recordingStore ).getDimensions(),
			isMuted: ! select( recordingStore ).hasAudio,
		};
	}, [] );

	const isGif = useIsGifVariation( clientId );

	useEffect( () => {
		if ( ! streamNodeRef.current ) {
			return;
		}

		if ( liveStream ) {
			streamNodeRef.current.srcObject = liveStream;
		}

		if ( ! liveStream ) {
			streamNodeRef.current.srcObject = null;
		}
	}, [ liveStream ] );

	const wrapperClassName = recordingTypes.includes( 'audio' )
		? 'mexp-recording__wrapper mexp-recording__wrapper--audio'
		: 'mexp-recording__wrapper mexp-recording__wrapper--video';

	const isFailed = 'failed' === status || Boolean( error );
	const needsPermissions =
		( 'idle' === status || 'acquiringMedia' === status ) && ! videoInput;

	if ( isFailed ) {
		return <ErrorDialog />;
	}

	if ( needsPermissions ) {
		return <PermissionsDialog />;
	}

	if ( url ) {
		switch ( mediaType ) {
			case 'image':
				return (
					<img
						src={ url }
						decoding="async"
						alt={ __( 'Image capture', 'media-experiments' ) }
						width={ dimensions.width }
						height={ dimensions.height }
					/>
				);

			case 'video':
				return (
					<>
						<video
							controls={ ! isGif }
							muted={ isMuted || isGif }
							loop={ isGif }
							src={ url }
							autoPlay={ isGif }
						/>
						<GifLooper clientId={ clientId } />
					</>
				);

			case 'audio':
				return <audio controls src={ url } />;

			default:
			// This should never happen.
		}
	}

	// TODO: Don't show livestream if we're still capturing the image.
	// "capturingImage" or "stopping" state.

	if ( liveStream ) {
		return (
			<div className={ wrapperClassName }>
				<Countdown />
				<OverlayText />
				{ recordingTypes.includes( 'audio' ) ? (
					<AudioAnalyzer source={ liveStream } />
				) : (
					<video
						ref={ streamNodeRef }
						disablePictureInPicture
						autoPlay
						muted
					/>
				) }
			</div>
		);
	}

	// TODO: Maybe show fallback loading state or something.
	return (
		<div className={ wrapperClassName }>
			<Countdown />
			<OverlayText />
			{ __( 'Loading…', 'media-experiments' ) }
		</div>
	);
}

const addMediaRecorder = createHigherOrderComponent(
	( BlockEdit ) => ( props: MediaPanelProps ) => {
		const { updateMediaDevices } = useDispatch( recordingStore );
		const isInRecordingMode = useSelect(
			( select ) => {
				return select( recordingStore ).isBlockInRecordingMode(
					props.clientId
				);
			},
			[ props.clientId ]
		);

		const blockProps = useBlockProps( {
			className: `${
				props.className || ''
			} mexp-block-is-recording`.trimStart(),
		} );

		useEffect( () => {
			// navigator.mediaDevices is undefined in insecure browsing contexts.
			if ( ! navigator.mediaDevices ) {
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
		}, [ updateMediaDevices ] );

		if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
			return <BlockEdit { ...props } />;
		}

		if ( ! isInRecordingMode ) {
			return <BlockEdit { ...props } />;
		}

		return (
			<div { ...blockProps }>
				<UnfinishedRecordingWarning />
				<Recorder { ...props } />
			</div>
		);
	},
	'withMediaRecorder'
);

addFilter(
	'editor.BlockEdit',
	'media-experiments/add-media-recording',
	addMediaRecorder,
	5
);
