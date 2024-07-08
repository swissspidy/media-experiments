// ImageCapture polyfill for Safari and Firefox.
// See https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Image_Capture_API
// See https://github.com/GoogleChromeLabs/imagecapture-polyfill
import { ImageCapture } from 'image-capture';

import { createBlobURL, revokeBlobURL } from '@wordpress/blob';
import { dateI18n } from '@wordpress/date';

import { blobToFile, getExtensionFromMimeType } from '@mexp/media-utils';

import {
	COUNTDOWN_TIME_IN_SECONDS,
	MAX_RECORDING_DURATION_IN_SECONDS,
} from './constants';
import {
	type LeaveRecordingModeAction,
	type SetGifModeAction,
	type SetHasAudioAction,
	type ToggleGifModeAction,
	type ToggleHasAudioAction,
	Type,
	type VideoEffect,
} from './types';

type AllSelectors = typeof import('./selectors');
type CurriedState< F > = F extends ( state: any, ...args: infer P ) => infer R
	? ( ...args: P ) => R
	: F;
type Selectors = {
	[ key in keyof AllSelectors ]: CurriedState< AllSelectors[ key ] >;
};

type ActionCreators = {
	invalidateResolutionForStoreSelector: ( selector: keyof Selectors ) => void;
	setVideoEffect: typeof setVideoEffect;
	setGifMode: typeof setGifMode;
	setHasAudio: typeof setHasAudio;
	stopRecording: typeof stopRecording;
	countDuration: typeof countDuration;
	( args: Record< string, unknown > ): void;
};

/**
 * Sets the active video input and triggers a media stream update.
 *
 * @param deviceId Device ID.
 */
export function setVideoInput( deviceId: string ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		dispatch( {
			type: Type.ChangeVideoInput,
			deviceId,
		} );

		dispatch.invalidateResolutionForStoreSelector( 'getMediaStream' );
	};
}

/**
 * Sets the active audio input and triggers a media stream update.
 *
 * @param deviceId Device ID.
 */
export function setAudioInput( deviceId: string ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		dispatch( {
			type: Type.ChangeAudioInput,
			deviceId,
		} );

		dispatch.invalidateResolutionForStoreSelector( 'getMediaStream' );
	};
}

/**
 * Sets the active video effect and triggers a media stream update.
 *
 * @param videoEffect Video effect.
 */
export function setVideoEffect( videoEffect: VideoEffect ) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		dispatch( {
			type: Type.ChangeVideoEffect,
			videoEffect,
		} );

		dispatch.invalidateResolutionForStoreSelector( 'getMediaStream' );
	};
}

/**
 * Toggles the blur video effect and triggers a media stream update.
 */
export function toggleBlurEffect() {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		dispatch( {
			type: Type.ToggleBlurVideoEffect,
		} );

		dispatch.invalidateResolutionForStoreSelector( 'getMediaStream' );
	};
}

/**
 * Returns an action object signalling the new value for the GIF mode.
 *
 * @param value New value.
 */
export function setGifMode( value: boolean ): SetGifModeAction {
	return {
		type: Type.SetGifMode,
		value,
	};
}

/**
 * Returns an action object signalling that GIF mode should be toggled.
 */
export function toggleGifMode(): ToggleGifModeAction {
	return {
		type: Type.ToggleGifMode,
	};
}

/**
 * Returns an action object signalling the new value for whether audio should be recorded.
 *
 * @param value New value.
 */
export function setHasAudio( value: boolean ): SetHasAudioAction {
	return {
		type: Type.SetHasAudio,
		value,
	};
}

/**
 * Returns an action object signalling that audio mode should be toggled.
 */
export function toggleHasAudio(): ToggleHasAudioAction {
	return {
		type: Type.ToggleHasAudio,
	};
}

/**
 * Enters recording mode for a given block and recording type.
 *
 * @todo Allow passing an array for recordingType. (#230)
 *
 * @param clientId      Block client ID.
 * @param recordingType Recording type.
 */
export function enterRecordingMode(
	clientId: string,
	recordingType = 'video'
) {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		dispatch( {
			type: Type.EnterRecordingMode,
			clientId,
			recordingType,
		} );

		dispatch.invalidateResolutionForStoreSelector( 'getMediaStream' );
	};
}

