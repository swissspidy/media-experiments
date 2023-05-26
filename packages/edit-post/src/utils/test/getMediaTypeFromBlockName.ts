import { getMediaTypeFromBlockName } from '../';

describe('getMediaTypeFromBlockName', () => {
	it.each([
		['core/image', 'image'],
		['core/video', 'video'],
		['core/audio', 'audio'],
	])('for block type %s returns media type %s', (blockName, mediaType) => {
		expect(getMediaTypeFromBlockName(blockName)).toStrictEqual(mediaType);
	});
});
