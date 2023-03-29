export declare function isHeifImage(buffer: ArrayBuffer): boolean;
export declare function transcodeHeifImage(
	file: File,
	type?: 'image/jpeg' | 'image/png' | 'image/webp',
	quality?: number
): Promise<File>;
//# sourceMappingURL=index.d.ts.map
