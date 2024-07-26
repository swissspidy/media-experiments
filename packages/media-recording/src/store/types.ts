type Action< T = Type, Payload = {} > = {
	type: T;
} & Payload;

export interface State {
	videoInput?: string;
	audioInput?: string;
	videoEffect: VideoEffect;
	blockClientId?: string;
	recordingTypes: RecordingType[];
	devices: MediaDeviceInfo[];
	hasAudio: boolean;
	isGifMode: boolean;
	file?: File;
	originalFile?: File;
	url?: string;
	originalUrl?: string;
	width?: number;
	height?: number;
	countdown: number;
	duration: number;
	mediaRecorder?: MediaRecorder;
	mediaStream?: MediaStream;
	recordingStatus: RecordingStatus;
	error?: Error;
	mediaChunks: Blob[];
}

export type RecordingType = 'video' | 'image' | 'audio';

export type RecordingStatus =
	| 'idle'
	| 'acquiringMedia'
	| 'ready'
	| 'recording'
	| 'capturingImage'
	| 'paused'
	| 'stopping'
	| 'stopped'
	| 'failed'
	| 'countdown';

export type VideoEffect = 'none' | 'blur';

export enum Type {
	Unknown = 'REDUX_UNKNOWN',
	EnterRecordingMode = 'ENTER_RECORDING_MODE',
	LeaveRecordingMode = 'LEAVE_RECORDING_MODE',
	ChangeVideoInput = 'CHANGE_VIDEO_INPUT',
	ChangeAudioInput = 'CHANGE_AUDIO_INPUT',
	ChangeVideoEffect = 'CHANGE_VIDEO_EFFECT',
	ToggleBlurVideoEffect = 'TOGGLE_BLUR_VIDEO_EFFECT',
	StartRecording = 'START_RECORDING',
	StopRecording = 'STOP_RECORDING',
	PauseRecording = 'PAUSE_RECORDING',
	ResumeRecording = 'RESUME_RECORDING',
	FinishRecording = 'FINISH_RECORDING',
	StartCapturing = 'START_CAPTURING',
	SetGifMode = 'SET_GIF_MODE',
	ToggleGifMode = 'TOGGLE_GIF_MODE',
	SetHasAudio = 'SET_HAS_AUDIO',
	ToggleHasAudio = 'TOGGLE_HAS_AUDIO',
	SetMediaDevices = 'SET_MEDIA_DEVICES',
	SetFile = 'SET_FILE',
	ResetState = 'RESET_STATE',
	SetCountdown = 'SET_COUNTDOWN',
	CountdownTick = 'COUNTDOWN_TICK',
	SetDuration = 'SET_DURATION',
	DurationTick = 'DURATION_TICK',
	AcquireMedia = 'ACQUIRE_MEDIA',
	SetMediaStream = 'SET_MEDIA_STREAM',
	SetError = 'SET_ERROR',
	AddMediaChunk = 'ADD_MEDIA_CHUNK',
}

export type UnknownAction = Action< Type.Unknown >;
export type EnterRecordingModeAction = Action<
	Type.EnterRecordingMode,
	{ clientId: string; recordingTypes: RecordingType[] }
>;
export type LeaveRecordingModeAction = Action< Type.LeaveRecordingMode >;
export type SetMediaDevicesAction = Action<
	Type.SetMediaDevices,
	{ devices: MediaDeviceInfo[] }
>;
export type ChangeVideoInputAction = Action<
	Type.ChangeVideoInput,
	{ deviceId: string }
>;
export type ChangeAudioInputAction = Action<
	Type.ChangeAudioInput,
	{ deviceId: string }
>;
export type ChangeVideoEffectAction = Action<
	Type.ChangeVideoEffect,
	{ videoEffect: VideoEffect }
>;
export type ToggleBlurVideoEffectAction = Action< Type.ToggleBlurVideoEffect >;
export type StartRecordingAction = Action<
	Type.StartRecording,
	{ mediaRecorder: MediaRecorder }
>;
export type StopRecordingAction = Action< Type.StopRecording >;
export type PauseRecordingAction = Action< Type.PauseRecording >;
export type ResumeRecordingAction = Action< Type.ResumeRecording >;
export type FinishRecordingAction = Action<
	Type.FinishRecording,
	{ file: File; url: string; width: number; height: number }
>;
export type StartCapturingAction = Action< Type.StartCapturing >;
export type SetGifModeAction = Action< Type.SetGifMode, { value: boolean } >;
export type ToggleGifModeAction = Action< Type.ToggleGifMode >;
export type SetHasAudioAction = Action< Type.SetHasAudio, { value: boolean } >;
export type ToggleHasAudioAction = Action< Type.ToggleHasAudio >;
export type SetFileAction = Action< Type.SetFile, { file: File; url: string } >;
export type ResetStateAction = Action< Type.ResetState >;
export type SetDurationAction = Action< Type.SetCountdown, { value: number } >;
export type CountdownTickAction = Action< Type.CountdownTick >;
export type SetCountdownAction = Action< Type.SetDuration, { value: number } >;
export type DurationTickAction = Action< Type.DurationTick >;
export type AcquireMediaAction = Action< Type.AcquireMedia >;
export type SetMediaStreamAction = Action<
	Type.SetMediaStream,
	{ stream: MediaStream }
>;
export type SetErrorAction = Action< Type.SetError, { error: Error } >;
export type AddMediaChunkAction = Action< Type.AddMediaChunk, { chunk: Blob } >;
