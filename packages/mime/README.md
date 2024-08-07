# `@mexp/mime`

A set of mime type-related helper utilities, wrapping [`mime/lite`](https://www.npmjs.com/package/mime).

## API Reference

<!-- START TOKEN(Autogenerated API docs) -->

### getExtensionFromMimeType

Returns the file extension for a given mime type.

_Usage_

```js
import { getExtensionFromMimeType } from '@mexp/mime';

getExtensionFromMimeType( 'image/jpeg' ) // Returns '.jpeg'
getExtensionFromMimeType( 'video/mp4' ) // Returns '.mp4'
getExtensionFromMimeType( 'audio/mp3' ) // Returns '.mp3'
getExtensionFromMimeType( 'application/pdf' ) // Returns '.pdf'
```

_Parameters_

-   _mimeType_ `string`: Mime type.

_Returns_

-   `string | null`: File extension or null if it could not be found.

### getMediaTypeFromMimeType

Returns the media type from a given mime type.

_Usage_

```js
import { getMediaTypeFromMimeType } from '@mexp/mime';

getMediaTypeFromMimeType( 'image/jpeg' ) // Returns 'image'
getMediaTypeFromMimeType( 'video/mpeg' ) // Returns 'video'
getMediaTypeFromMimeType( 'audio/mpeg' ) // Returns 'audio'
getMediaTypeFromMimeType( 'application/pdf' ) // Returns 'pdf'
```

_Parameters_

-   _mimeType_ `string`: Mime type.

_Returns_

-   `string`: Media type.

### getMimeTypeFromExtension

Get the mime type for a given file extension.

_Usage_

```js
import { getMimeTypeFromExtension } from '@mexp/mime';

getMimeTypeFromExtension( '.jpeg' ) // Returns 'image/jpeg'
getMimeTypeFromExtension( '.mp4' ) // Returns 'video/mp4'
getMimeTypeFromExtension( '.mp3' ) // Returns 'video/mp3'
getMimeTypeFromExtension( '.pdf' ) // Returns 'application/pdf'
```

_Parameters_

-   _ext_ `string`: File extension.

_Returns_

-   `string | null`: Mime type or null if it could not be found.


<!-- END TOKEN(Autogenerated API docs) -->
