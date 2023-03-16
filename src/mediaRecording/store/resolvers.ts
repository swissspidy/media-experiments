import { Type } from './types';
import { isInRecordingMode } from './selectors';

export function getDevices() {
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

// TODO: Does this really make sense as a resolver or should this just be an action?
export function getMediaStream() {
	return async ({ select, dispatch }) => {
		if (!select.isInRecordingMode()) {
			return;
		}

		dispatch({
			type: Type.AcquireMedia,
		});

		const mediaStreamConstraints: MediaStreamConstraints = {
			audio: false,
			video: false,
		};

		if (select.hasAudio()) {
			const audioInput = select.getAudioInput();
			mediaStreamConstraints.audio = audioInput
				? { deviceId: audioInput }
				: true;
		}

		if (select.hasVideo()) {
			const videoInput = select.getVideoInput();
			mediaStreamConstraints.video = videoInput
				? { deviceId: videoInput }
				: true;
		}

		// TODO: Retry without camera/audio if rejected with NotFoundError DOMException.
		try {
			const stream = await window.navigator.mediaDevices.getUserMedia(
				mediaStreamConstraints
			);

			dispatch({
				type: Type.SetMediaStream,
				stream,
				recordingStatus: 'ready',
			});
		} catch (error) {
			dispatch({
				type: Type.SetError,
				error,
			});
		}
	};
}
