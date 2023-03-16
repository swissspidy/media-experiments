// ImageCapture polyfill for Safari and Firefox.
// See https://developer.mozilla.org/en-US/docs/Web/API/MediaStream_Image_Capture_API
// See https://github.com/GoogleChromeLabs/imagecapture-polyfill
import { ImageCapture } from 'image-capture';

import { createBlobURL, revokeBlobURL } from '@wordpress/blob';
import { dateI18n } from '@wordpress/date';

import { Type, VideoEffect } from './types';
import { blobToFile } from '../../utils';
import {
	COUNTDOWN_TIME_IN_SECONDS,
	MAX_RECORDING_DURATION_IN_SECONDS,
} from '../constants';
import { getExtensionFromMimeType } from '../../uploadQueue/utils';

export function setVideoInput(deviceId: string) {
	return {
		type: Type.ChangeVideoInput,
		deviceId,
	};
}

export function setAudioInput(deviceId: string) {
	return {
		type: Type.ChangeAudioInput,
		deviceId,
	};
}

export function setVideoEffect(videoEffect: VideoEffect) {
	return {
		type: Type.ChangeVideoEffect,
		videoEffect,
	};
}

export function toggleBlurEffect() {
	return async ({ select, dispatch }) => {
		const value = select.getVideoEffect();
		dispatch.setVideoEffect(value === 'none' ? 'blur' : 'none');
	};
}

export function setGifMode(value: boolean) {
	return {
		type: Type.SetGifMode,
		value,
	};
}

export function toggleGifMode() {
	return async ({ select, dispatch }) => {
		const value = select.isGifMode();
		dispatch.setGifMode(!value);
	};
}

export function setHasVideo(value: boolean) {
	return {
		type: Type.SetHasVideo,
		value,
	};
}

export function setHasAudio(value: boolean) {
	return {
		type: Type.SetHasAudio,
		value,
	};
}

export function toggleHasAudio() {
	return async ({ select, dispatch }) => {
		const value = select.hasAudio();
		dispatch.setHasAudio(!value);
	};
}

export function resetVideoInput() {
	return {
		type: Type.ResetVideoInput,
	};
}

export function enterRecordingMode(clientId: string) {
	return async ({ dispatch }) => {
		dispatch({
			type: Type.EnterRecordingMode,
			clientId,
		});

		dispatch.invalidateResolutionForStoreSelector('getMediaStream');
	};
}

export function leaveRecordingMode() {
	return async ({ select, dispatch }) => {
		const mediaStream = select.getMediaStream();

		dispatch({
			type: Type.LeaveRecordingMode,
		});

		mediaStream?.getTracks().forEach((track) => track.stop());
	};
}

export function updateMediaDevices() {
	return async ({ dispatch }) => {
		try {
			const devices = await navigator.mediaDevices.enumerateDevices();
			dispatch({
				type: Type.SetMediaDevices,
				devices: devices
					.filter((device) => device.kind !== 'audiooutput')
					// Label is empty if permissions somehow changed meantime,
					// remove these devices from the list.
					.filter((device) => device.label),
			});
		} catch (err) {
			// Do nothing for now.
		}
	};
}

export function countDuration() {
	return async ({ select, dispatch }) => {
		dispatch({
			type: Type.SetDuration,
			value: 0,
		});

		let timer: number | undefined = undefined;

		clearInterval(timer);

		timer = setInterval(() => {
			if ('recording' !== select.getRecordingStatus()) {
				clearInterval(timer);
				return;
			}

			dispatch({
				type: Type.DurationTick,
			});

			const duration = select.getDuration();
			if (duration >= MAX_RECORDING_DURATION_IN_SECONDS) {
				clearInterval(timer);

				dispatch.stopRecording();
			}
		}, 1000);
	};
}

export function retryRecording() {
	return async ({ select, dispatch }) => {
		// retry means getting a new stream (if missing)
		// and resetting any state (countdown, duration, files, etc.) if set

		dispatch({
			type: Type.ResetState,
		});
		dispatch.invalidateResolutionForStoreSelector('getMediaStream');
	};
}

