import type { RecordingType, State } from './types';

/**
 * Whether the app is currently in recording mode.
 *
 * @param state Recording state.
 */
export function isInRecordingMode( state: State ): boolean {
	return Boolean( state.blockClientId );
}

export function isBlockInRecordingMode(
	state: State,
	clientId: string
): boolean {
	return state.blockClientId === clientId;
}

export function getRecordingType( state: State ): RecordingType {
	return state.recordingType;
}

export function getDevices( state: State ): MediaDeviceInfo[] {
	return state.devices;
}

export function isGifMode( state: State ): boolean {
	return state.isGifMode;
}

export function hasVideo( state: State ): boolean {
	return state.recordingType !== 'audio';
}

export function hasAudio( state: State ): boolean {
	return state.hasAudio;
}

export function getVideoInput( state: State ): string | undefined {
	return state.videoInput;
}

export function getAudioInput( state: State ) {
	return state.audioInput;
}

export function getVideoEffect( state: State ) {
	return state.videoEffect;
}

export function getCountdown( state: State ) {
	return state.countdown;
}

export function getDuration( state: State ) {
	return state.duration;
}

/**
 * Returns the current recording status.
 *
 * @param state Recording state.
 */
export function getRecordingStatus( state: State ) {
	return state.recordingStatus;
}

export function getMediaStream( state: State ) {
	return state.mediaStream;
}

export function getMediaRecorder( state: State ) {
	return state.mediaRecorder;
}

export function getMediaChunks( state: State ) {
	return state.mediaChunks;
}

export function getError( state: State ) {
	return state.error;
}

export function getFile( state: State ) {
	return state.file;
}

export function getOriginalFile( state: State ) {
	return state.originalFile;
}

export function getUrl( state: State ) {
	return state.url;
}

/**
 * Returns the original URL.
 *
 * @param state Recording state.
 */
export function getOriginalUrl( state: State ): string | undefined {
	return state.originalUrl;
}

export function getDimensions( state: State ) {
	return {
		width: state.width,
		height: state.height,
	};
}
