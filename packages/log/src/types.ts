type DevToolsColor =
	| 'primary'
	| 'primary-light'
	| 'primary-dark'
	| 'secondary'
	| 'secondary-light'
	| 'secondary-dark'
	| 'tertiary'
	| 'tertiary-light'
	| 'tertiary-dark'
	| 'error';

export interface MeasureOptions {
	measureName: string;
	startTime: number | string;
	endTime?: number | string;
	// The color the entry will be displayed with in the timeline. Can only be a value from the
	// palette defined in DevToolsColor
	color?: DevToolsColor;
	// The name (and identifier) of the extension track the entry belongs to. Entries intended to
	// be displayed to the same track should contain the same value in this property.
	track?: string;
	// A short description shown over the entry when hovered.
	hintText?: string;
	// key-value pairs added to the details drawer when the entry is selected.
	detailsPairs?: [ string, string | number ][];
}

export interface MarkOptions {
	markName: string;
	// The color the entry will be displayed with in the timeline. Can only be a value from the
	// palette defined in DevToolsColor
	color?: DevToolsColor;
	// The name (and identifier) of the extension track the entry belongs to. Entries intended to
	// be displayed to the same track should contain the same value in this property.
	track?: string;
	// A short description shown over the entry when hovered.
	hintText?: string;
	// key-value pairs added to the details drawer when the entry is selected.
	detailsPairs?: [ string, string ][];
}
