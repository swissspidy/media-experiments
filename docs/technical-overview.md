# Technical Overview

## Server-side vs. client-side processing

Traditional media processing on the server:

```mermaid
sequenceDiagram
	participant U as User
	participant E as Editor
    participant S as Server

	U->>E: Drops image
    E->>S: Upload image

	create participant G as Imagick/GD

	Note right of G: Slow!
	rect rgba(255, 180, 180, 0.5)
		loop For every image size
	        S->>G: Crop image
			destroy G
		    G-->>S: Return cropped image
	    end
	end

	S-->>E: Returns attachment
	E-->>U: Updates image
```

Versus on the client:

```mermaid
sequenceDiagram
	participant U as User
	participant E as Editor
	participant W as Worker
	participant S as Server

	U->>E: Drops image

	rect rgba(100, 180, 255, 0.2)
		loop For every image size
			
	        E->>W: Crop image
			note right of W: in parallel
			destroy W
		    W-->>E: Return image
			E-->>U: Updates image
	
			E->>S: Upload thumbnail
		    S-->>E: Returns partial attachment
			E-->>U: Updates image
	    end
	end
```

## Why client-side media processing

Current image processing in WordPress relies on server-side resources and older image libraries, leading to potential performance issues and limited support for modern image formats such as AVIF.
This results in a subpar user experience, particularly with resource-intensive tasks like resizing and compressing images.
Additionally, the lack of modern compression tools like MozJPEG further hinders optimization efforts.

Client-side media processing offers a solution by leveraging the browser's capabilities to handle tasks like image resizing and compression.
This approach not only alleviates the strain on server resources but also enables the use of more advanced image formats and compression techniques, ultimately improving website performance and user experience.
By tapping into technologies like WebAssembly, WordPress can provide a more efficient and seamless media handling process for both new and existing content.

### Why WebAssembly

This plugin implements client-side media processing through technologies such as [`wasm-vips`](https://github.com/kleisauke/wasm-vips).

Using WebAssembly for client-side media processing provides significant benefits over using the browser's native capabilities of doing image manipulation through `<canvas>`.
Not only is WASM an order of magnitude faster than `<canvas>`, it is also more feature rich and ensures a consistent user experience across all browsers.

`<canvas>` only supports PNG, JPEG, and WebP (except in Safari) and a image quality setting, nothing else.
Not only does this API take longer to create images, the resulting files will be much larger too.

For **testing purposes**, this plugin does support both a WebAssembly and a `<canvas>` implementation, particularly because the former [is not yet supported in Playground](https://github.com/WordPress/wordpress-playground/issues/952).
This way you can see for yourself how superior the WASM approach is.

## Packages

The main packages:

* [`media-utils`](../packages/media-utils/README.md) - Like `@wordpress/media-utils` but more advanced.
* [`editor`](../packages/editor/README.md) - Main editor UI integration, plus hooking `media-utils` and `upload-media` into `@wordpress/block-editor`
* [`upload-media`](../packages/upload-media/README.md) - Core upload logic with a queue-like system, implemented using a custom `@wordpress/data` store.

## Cross-origin isolation / `SharedArrayBuffer`

WASM-based image optimization requires `SharedArrayBuffer` support, which in turn requires [cross-origin isolation](https://web.dev/articles/cross-origin-isolation-guide).
Implementing that in a robust way without breaking other parts of the editor is challenging. There are currently [some known issues](https://github.com/swissspidy/media-experiments/issues/294) in Firefox and Safari due to these browsers not supporting `credentialless` iframe embeds.
Embed previews in the editor currently do not work because of this, until those browsers add support for `<iframe credentialless>`. So in these browsers you will see:

![Screenshot of disabled embed previews in Firefox and Safari](https://github.com/swissspidy/media-experiments/assets/841956/1d5d9bd7-10bc-4d1d-9916-67db8347e3fa)

Check out [this tracking issue](https://github.com/swissspidy/media-experiments/issues/294) for more details and further resources.

## The upload queue

The upload queue in the `upload-media` package uses a custom `@wordpress/data` store, which basically means it's a global variable. This has implications if there are multiple editors on a page. When merging this into Gutenberg, this has to be considered/adjusted.

Check out [the package's readme](../packages/upload-media/README.md) for a list of available actions and selectors.

The queue has several advantages over the existing upload mechanism in Gutenberg:

* You always know whether there is any upload in progress and know exactly in which state each file is.
* Supports cancelling any file optimizations and uploads mid-progress.
* Facilitates client-side file compression and thumbnail generation.
* Makes it possible to limit the number of concurrent operations.

Once a file is added to the upload queue, the system determines the list of operations (such as image compression or cropping) to perform on the file, and then runs each operation one by one.

In a nutshell:

```mermaid
flowchart TD
    A[Add new item to the upload queue] --> B[Analyze file and determine list of operations]
    B --> C{Has next operation?}
    C-- Yes --> D[Perform next operation]
    D --> C
    C -- No --> E[Remove from queue to finish upload]
```

Example operations for an image:

```mermaid
flowchart TD
    A[Add image to the upload queue] --> B[Analyze file and determine list of operations]
    B --> C{Is HEIF image?}
    C-- Yes --> D[Decode HEIF image]
    C -- No --> E{Is there a big image size threshold?}
    D --> E
    E -- Yes --> F[Scale down image]
    E -- No --> G{Compress image before upload?}
    F --> G
    G -- Yes --> H[Compress image]
    G -- No --> J[Upload image to server]
    H --> J
    J --> K[Generate thumbnails]
    K --> L{Is there a big image size threshold?}
    L  -- Yes --> M[Upload original to server, if the image was scaled down]
    L -- No --> N[Remove item from queue]
    M --> N
```

## Web Workers

All the heavy image processing is offloaded to web workers using the [`@shopify/web-worker`](https://www.npmjs.com/package/@shopify/web-worker) package, which makes it easy to load any code in a web worker in a type-safe way.
