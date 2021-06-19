( function () {
	'use strict';

	var inlineCategorizer = require( 'ext.inlineCategorizer.core' );

	QUnit.module( 'ext.inlineCategorizer.core', QUnit.newMwEnvironment() );

	QUnit.test( 'makeCaseInsensitive', function ( assert ) {
		[
			[ 'A', '[Aa]' ],
			[ 'a', '[Aa]' ],
			[ '_', '_' ],
			[ '\\{}()|.?*+-^$[]', '\\\\\\{\\}\\(\\)\\|\\.\\?\\*\\+\\-\\^\\$\\[\\]' ],
			[ 'Ä', '[Ää]' ],
			[ 'ä', '[Ää]' ],
			[ '€', '€' ],
			// U+10C80 (OLD HUNGARIAN CAPITAL LETTER A)
			[ '\uD803\uDC80', '\uD803\uDC80' ],
			// U+10CC0 (OLD HUNGARIAN SMALL LETTER A)
			[ '\uD803\uDCC0', '\uD803\uDCC0' ],
			// U+1D11E (MUSICAL SYMBOL G CLEF)
			[ '\uD834\uDD1E', '\uD834\uDD1E' ]
		].forEach( function ( test ) {
			assert.strictEqual( inlineCategorizer.makeCaseInsensitive( test[ 0 ] ), test[ 1 ] );
		} );
	} );
}() );
