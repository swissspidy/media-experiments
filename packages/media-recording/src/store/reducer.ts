import type {
	AcquireMediaAction,
	AddMediaChunkAction,
	ChangeAudioInputAction,
	ChangeVideoEffectAction,
	ChangeVideoInputAction,
	CountdownTickAction,
	DurationTickAction,
	EnterRecordingModeAction,
	FinishRecordingAction,
	LeaveRecordingModeAction,
	PauseRecordingAction,
	ResetStateAction,
	ResumeRecordingAction,
	SetCountdownAction,
	SetDurationAction,
	SetErrorAction,
	SetFileAction,
	SetGifModeAction,
	SetHasAudioAction,
	SetMediaDevicesAction,
	SetMediaStreamAction,
	StartCapturingAction,
	StartRecordingAction,
	State,
	StopRecordingAction,
	ToggleBlurVideoEffectAction,
	ToggleGifModeAction,
	ToggleHasAudioAction,
	UnknownAction,
} from './types';
import { Type } from './types';

const DEFAULT_STATE: State = {
	videoInput: undefined,
	audioInput: undefined,
	videoEffect: 'none',
	blockClientId: undefined,
	recordingTypes: [ 'video' ],
	devices: [],
	hasAudio: true,
	isGifMode: false,
	countdown: 0,
	duration: 0,
	recordingStatus: 'idle',
	mediaChunks: [],
};

type Action =
	| UnknownAction
	| EnterRecordingModeAction
	| LeaveRecordingModeAction
	| SetMediaDevicesAction
	| ChangeVideoInputAction
	| ChangeAudioInputAction
	| ChangeVideoEffectAction
	| ToggleBlurVideoEffectAction
	| StartRecordingAction
	| StopRecordingAction
	| PauseRecordingAction
	| ResumeRecordingAction
	| FinishRecordingAction
	| StartCapturingAction
	| SetGifModeAction
	| ToggleGifModeAction
	| SetHasAudioAction
	| ToggleHasAudioAction
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

function reducer(
	state = DEFAULT_STATE,
	action: Action = { type: Type.Unknown }
) {
	switch ( action.type ) {
		case Type.EnterRecordingMode:
			return {
				...state,
				blockClientId: action.clientId,
				recordingTypes: action.recordingTypes,
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
						( device ) => device.deviceId === state.videoInput
					)?.deviceId ||
					action.devices.find(
						( device ) => device.kind === 'videoinput'
					)?.deviceId,
				audioInput:
					action.devices.find(
						( device ) => device.deviceId === state.audioInput
					)?.deviceId ||
					action.devices.find(
						( device ) => device.kind === 'audioinput'
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

		case Type.ToggleBlurVideoEffect:
			return {
				...state,
				videoEffect: state.videoEffect === 'none' ? 'blur' : 'none',
			};

		case Type.SetGifMode:
			return {
				...state,
				isGifMode: action.value,
			};

		case Type.ToggleGifMode:
			return {
				...state,
				isGifMode: ! state.isGifMode,
			};

		case Type.SetHasAudio:
			return {
				...state,
				hasAudio: action.value,
			};

		case Type.ToggleHasAudio:
			return {
				...state,
				hasAudio: ! state.hasAudio,
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
				mediaChunks: [ ...state.mediaChunks, action.chunk ],
			};
		}
	}

	return state;
}

export default reducer;
