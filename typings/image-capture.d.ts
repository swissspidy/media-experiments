declare module 'image-capture' {
	export class ImageCapture {
		constructor(videoTrack: MediaStreamTrack);

		takePhoto(photoSettings?: PhotoSettings): Promise<Blob>;

		getPhotoCapabilities(): Promise<PhotoCapabilities>;

		getPhotoSettings(): Promise<PhotoSettings>;

		grabFrame(): Promise<ImageBitmap>;

		readonly track: MediaStreamTrack;
	}

	interface PhotoCapabilities {
		readonly redEyeReduction: RedEyeReduction;
		readonly imageHeight: MediaSettingsRange;
		readonly imageWidth: MediaSettingsRange;
		readonly fillLightMode: FillLightMode[];
	}

	interface PhotoSettings {
		fillLightMode?: FillLightMode | undefined;
		imageHeight?: number | undefined;
		imageWidth?: number | undefined;
		redEyeReduction?: boolean | undefined;
	}

	interface MediaSettingsRange {
		readonly max: number;
		readonly min: number;
		readonly step: number;
	}

	type RedEyeReduction = 'never' | 'always' | 'controllable';
	type FillLightMode = 'auto' | 'off' | 'flash';
}