export function startRecording() {
	return async ({ select, dispatch }) => {
		// TODO: Only do this once there is a stream and we're in "ready" state.
		dispatch({
			type: Type.SetCountdown,
			value: COUNTDOWN_TIME_IN_SECONDS,
		});

		let timer: number | undefined = undefined;

		clearInterval(timer);

		timer = setInterval(() => {
			dispatch({
				type: Type.CountdownTick,
			});

			const countdown = select.getCountdown();
			if (countdown === 0) {
				clearInterval(timer);

				dispatch.countDuration();

				// TODO: mediaStream can be undefined if resolution hasn't finished yet.
				const mediaStream = select.getMediaStream();
				const mediaRecorder = new MediaRecorder(mediaStream);

				const track = mediaStream.getVideoTracks()[0];
				const { width, height } = track.getSettings();

				mediaRecorder.addEventListener('dataavailable', (evt) => {
					if (evt.data.size) {
						dispatch({
							type: Type.AddMediaChunk,
							chunk: evt.data,
						});
					}
				});

				mediaRecorder.addEventListener('stop', () => {
					mediaStream.getTracks().forEach((track) => track.stop());

					const mediaChunks = select.getMediaChunks();
					const hasVideo = select.hasVideo();
					const previousUrl = select.getUrl();
					const previousUrlOriginalUrl = select.getOriginalUrl();

					if (mediaChunks.length) {
						const { type } = mediaChunks[0];

						const blob = new Blob(mediaChunks, { type });
						const file = hasVideo
							? blobToFile(
									blob,
									`capture-${dateI18n(
										'Y-m-d-H-i',
										new Date(),
										undefined
									)}.mp4`,
									'video/mp4'
							  )
							: blobToFile(
									blob,
									`capture-${dateI18n(
										'Y-m-d-H-i',
										new Date(),
										undefined
									)}.mp3`,
									'audio/mp3'
							  );

						const url = createBlobURL(file);

						dispatch({
							type: Type.FinishRecording,
							file,
							url,
							width,
							height,
						});

						revokeBlobURL(previousUrl);
						revokeBlobURL(previousUrlOriginalUrl);
					}
				});

				mediaRecorder.addEventListener('error', (evt) => {
					mediaStream.getTracks().forEach((track) => track.stop());

					dispatch({
						type: Type.SetError,
						error: evt.error,
					});
				});

				try {
					mediaRecorder.start();
					dispatch({
						type: Type.StartRecording,
						mediaRecorder,
					});
				} catch (error) {
					dispatch({
						type: Type.SetError,
						error,
					});
				}
			}
		}, 1000);
	};
}

export function stopRecording() {
	return async ({ select, dispatch }) => {
		const mediaRecorder = select.getMediaRecorder();
		const mediaStream = select.getMediaStream();

		mediaRecorder.stop();

		mediaStream?.getTracks().forEach((track) => track.stop());

		dispatch({
			type: Type.StopRecording,
		});
	};
}

export function pauseRecording() {
	return async ({ select, dispatch }) => {
		const mediaRecorder = select.getMediaRecorder();

		mediaRecorder.pause();

		dispatch({
			type: Type.PauseRecording,
		});
	};
}

// TODO: Deduplicate setInterval logic with startRecording.
export function resumeRecording() {
	return async ({ select, dispatch }) => {
		const mediaRecorder = select.getMediaRecorder();

		mediaRecorder.resume();

		dispatch({
			type: Type.ResumeRecording,
		});

		let timer: number | undefined = undefined;

		clearInterval(timer);

		timer = setInterval(() => {
			if ('recording' !== select.getRecordingStatus()) {
				clearInterval(timer);
				return;
			}

			dispatch({
				type: Type.DurationTick,
			});

			const duration = select.getDuration();
			if (duration >= MAX_RECORDING_DURATION_IN_SECONDS) {
				clearInterval(timer);

				dispatch.stopRecording();
			}
		}, 1000);
	};
}

// TODO: Deduplicate setInterval logic with startRecording.
export function captureImage() {
	return async ({ select, dispatch }) => {
		// TODO: Only do this once there is a stream and we're in "ready" state.
		dispatch({
			type: Type.SetCountdown,
			value: COUNTDOWN_TIME_IN_SECONDS,
		});

		let timer: number | undefined = undefined;

		clearInterval(timer);

		timer = setInterval(async () => {
			dispatch({
				type: Type.CountdownTick,
			});

			const countdown = select.getCountdown();
			if (countdown === 0) {
				clearInterval(timer);

				// TODO: mediaStream can be undefined if resolution hasn't finished yet.
				const mediaStream = select.getMediaStream();

				const track = mediaStream.getVideoTracks()[0];
				const captureDevice = new ImageCapture(track);

				const { width, height } = track.getSettings();

				dispatch({
					type: Type.StartCapturing,
				});

				try {
					const blob = await captureDevice.takePhoto();

					const { type } = blob;
					const ext = getExtensionFromMimeType(type);

					const file = blobToFile(
						blob,
						`capture-${dateI18n(
							'Y-m-d-H-i',
							new Date(),
							undefined
						)}.${ext}`,
						type
					);
					const url = createBlobURL(file);

					mediaStream.getTracks().forEach((track) => track.stop());

					dispatch({
						type: Type.FinishRecording,
						file,
						url,
						width,
						height,
					});
				} catch (error) {
					dispatch({
						type: Type.SetError,
						error,
					});
				}
			}
		}, 1000);
	};
}
