// Same type as in @mextp/upload-media
// TODO: Move to shared package?
export type ImageSizeCrop = {
	width: number;
	height: number;
	crop?:
		| boolean
		| [ 'left' | 'center' | 'right', 'top' | 'center' | 'bottom' ];
};
