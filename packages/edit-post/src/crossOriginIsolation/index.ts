import { addFilter } from '@wordpress/hooks';

type CrossOriginValue = 'anonymous' | 'use-credentials' | '' | undefined;

// @ts-ignore -- Params are unused, but maybe we need them in the future.
function forceCrossOrigin( imgCrossOrigin: CrossOriginValue, url: string ) {
	return 'anonymous' as CrossOriginValue;
}

addFilter(
	'media.crossOrigin',
	'media-experiments/cross-origin-isolation/force-crossorigin',
	forceCrossOrigin
);
