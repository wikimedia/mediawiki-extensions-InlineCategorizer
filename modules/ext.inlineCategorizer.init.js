jQuery( function () {
	var categorizer = new mw.InlineCategorizer();
	// Separate function for call to prevent jQuery
	// from executing it in the document context.
	categorizer.setup();
} );