/**
 * Returns an action object signalling that recording mode should be left.
 */
export function leaveRecordingMode(): LeaveRecordingModeAction {
	return {
		type: Type.LeaveRecordingMode,
	};
}

/**
 * Updates the list of available media devices.
 */
export function updateMediaDevices() {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			dispatch( {
				type: Type.SetMediaDevices,
				devices: devices
					.filter( ( device ) => device.kind !== 'audiooutput' )
					// Label is empty if permissions somehow changed meantime,
					// remove these devices from the list.
					.filter( ( device ) => device.label ),
			} );
		} catch ( err ) {
			// Do nothing for now.
		}
	};
}

/**
 * Counts the recording duration in seconds.
 */
export function countDuration() {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		dispatch( {
			type: Type.SetDuration,
			value: 0,
		} );

		const timer = setInterval( () => {
			if ( 'recording' !== select.getRecordingStatus() ) {
				clearInterval( timer );
				return;
			}

			dispatch( {
				type: Type.DurationTick,
			} );

			const duration = select.getDuration();
			if ( duration >= MAX_RECORDING_DURATION_IN_SECONDS ) {
				clearInterval( timer );

				dispatch.stopRecording();
			}
		}, 1000 );
	};
}

/**
 * Partially resets state to allow retrying recording.
 */
export function retryRecording() {
	return async ( { dispatch }: { dispatch: ActionCreators } ) => {
		// retry means getting a new stream (if missing)
		// and resetting any state (countdown, duration, files, etc.) if set

		dispatch( {
			type: Type.ResetState,
		} );
		dispatch.invalidateResolutionForStoreSelector( 'getMediaStream' );
	};
}

/**
 * Starts recording after an initial countdown.
 */
export function startRecording() {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		// TODO: Only do this once there is a stream and we're in "ready" state.
		dispatch( {
			type: Type.SetCountdown,
			value: COUNTDOWN_TIME_IN_SECONDS,
		} );

		const timer = setInterval( () => {
			dispatch( {
				type: Type.CountdownTick,
			} );

			const countdown = select.getCountdown();
			if ( countdown === 0 ) {
				clearInterval( timer );

				dispatch.countDuration();

				const mediaStream = select.getMediaStream();

				// mediaStream can be undefined if resolution hasn't finished yet.
				// TODO: Throw error?
				if ( ! mediaStream ) {
					return;
				}

				const mediaRecorder = new MediaRecorder( mediaStream );

				mediaRecorder.addEventListener( 'dataavailable', ( evt ) => {
					if ( evt.data.size ) {
						dispatch( {
							type: Type.AddMediaChunk,
							chunk: evt.data,
						} );
					}
				} );

				mediaRecorder.addEventListener( 'stop', () => {
					const mediaChunks = select.getMediaChunks();

					if ( ! mediaChunks.length ) {
						dispatch( {
							type: Type.SetError,
							error: new Error( 'No data received' ),
						} );
						return;
					}

					const hasVideo = select.hasVideo();
					const previousUrl = select.getUrl();
					const previousUrlOriginalUrl = select.getOriginalUrl();

					const { type } = mediaChunks[ 0 ];

					const blob = new Blob( mediaChunks, { type } );
					const file = hasVideo
						? blobToFile(
								blob,
								`capture-${ dateI18n(
									'Y-m-d-H-i',
									new Date(),
									undefined
								) }.mp4`,
								'video/mp4'
						  )
						: blobToFile(
								blob,
								`capture-${ dateI18n(
									'Y-m-d-H-i',
									new Date(),
									undefined
								) }.mp3`,
								'audio/mp3'
						  );

					const url = createBlobURL( file );

					const track = mediaStream.getVideoTracks()[ 0 ];
					const { width, height } = track?.getSettings() || {};

					dispatch( {
						type: Type.FinishRecording,
						file,
						url,
						width,
						height,
					} );

					if ( previousUrl ) {
						revokeBlobURL( previousUrl );
					}
					if ( previousUrlOriginalUrl ) {
						revokeBlobURL( previousUrlOriginalUrl );
					}
				} );

				mediaRecorder.addEventListener(
					'error',
					// @ts-ignore -- TODO: Fix type declaration.

					( evt: MediaRecorderErrorEvent ) => {
						dispatch( {
							type: Type.SetError,
							error: evt.error,
						} );
					}
				);

				try {
					mediaRecorder.start();
					dispatch( {
						type: Type.StartRecording,
						mediaRecorder,
					} );
				} catch ( error ) {
					dispatch( {
						type: Type.SetError,
						error,
					} );
				}
			}
		}, 1000 );
	};
}

