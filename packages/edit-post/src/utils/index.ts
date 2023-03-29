export function getMediaTypeFromBlockName(blockName: string) {
	switch (blockName) {
		case 'core/video':
			return 'video';
		case 'core/image':
			return 'image';
		case 'core/audio':
			return 'audio';
		default:
			return null;
	}
}
