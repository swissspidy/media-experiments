import {
	AddMediaChunkAction,
	ChangeAudioInputAction,
	ChangeVideoEffectAction,
	ChangeVideoInputAction,
	CountdownTickAction,
	DurationTickAction,
	EnterRecordingModeAction,
	FinishRecordingAction,
	LeaveRecordingModeAction,
	ResetStateAction,
	ResetVideoInputAction,
	SetCountdownAction,
	SetDurationAction,
	SetErrorAction,
	SetFileAction,
	SetGifModeAction,
	SetHasAudioAction,
	SetHasVideoAction,
	SetMediaDevicesAction,
	SetMediaStreamAction,
	StartRecordingAction,
	State,
	StopRecordingAction,
	AcquireMediaAction,
	Type,
	PauseRecordingAction,
	ResumeRecordingAction,
	StartCapturingAction,
} from './types';

const DEFAULT_STATE: State = {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
	blockClientId: undefined,
	recordingType: 'video',
	devices: [],
	hasVideo: true,
	hasAudio: true,
	isGifMode: false,
	countdown: 0,
	duration: 0,
	recordingStatus: 'idle',
	mediaChunks: [],
};

type Action =
	| EnterRecordingModeAction
	| LeaveRecordingModeAction
	| SetMediaDevicesAction
	| ChangeVideoInputAction
	| ChangeAudioInputAction
	| ResetVideoInputAction
	| ChangeVideoEffectAction
	| StartRecordingAction
	| StopRecordingAction
	| PauseRecordingAction
	| ResumeRecordingAction
	| FinishRecordingAction
	| StartCapturingAction
	| SetGifModeAction
	| SetHasVideoAction
	| SetHasAudioAction
	| SetFileAction
	| ResetStateAction
	| SetDurationAction
	| DurationTickAction
	| SetCountdownAction
	| CountdownTickAction
	| SetMediaStreamAction
	| SetErrorAction
	| AddMediaChunkAction
	| AcquireMediaAction;

function reducer(state = DEFAULT_STATE, action: Action) {
	console.log('reducer', state, action);
	switch (action.type) {
		case Type.EnterRecordingMode:
			return {
				...state,
				blockClientId: action.clientId,
				recordingType: action.recordingType,
			};

		case Type.LeaveRecordingMode:
			return {
				...state,
				blockClientId: null,
				isGif: false,
				file: undefined,
				originalFile: undefined,
				url: undefined,
				originalUrl: undefined,
				recordingStatus: 'idle',
				mediaStream: undefined,
				mediaRecorder: undefined,
				mediaChunks: [],
				duration: 0,
				countdown: 0,
				error: undefined,
				width: undefined,
				height: undefined,
			};

		case Type.SetMediaDevices:
			return {
				...state,
				devices: action.devices,
				// Prevent stale video/audio input data.
				videoInput:
					action.devices.find(
						(device) => device.deviceId === state.videoInput
					)?.deviceId ||
					action.devices.find(
						(device) => device.kind === 'videoinput'
					)?.deviceId,
				audioInput:
					action.devices.find(
						(device) => device.deviceId === state.audioInput
					)?.deviceId ||
					action.devices.find(
						(device) => device.kind === 'audioinput'
					)?.deviceId,
			};

		case Type.StartRecording: {
			return {
				...state,
				recordingStatus: 'recording',
				mediaRecorder: action.mediaRecorder,
			};
		}

		case Type.StopRecording: {
			return {
				...state,
				recordingStatus: 'stopping',
				mediaStream: undefined,
				mediaRecorder: undefined,
				duration: 0,
				countdown: 0,
			};
		}

		case Type.PauseRecording: {
			return {
				...state,
				recordingStatus: 'paused',
			};
		}

		case Type.ResumeRecording: {
			return {
				...state,
				recordingStatus: 'recording',
			};
		}

		case Type.FinishRecording: {
			return {
				...state,
				recordingStatus: 'stopped',
				file: action.file,
				url: action.url,
				originalFile: action.file,
				originalUrl: action.url,
				width: action.width,
				height: action.height,
			};
		}

		case Type.StartCapturing: {
			return {
				...state,
				recordingStatus: 'capturingImage',
			};
		}

		case Type.ChangeVideoInput:
			return {
				...state,
				videoInput: action.deviceId,
			};

		case Type.ChangeAudioInput:
			return {
				...state,
				audioInput: action.deviceId,
			};

		case Type.ChangeVideoEffect:
			return {
				...state,
				videoEffect: action.videoEffect,
			};

		case Type.SetGifMode:
			return {
				...state,
				isGifMode: action.value,
			};

		case Type.SetHasVideo:
			return {
				...state,
				hasVideo: action.value,
			};

		case Type.SetHasAudio:
			return {
				...state,
				hasAudio: action.value,
			};

		case Type.ResetVideoInput:
			return {
				...state,
				hasVideo: false,
				videoInput: undefined,
			};

		case Type.SetFile:
			return {
				...state,
				file: action.file,
				originalFile: action.file,
				url: action.url,
				originalUrl: action.url,
			};

		case Type.ResetState:
			return {
				...state,
				isGif: false,
				file: undefined,
				originalFile: undefined,
				url: undefined,
				originalUrl: undefined,
				recordingStatus: 'idle',
				mediaStream: undefined,
				mediaRecorder: undefined,
				mediaChunks: [],
				duration: 0,
				countdown: 0,
				error: undefined,
				width: undefined,
				height: undefined,
			};

		case Type.SetCountdown: {
			return {
				...state,
				countdown: action.value,
				recordingStatus: 'countdown',
			};
		}

		case Type.CountdownTick: {
			return {
				...state,
				countdown: --state.countdown,
			};
		}

		case Type.SetDuration: {
			return {
				...state,
				duration: action.value,
			};
		}

		case Type.DurationTick: {
			return {
				...state,
				duration: ++state.duration,
			};
		}

		case Type.AcquireMedia: {
			return {
				...state,
				recordingStatus: 'acquiringMedia',
			};
		}

		case Type.SetMediaStream: {
			return {
				...state,
				mediaStream: action.stream,
				recordingStatus: 'ready',
			};
		}

		case Type.SetError: {
			return {
				...state,
				recordingStatus: 'failed',
				error: action.error,
			};
		}

		case Type.AddMediaChunk: {
			return {
				...state,
				mediaChunks: [...state.mediaChunks, action.chunk],
			};
		}
	}

	return state;
}

export default reducer;
