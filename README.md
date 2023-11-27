# WordPress Media Experiments

[![Commit activity](https://img.shields.io/github/commit-activity/m/swissspidy/media-experiments)](https://github.com/swissspidy/media-experiments/pulse/monthly)
[![Code Coverage](https://codecov.io/gh/swissspidy/media-experiments/branch/main/graph/badge.svg)](https://codecov.io/gh/swissspidy/media-experiments)
[![License](https://img.shields.io/github/license/swissspidy/media-experiments)](https://github.com/swissspidy/media-experiments/blob/main/LICENSE)


This experimental WordPress plugin aims to bring improved media capabilities to WordPress and specifically the block editor,
all powered by new web platform features like [WebAssembly](https://developer.mozilla.org/en-US/docs/WebAssembly).

## Development

Run `npm install` and `npm run build` to build all the JavaScript and CSS.

## Features

A non-exclusive list of things that have been implemented so far:

* Local poster generation during video upload
* Preview image generation for PDFs
* Converting GIFs to videos
* Video transcoding and compression (e.g. MOV to MP4)
* Image transcoding and compression (e.g. HEIF to WebP)
* Audio transcoding (e.g. OGG to MP3)
* Video audio track detection and muting
* Optimization of existing media with a comparison screen
* Self-recording using webcam / microphone
* Import external media to library
* Client-side image downsizing and thumbnail generation
* Preferences dialog to change default settings

These features can be tested either by dropping media files into the editor or by editing existing media blocks in the editor.

**Note:** not all of these have been fully implemented yet.

### Automatic Poster Generation

Poster images are important for UX as they are shown before a video is fully loaded and started playing.
During upload, a poster image (thumbnail) of the video is automatically taken and added to the video in both the editor and the media library.

https://github.com/swissspidy/media-experiments/assets/841956/ba082f49-145e-441e-89c5-a63acdd039bd

#### Preview image generation for PDFs

In addition to that, poster images are automatically generated for PDFs as well (powered by [`PDF.js`](https://github.com/mozilla/pdf.js)).

https://github.com/swissspidy/media-experiments/assets/841956/f26b4f7d-f60b-4177-b8d0-b79d12c8863b

### Converting GIFs to Videos

[Videos are the better GIFs](https://paulbakaus.com/gifs-must-die/), at least when it comes to file types. Animated GIFs should really not be used anymore.

This project automatically converts animated GIFs to an actual video file during upload. The image block, upon receiving the updated media item, transforms into a video block.
**Note:** Right now, that last part (block transformation) is achieved by patching Gutenberg.

https://github.com/swissspidy/media-experiments/assets/841956/df3343e5-6e49-44da-bb45-9f6f43f92665

### HEIF Image Transcoding

Uses [`libheif-js`](https://www.npmjs.com/package/libheif-js) to automatically convert HEIC images (typically taken on iPhone) to a more common format (WebP or JPEG).

### Media Optimization and Transcoding using FFmpeg

This project uses [`ffmpeg.wasm`](https://ffmpegwasm.netlify.app/) to unlock video/image/audio transcoding and compression during upload.
For example from MOV to MP4, HEIF to WebP, or OGG to MP3.

### Video Audio Channel Detection

During upload, detect whether a video actually has audio. If not, hide/disable “Muted” option in the editor.

**Note:** Right now, this is achieved by patching Gutenberg.

### Video Muting

This allows completely removing the audio channel from a video, so it’s actually _muted_.

During upload, it’s automatically detected whether the video actually has any audio channels. If not, it’s marked as muted.

https://github.com/swissspidy/media-experiments/assets/841956/2a9b566f-58ec-4256-b820-c7443fc53301

### (Improved) Import of External Media

While the image block in Gutenberg already supports importing external images into the site’s own media library, other blocks don’t.
This project changes this, while also hooking the import into the same upload logic so that imported files automatically get compressed and transcoded if needed.

### Self Recording

Adds self-recording capabilities to the video/image/audio blocks in Gutenberg so that one can record videos,
GIFs (which are basically muted looped videos), audio transcripts, or simply take a still picture using your camera and/or microphone.

This also supports automatically blurring backgrounds.

https://github.com/swissspidy/media-experiments/assets/841956/dd4ad5ed-8374-48f2-8223-9ed856b590b4

### Improved Media Placeholders

Automatically extracts the dominant color of an image and generates a BlurHash during upload.
This can be used to improve perceived performance by using them as placeholders during loading — both in the editor and on the frontend.

Whenever available, the BlurHash is used to generate a blurred placeholder image using just CSS, with a fallback to just a solid color.

Caveat: no placeholder is displayed if the image has alpha transparency, as that would lead to undesired results.

This is more advanced than the [Dominant Color Images](https://github.com/WordPress/performance/tree/86a7776df8927c01f886647bbdd0e166731fa9c9/modules/images/dominant-color-images) feature plugin,
which does not generate blurred placeholders.

<img width="436" alt="Block sidebar controls showing BlurHash and dominant color of a video" src="https://github.com/swissspidy/media-experiments/assets/841956/65f4d211-a2ed-4f0c-b600-965782de8188" />

<img width="1420" alt="Blurred placeholder vs actual image" src="https://github.com/swissspidy/media-experiments/assets/841956/4f0b8820-e191-41e0-8371-cc769ea91665" />

### Optimize Existing Media

Allows optimizing existing media items in a post by converting them to a more modern format. Either individually or in bulk.
After conversion, the old and new versions can optionally be compared with a slider. The file size savings in % are shown next to it.

Single optimization with approval/comparison step:

https://github.com/swissspidy/media-experiments/assets/841956/af783b3d-e7f4-425f-8de7-23a63dc2b9f9

Bulk optimization without the approval step:

https://github.com/swissspidy/media-experiments/assets/841956/2e83f932-5888-4eaf-b247-373620991115

### Client-Side Image Downsizing

When a new image is uploaded, WordPress will detect if it is a “big” image by [checking whether it exceeds a certain threshold](https://make.wordpress.org/core/2019/10/09/introducing-handling-of-big-images-in-wordpress-5-3/) ([currently 2560px width](https://github.com/WordPress/wordpress-develop/blob/ad2405c10e4d6311464ff40d75435ad95bb8a844/src/wp-admin/includes/image.php#L263-L284)).
Images exceeding the threshold will be scaled down on the server to prevent users from using unnecessarily large images in their content.
However, the original file is still retained just in case.

While the server-side downsizing is admirable, it’s still wasteful to upload the full original image.
Doing this client-side improves upload time and reduces bandwidth consumption.

### Client-Side Thumbnail Generation

When uploading an image to WordPress, it generates many thumbnail versions of it.
This often leads to very slow upload processes, to the point where WordPress had to build a workaround to resume failed attempts.
Besides the performance concern, the thumbnails would also not benefit from the same client-side image optimizations.

To address this, the thumbnail generation is done entirely client-side as well.
Less server stress, less failed uploads, and thumbnails with the same traits as the original.

### Saliency Detection

Detect the most relevant part of an image to improve thumbnail cropping. For example using [MediaPipe’s object detection solution](https://developers.google.com/mediapipe/solutions/vision/object_detector/).

### MozJPEG Support

Oftentimes, the MozJPEG encoder provides better or equal results than WebP.
It’s appealing to be able to generate lightweight images without the [UX downsides of WebP](https://make.wordpress.org/core/2022/09/11/webp-in-core-for-6-1/).
MozJPEG is typically not available in the server-side image libraries (GD and Imagick) used by WordPress.

### AVIF support

Same as above, useful for comparison.

### Preferences / Settings

Adds a preferences modal to the block editor where users can choose their preferred image formats (e.g. MozJPEG, WebP) and quality levels.

The default camera and microphone to use for media recording can be set here as well.

<img width="986" alt="Media preferences modal in the block editor" src="https://github.com/swissspidy/media-experiments/assets/841956/ec9b6118-70b9-46d6-911a-24709fdf220f">

### Regenerate Media Library

Ability to convert all existing images in the media library client-side. Ideally without having to stay on the page.

### Generate video captions for videos

Use AI to automatically generate video captions for videos. Nice accessibility and UX enhancement.

### Alt Text Generation

Use AI to automatically generate alt text for images and videos to improve accessibility.

### Upload Manager

Show all in-progress items for easier inspection, and allow cancelling individual uploads.
