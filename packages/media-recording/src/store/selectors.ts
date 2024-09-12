/**
 * Internal dependencies
 */
import type {
	RecordingStatus,
	RecordingType,
	State,
	VideoEffect,
} from './types';

/**
 * Whether the app is currently in recording mode.
 *
 * @param state Recording state.
 */
export function isInRecordingMode( state: State ): boolean {
	return Boolean( state.blockClientId );
}

/**
 * Whether the given block is currently in recording mode.
 *
 * @param state    Recording state.
 * @param clientId Block client ID.
 */
export function isBlockInRecordingMode(
	state: State,
	clientId: string
): boolean {
	return state.blockClientId === clientId;
}

/**
 * Returns the current recording media types.
 *
 * @param state Recording state.
 */
export function getRecordingTypes( state: State ): RecordingType[] {
	return state.recordingTypes;
}

/**
 * Returns the list of available devices.
 *
 * @param state Recording state.
 */
export function getDevices( state: State ): MediaDeviceInfo[] {
	return state.devices;
}

/**
 * Whether there is any video device available.
 *
 * @param state Recording state.
 */
export function hasVideo( state: State ): boolean {
	return (
		state.recordingTypes.includes( 'video' ) ||
		state.recordingTypes.includes( 'image' )
	);
}

/**
 * Whether there is any audio device available.
 *
 * @param state Recording state.
 */
export function hasAudio( state: State ): boolean {
	return state.hasAudio;
}

/**
 * Returns the current video device.
 *
 * @param state Recording state.
 */
export function getVideoInput( state: State ): string | undefined {
	return state.videoInput;
}

/**
 * Returns the current audio device.
 *
 * @param state Recording state.
 */
export function getAudioInput( state: State ): string | undefined {
	return state.audioInput;
}

/**
 * Returns the current video effect.
 *
 * @param state Recording state.
 */
export function getVideoEffect( state: State ): VideoEffect {
	return state.videoEffect;
}

/**
 * Returns the current pre-recording countdown.
 *
 * @param state Recording state.
 */
export function getCountdown( state: State ): number {
	return state.countdown;
}

/**
 * Returns the current recording duration.
 *
 * @param state Recording state.
 */
export function getDuration( state: State ): number {
	return state.duration;
}

/**
 * Returns the current recording status.
 *
 * @param state Recording state.
 */
export function getRecordingStatus( state: State ): RecordingStatus {
	return state.recordingStatus;
}

/**
 * Returns the current MediaStream instance.
 *
 * @param state Recording state.
 */
export function getMediaStream( state: State ): MediaStream | undefined {
	return state.mediaStream;
}

/**
 * Returns the current MediaRecorder instance.
 *
 * @param state Recording state.
 */
export function getMediaRecorder( state: State ): MediaRecorder | undefined {
	return state.mediaRecorder;
}

/**
 * Returns the recorded media chunks.
 *
 * @param state Recording state.
 */
export function getMediaChunks( state: State ): Blob[] {
	return state.mediaChunks;
}

/**
 * Returns the current error, if there is one.
 *
 * @param state Recording state.
 */
export function getError( state: State ): Error | undefined {
	return state.error;
}

/**
 * Returns the current file from the recording.
 *
 * @param state Recording state.
 */
export function getFile( state: State ): File | undefined {
	return state.file;
}

/**
 * Returns the original from the recording.
 *
 * @todo Document the difference to getFile() or remove if not needed.
 *
 * @param state Recording state.
 */
export function getOriginalFile( state: State ): File | undefined {
	return state.originalFile;
}

/**
 * Returns the URL for the recording.
 *
 * @param state Recording state.
 */
export function getUrl( state: State ): string | undefined {
	return state.url;
}

/**
 * Returns the original URL.
 *
 * @todo Document the difference to getUrl() or remove if not needed.
 *
 * @param state Recording state.
 */
export function getOriginalUrl( state: State ): string | undefined {
	return state.originalUrl;
}

/**
 * Returns the dimensions of the current recording.
 *
 * @param state Recording state.
 */
export function getDimensions( state: State ): {
	width: number | undefined;
	height: number | undefined;
} {
	return {
		width: state.width,
		height: state.height,
	};
}
