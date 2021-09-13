( function () {
	'use strict';

	var inlineCategorizer = require( 'ext.inlineCategorizer.core' );

	QUnit.module( 'ext.inlineCategorizer.core', QUnit.newMwEnvironment( {
		config: {
			// Values like on German content language
			wgNamespaceIds: {
				kategorie: 14,
				category: 14
			},
			wgCaseSensitiveNamespaces: []
		}
	} ) );

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

	QUnit.test( 'buildRegex', function ( assert ) {
		[
			[
				'Foo Bar',
				'/\\[\\[([Kk][Aa][Tt][Ee][Gg][Oo][Rr][Ii][Ee]|' +
					'[Cc][Aa][Tt][Ee][Gg][Oo][Rr][Yy])[ _]*:[ _]*' +
					'[Ff]oo[ _]Bar[ _]*(\\|[^\\]]*)?\\]\\]/g'
			],
			[
				'ÄÄä',
				'/\\[\\[([Kk][Aa][Tt][Ee][Gg][Oo][Rr][Ii][Ee]|' +
					'[Cc][Aa][Tt][Ee][Gg][Oo][Rr][Yy])[ _]*:[ _]*' +
					'[Ää]Ää[ _]*(\\|[^\\]]*)?\\]\\]/g'
			],
			[
				// U+10C80 U+10C80 U+10CC0
				'\uD803\uDC80\uD803\uDC80\uD803\uDCC0',
				'/\\[\\[([Kk][Aa][Tt][Ee][Gg][Oo][Rr][Ii][Ee]|' +
					'[Cc][Aa][Tt][Ee][Gg][Oo][Rr][Yy])[ _]*:[ _]*' +
					'\uD803\uDC80\uD803\uDC80\uD803\uDCC0[ _]*(\\|[^\\]]*)?\\]\\]/g'
			]
		].forEach( function ( test ) {
			assert.strictEqual(
				inlineCategorizer.buildRegex( test[ 0 ], false ).toString(),
				test[ 1 ]
			);
		} );
	} );
}() );
