# WordPress Media Experiments

[Read this doc for context](https://docs.google.com/document/d/1EPk4rglE9kPsIGBlEI11auuEO591UR6krOBYvDRoMS0/edit) (internal only)

This experimental WordPress plugin brings a ton of improvements to how media is handled in Gutenberg.

A non-exclusive list of things that have been implemented so far:

* Local poster generation during video upload
* Converting GIFs to videos
* Video transcoding and compression (e.g. MOV to MP4)
* Image transcoding and compression (e.g. HEIF to WebP)
* Audio transcoding (e.g. OGG to MP3)
* Video audio track detection and muting
* Optimization of existing media with a comparison screen
* Self-recording using webcam / microphone
* Preferences dialog
* Import external media to library

These features can be tested either by dropping media files into the editor or by editing existing media blocks in the editor.

## Development

Run `npm install` and `npm run build` to build all the JS.