/**
 * Stops recording.
 */
export function stopRecording() {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const mediaRecorder = select.getMediaRecorder();

		if ( mediaRecorder ) {
			mediaRecorder.stop();
		}

		dispatch( {
			type: Type.StopRecording,
		} );
	};
}

/**
 * Pauses recording.
 */
export function pauseRecording() {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const mediaRecorder = select.getMediaRecorder();

		if ( mediaRecorder ) {
			mediaRecorder.pause();
		}

		dispatch( {
			type: Type.PauseRecording,
		} );
	};
}

/**
 * Resumes recording after an initial countdown.
 *
 * @todo Deduplicate setInterval logic with startRecording.
 */
export function resumeRecording() {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		const mediaRecorder = select.getMediaRecorder();

		if ( mediaRecorder ) {
			mediaRecorder.resume();
		}

		dispatch( {
			type: Type.ResumeRecording,
		} );

		const timer = setInterval( () => {
			if ( 'recording' !== select.getRecordingStatus() ) {
				clearInterval( timer );
				return;
			}

			dispatch( {
				type: Type.DurationTick,
			} );

			const duration = select.getDuration();
			if ( duration >= MAX_RECORDING_DURATION_IN_SECONDS ) {
				clearInterval( timer );

				dispatch.stopRecording();
			}
		}, 1000 );
	};
}

/**
 * Captures a single image after an initial countdown.
 *
 * @todo Deduplicate setInterval logic with startRecording.
 */
export function captureImage() {
	return async ( {
		select,
		dispatch,
	}: {
		select: Selectors;
		dispatch: ActionCreators;
	} ) => {
		// TODO: Only do this once there is a stream and we're in "ready" state.
		dispatch( {
			type: Type.SetCountdown,
			value: COUNTDOWN_TIME_IN_SECONDS,
		} );

		const timer = setInterval( async () => {
			dispatch( {
				type: Type.CountdownTick,
			} );

			const countdown = select.getCountdown();
			if ( countdown === 0 ) {
				clearInterval( timer );

				const mediaStream = select.getMediaStream();

				// mediaStream can be undefined if resolution hasn't finished yet.
				// TODO: Throw error?
				if ( ! mediaStream ) {
					return;
				}

				const track = mediaStream.getVideoTracks()[ 0 ];
				const captureDevice = new ImageCapture( track );

				const { width, height } = track.getSettings();

				dispatch( {
					type: Type.StartCapturing,
				} );

				try {
					// Not using `captureDevice.takePhoto()` due to error,
					// see https://github.com/GoogleChromeLabs/imagecapture-polyfill/issues/15
					// and https://github.com/swissspidy/media-experiments/issues/247.
					// Downside is we need to get a Blob ourselves.
					const bitmap = await captureDevice.grabFrame();

					const canvas = new OffscreenCanvas(
						bitmap.width,
						bitmap.height
					);

					const ctx = canvas.getContext( '2d' );

					if ( ! ctx ) {
						throw new Error( 'Could not get context' );
					}

					ctx.drawImage( bitmap, 0, 0, bitmap.width, bitmap.height );
					const blob = await canvas.convertToBlob( {
						type: 'image/jpeg',
					} );

					const { type } = blob;
					const ext = getExtensionFromMimeType( type );

					const file = blobToFile(
						blob,
						`capture-${ dateI18n(
							'Y-m-d-H-i',
							new Date(),
							undefined
						) }.${ ext }`,
						type
					);
					const url = createBlobURL( file );

					dispatch( {
						type: Type.FinishRecording,
						file,
						url,
						width,
						height,
					} );
				} catch ( error ) {
					dispatch( {
						type: Type.SetError,
						error,
					} );
				}
			}
		}, 1000 );
	};
}
