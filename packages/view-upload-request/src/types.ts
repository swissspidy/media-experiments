/**
 * External dependencies
 */
import type { ImageSizeCrop } from '@mexp/upload-media';

export type RestBaseRecord = {
	description: string;
	gmt_offset: number;
	home: string;
	name: string;
	site_icon: number;
	site_icon_url: string | false;
	site_logo: number;
	timezone_string: string;
	url: string;
	// The following ones are added by Media Experiments.
	image_size_threshold: number;
	video_size_threshold: number;
	image_output_formats: Record< string, string >;
	jpeg_interlaced: boolean;
	png_interlaced: boolean;
	gif_interlaced: boolean;
	image_sizes: Record< string, ImageSizeCrop >;
};
