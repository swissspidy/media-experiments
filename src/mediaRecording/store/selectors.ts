import type { State } from './types';

export function isInRecordingMode(state: State) {
	return Boolean(state.blockClientId);
}

export function isBlockInRecordingMode(state: State, clientId: string) {
	return state.blockClientId === clientId;
}

export function getDevices(state: State) {
	return state.devices;
}

export function isGifMode(state: State) {
	return state.isGifMode;
}

export function hasVideo(state: State) {
	return state.hasVideo;
}

export function hasAudio(state: State) {
	return state.hasAudio;
}

export function getVideoInput(state: State) {
	return state.videoInput;
}

export function getAudioInput(state: State) {
	return state.audioInput;
}

export function getVideoEffect(state: State) {
	return state.videoEffect;
}

export function getCountdown(state: State) {
	return state.countdown;
}

export function getDuration(state: State) {
	return state.duration;
}

export function getRecordingStatus(state: State) {
	return state.recordingStatus;
}

export function getMediaStream(state: State) {
	return state.mediaStream;
}

export function getMediaRecorder(state: State) {
	return state.mediaRecorder;
}

export function getMediaChunks(state: State) {
	return state.mediaChunks;
}

export function getError(state: State) {
	return state.error;
}

export function getFile(state: State) {
	return state.file;
}

export function getOriginalFile(state: State) {
	return state.originalFile;
}

export function getUrl(state: State) {
	return state.url;
}

export function getOriginalUrl(state: State) {
	return state.originalUrl;
}

export function getDimensions(state: State) {
	return {
		width: state.width,
		height: state.height,
	};
}
