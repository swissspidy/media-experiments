import { addFilter } from '@wordpress/hooks';

function forceCrossOrigin(imgCrossOrigin: string | undefined, url: string) {
	return 'anonymous';
}

addFilter(
	'media.crossOrigin',
	'media-experiments/cross-origin-isolation/force-crossorigin',
	forceCrossOrigin
);
