import { addFilter } from '@wordpress/hooks';
import { __ } from '@wordpress/i18n';

import { isGifVariation } from './utils';

function addGifBlockVariationToVideoBlock(settings, name: string) {
	if (name !== 'core/video') {
		return settings;
	}

	settings.variations = settings.variations || {};
	settings.variations.unshift({
		name: 'gif',
		title: 'GIF',
		scope: ['block', 'inserter', 'transform'],
		keywords: ['gif', 'giphy'],
		description: __(
			'Embed a GIF from your media library or upload a new one.',
			'media-experiments'
		),
		attributes: {
			controls: false,
			loop: true,
			autoplay: true,
			muted: true,
			playsInline: true,
		},
		isActive(blockAttributes: Record<string, unknown>) {
			return isGifVariation(blockAttributes);
		},
	});
	settings.variations.unshift({
		name: 'video',
		title: 'Video',
		scope: ['block', 'inserter', 'transform'],
		keywords: ['video'],
		description: __(
			'Embed a video from your media library or upload a new one.',
			'media-experiments'
		),
		attributes: {
			controls: true,
		},
		isActive(blockAttributes) {
			return !isGifVariation(blockAttributes);
		},
	});

	return settings;
}

addFilter(
	'blocks.registerBlockType',
	'media-experiments/variations/gif-block',
	addGifBlockVariationToVideoBlock
);
