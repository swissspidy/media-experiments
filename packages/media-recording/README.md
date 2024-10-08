# `@mexp/media-recording`

A custom `@wordpress/data` store for media (webcam / microphone) recording capabilities.

## API Reference

### Actions

The following set of dispatching action creators are available on the object returned by `wp.data.dispatch( 'media-experiments/media-recording' )`:

**Note:** Some actions and selectors [will be made private](https://github.com/swissspidy/media-experiments/issues/500) eventually, limiting the public API.

<!-- START TOKEN(Autogenerated actions|src/store/actions.ts) -->

#### captureImage

Captures a single image after an initial countdown.

#### countDuration

Counts the recording duration in seconds.

#### enterRecordingMode

Enters recording mode for a given block and recording type.

_Parameters_

-   _clientId_ `string`: Block client ID.
-   _recordingTypes_ Recording types.

#### leaveRecordingMode

Returns an action object signalling that recording mode should be left.

#### pauseRecording

Pauses recording.

#### resumeRecording

Resumes recording after an initial countdown.

#### retryRecording

Partially resets state to allow retrying recording.

#### setAudioInput

Sets the active audio input and triggers a media stream update.

_Parameters_

-   _deviceId_ `string`: Device ID.

#### setHasAudio

Returns an action object signalling the new value for whether audio should be recorded.

_Parameters_

-   _value_ `boolean`: New value.

#### setVideoEffect

Sets the active video effect and triggers a media stream update.

_Parameters_

-   _videoEffect_ `VideoEffect`: Video effect.

#### setVideoInput

Sets the active video input and triggers a media stream update.

_Parameters_

-   _deviceId_ `string`: Device ID.

#### startRecording

Starts recording after an initial countdown.

#### stopRecording

Stops recording.

#### toggleBlurEffect

Toggles the blur video effect and triggers a media stream update.

#### toggleHasAudio

Returns an action object signalling that audio mode should be toggled.

#### updateMediaDevices

Updates the list of available media devices.

<!-- END TOKEN(Autogenerated actions|src/store/actions.ts) -->

### Selectors

The following selectors are available on the object returned by `wp.data.select( 'media-experiments/media-recording' )`:

**Note:** Some actions and selectors [will be made private](https://github.com/swissspidy/media-experiments/issues/500) eventually, limiting the public API.

<!-- START TOKEN(Autogenerated selectors|src/store/selectors.ts) -->

#### getAudioInput

Returns the current audio device.

_Parameters_

-   _state_ `State`: Recording state.

#### getCountdown

Returns the current pre-recording countdown.

_Parameters_

-   _state_ `State`: Recording state.

#### getDevices

Returns the list of available devices.

_Parameters_

-   _state_ `State`: Recording state.

#### getDimensions

Returns the dimensions of the current recording.

_Parameters_

-   _state_ `State`: Recording state.

#### getDuration

Returns the current recording duration.

_Parameters_

-   _state_ `State`: Recording state.

#### getError

Returns the current error, if there is one.

_Parameters_

-   _state_ `State`: Recording state.

#### getFile

Returns the current file from the recording.

_Parameters_

-   _state_ `State`: Recording state.

#### getMediaChunks

Returns the recorded media chunks.

_Parameters_

-   _state_ `State`: Recording state.

#### getMediaRecorder

Returns the current MediaRecorder instance.

_Parameters_

-   _state_ `State`: Recording state.

#### getMediaStream

Returns the current MediaStream instance.

_Parameters_

-   _state_ `State`: Recording state.

#### getOriginalFile

Returns the original from the recording.

_Parameters_

-   _state_ `State`: Recording state.

#### getOriginalUrl

Returns the original URL.

_Parameters_

-   _state_ `State`: Recording state.

#### getRecordingStatus

Returns the current recording status.

_Parameters_

-   _state_ `State`: Recording state.

#### getRecordingTypes

Returns the current recording media types.

_Parameters_

-   _state_ `State`: Recording state.

#### getUrl

Returns the URL for the recording.

_Parameters_

-   _state_ `State`: Recording state.

#### getVideoEffect

Returns the current video effect.

_Parameters_

-   _state_ `State`: Recording state.

#### getVideoInput

Returns the current video device.

_Parameters_

-   _state_ `State`: Recording state.

#### hasAudio

Whether there is any audio device available.

_Parameters_

-   _state_ `State`: Recording state.

#### hasVideo

Whether there is any video device available.

_Parameters_

-   _state_ `State`: Recording state.

#### isBlockInRecordingMode

Whether the given block is currently in recording mode.

_Parameters_

-   _state_ `State`: Recording state.
-   _clientId_ `string`: Block client ID.

#### isInRecordingMode

Whether the app is currently in recording mode.

_Parameters_

-   _state_ `State`: Recording state.


<!-- END TOKEN(Autogenerated selectors|src/store/selectors.ts) -->
