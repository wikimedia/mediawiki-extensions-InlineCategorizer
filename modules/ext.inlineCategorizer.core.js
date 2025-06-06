/*!
 * The core of InlineCategorizer
 *
 * @author Michael Dale, 2009
 * @author Leo Koppelkamm, 2011
 * @author Timo Tijhof, 2011
 */

( function () {

	/* Local scope */

	const catNsId = mw.config.get( 'wgNamespaceIds' ).category,
		isCatNsSensitive = mw.config.get( 'wgCaseSensitiveNamespaces' ).includes( catNsId );

	function getDefaultOptions() {
		return {
			catLinkWrapper: '<li>',
			$container: $( '.catlinks' ),
			$containerNormal: $( '#mw-normal-catlinks' ),
			categoryLinkSelector: 'li a:not(.icon)',
			multiEdit: mw.config.get( 'wgUserGroups', [] ).includes( 'user' ),
			resolveRedirects: true
		};
	}

	/**
	 * @param {string} s
	 * @return {string}
	 */
	function clean( s ) {
		if ( typeof s === 'string' ) {
			return s.replace( /[\x00-\x1f\x23\x3c\x3e\x5b\x5d\x7b\x7c\x7d\x7f\s]+/g, '' );
		}
		return '';
	}

	/**
	 * Generates a random id out of 62 alpha-numeric characters.
	 *
	 * @param {number} idLength Length of id (optional, defaults to 32)
	 * @return {string}
	 */
	function generateRandomId( idLength ) {
		idLength = typeof idLength === 'number' ? idLength : 32;
		let seed = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz',
			id = '';
		for ( var r, i = 0; i < idLength; i++ ) {
			r = Math.floor( Math.random() * seed.length );
			id += seed.substring( r, r + 1 );
		}
		return id;
	}

	/**
	 * Helper function for $.fn.suggestions
	 *
	 * @this {jQuery}
	 * @param {string} value Textbox value.
	 */
	function fetchSuggestions( value ) {
		let request,
			$el = this,
			catName = clean( value );

		request = $.ajax( {
			url: mw.util.wikiScript( 'api' ),
			data: {
				action: 'query',
				list: 'allpages',
				apnamespace: catNsId,
				apprefix: catName,
				format: 'json'
			},
			dataType: 'json',
			success: function ( data ) {
				// Process data.query.allpages into an array of titles
				const pages = data.query.allpages,
					titleArr = pages.map( ( page ) => new mw.Title( page.title ).getMainText() );

				$el.suggestions( 'suggestions', titleArr );
			}
		} );
		$el.data( 'suggestions-request', request );
	}

	/**
	 * Replace <nowiki> and comments with unique keys in the page text.
	 *
	 * @param {string} text
	 * @param {string} id Unique key for this nowiki replacement layer call.
	 * @param {Array} keys Array where fragments will be stored in.
	 * @return {string}
	 */
	function replaceNowikis( text, id, keys ) {
		const matches = text.match( /(<nowiki>[\s\S]*?<\/nowiki>|<!--[\s\S]*?-->)/g );
		if ( matches ) {
			for ( let i = 0; i < matches.length; i++ ) {
				keys[ i ] = matches[ i ];
				text = text.replace( matches[ i ], String( id ) + '-' + i );
			}
		}
		return text;
	}

	/**
	 * Restore <nowiki> and comments from unique keys in the page text.
	 *
	 * @param {string} text
	 * @param {string} id Unique key of the layer to be restored, as passed to replaceNowikis().
	 * @param {Array} keys Array where fragements should be fetched from.
	 * @return {string}
	 */
	function restoreNowikis( text, id, keys ) {
		for ( let i = 0; i < keys.length; i++ ) {
			text = text.replace( String( id ) + '-' + i, keys[ i ] );
		}
		return text;
	}

	/**
	 * Make string to case-insensitive RegExp string.
	 * Useful when 'i' flag can't be used.
	 * Return stuff like [Ff][Oo][Oo]
	 * TODO: Support characters outside of the Unicode BMP
	 *
	 * @param {string} string String for RegExp
	 * @return {string} Processed RegExp string
	 */
	function makeCaseInsensitive( string ) {
		let newString = '';
		for ( let i = 0; i < string.length; i++ ) {
			const char = string.charAt( i );
			const upper = char.toUpperCase();
			const lower = char.toLowerCase();
			newString += upper === lower ?
				// Escape special RegExp characters
				mw.util.escapeRegExp( char ) :
				// Escaping of special RegExp characters is not needed
				// because they never have upper !== lower.
				'[' + upper + lower + ']';
		}
		return newString;
	}

	/**
	 * Build a regex that matches legal invocations of the passed category.
	 *
	 * @param {string} category
	 * @param {boolean} matchLineBreak Match one following linebreak as well?
	 * @return {RegExp}
	 */
	function buildRegex( category, matchLineBreak ) {
		let categoryRegex, categoryNSFragment, titleFragment;

		// Filter out all names for category namespace
		categoryNSFragment = $.map( mw.config.get( 'wgNamespaceIds' ), ( id, name ) => {
			if ( id === catNsId ) {
				return !isCatNsSensitive ?
					makeCaseInsensitive( name ) :
					mw.util.escapeRegExp( name );
			}
			// Otherwise don't include in categoryNSFragment
			return null;
		} ).join( '|' );

		// Ignore case of the first character of the category name.
		titleFragment = makeCaseInsensitive( category.charAt( 0 ) ) +
			mw.util.escapeRegExp( category.slice( 1 ) );

		// Support ' ' and '_' as space.
		titleFragment = titleFragment.replace( /( |_)/g, '[ _]' );

		categoryRegex = '\\[\\[(' + categoryNSFragment + ')' + '[ _]*' + ':' + '[ _]*' + titleFragment + '[ _]*' + '(\\|[^\\]]*)?\\]\\]';
		if ( matchLineBreak ) {
			categoryRegex += '[ \\t\\r]*\\n?';
		}
		return new RegExp( categoryRegex, 'g' );
	}

	/**
	 * Manufacture iconed button, with or without text.
	 *
	 * @param {string} icon The icon class
	 * @param {string} title Title attribute
	 * @param {string} [className] Additional classes to be added to the button
	 * @param {string} [text] Text label of button
	 * @return {jQuery} The button
	 */
	function createButton( icon, title, className, text ) {
		// eslint-disable-next-line mediawiki/class-doc
		const $button = $( '<a>' )
			.addClass( className || '' )
			.attr( 'title', title );

		if ( text ) {
			// eslint-disable-next-line mediawiki/class-doc
			const $icon = $( '<span>' ).addClass( 'icon ' + icon );
			$button.addClass( 'icon-parent' ).text( text ).prepend( $icon );
		} else {
			// eslint-disable-next-line mediawiki/class-doc
			$button.addClass( 'icon ' + icon );
		}
		return $button;
	}

	/**
	 * mw.InlineCategorizer
	 *
	 * @constructor
	 * @param {Object} options
	 */
	mw.InlineCategorizer = function ( options ) {

		this.options = options = Object.assign( getDefaultOptions(), options );

		// Save scope in shortcut
		const ajaxcat = this;

		// Elements tied to this instance
		this.saveAllButton = null;
		this.cancelAllButton = null;
		this.addContainer = null;

		this.request = null;

		// Stash and hooks
		this.stash = {
			dialogDescriptions: [],
			editSummaries: [],
			fns: []
		};
		this.hooks = {
			beforeAdd: [],
			beforeChange: [],
			beforeDelete: [],
			afterAdd: [],
			afterChange: [],
			afterDelete: []
		};

		/* Event handlers */

		/**
		 * Handle add category submit. Not to be called directly.
		 *
		 * @this Element
		 */
		this.handleAddLink = function () {
			const $el = $( this ),
				$link = $( [] ),
				categoryText = $el.parent().find( '.mw-addcategory-input' ).val() || '';

			// Resolve redirects
			ajaxcat.resolveRedirects( categoryText, ( resolvedCatTitle ) => {
				ajaxcat.handleCategoryAdd( $link, resolvedCatTitle, '', false );
			} );
		};

		/**
		 * @this Element
		 */
		this.createEditInterface = function () {
			const $el = $( this ),
				$link = $el.data( 'link' ),
				category = $link.text(),
				$input = ajaxcat.makeSuggestionBox( category,
					ajaxcat.handleEditLink,
					mw.msg( ajaxcat.options.multiEdit ? 'inlinecategorizer-confirm-ok' : 'inlinecategorizer-confirm-save' )
				);

			$link.after( $input ).hide();

			$input.find( '.mw-addcategory-input' ).trigger( 'focus' );

			// Get the editButton associated with this category link,
			// and hide it.
			$link.data( 'editButton' ).hide();

			// Get the deleteButton associated with this category link,
			$link.data( 'deleteButton' )
				// (re)set click handler
				.off( 'click' )
				.click( function () {
					// When the delete button is clicked:
					// - Remove the suggestion box
					// - Show the link and it's edit button
					// - (re)set the click handler again
					$input.remove();
					$link.show().data( 'editButton' ).show();
					$( this )
						.off( 'click' )
						.on( 'click', ajaxcat.handleDeleteLink )
						.attr( 'title', mw.msg( 'inlinecategorizer-remove-category' ) );
				} )
				.attr( 'title', mw.msg( 'inlinecategorizer-cancel' ) );
		};

		/**
		 * Handle edit category submit. Not to be called directly.
		 *
		 * @this Element
		 */
		this.handleEditLink = function () {
			let input, category, sortkey, categoryOld,
				$el = $( this ),
				$link = $el.parent().parent().find( 'a:not(.icon)' );

			// Grab category text
			input = $el.parent().find( '.mw-addcategory-input' ).val();

			// Split categoryname and sortkey
			const arr = input.split( '|', 2 );
			category = arr[ 0 ];
			sortkey = arr[ 1 ]; // Is usually undefined, ie. if there was no '|' in the input.

			// Grab text
			const isAdded = $link.hasClass( 'mw-added-category' );
			ajaxcat.resetCatLink( $link );
			categoryOld = $link.text();

			// If something changed and the new cat is already on the page, delete it.
			if ( categoryOld !== category && ajaxcat.containsCat( category ) ) {
				$link.data( 'deleteButton' ).click();
				return;
			}

			// Resolve redirects
			ajaxcat.resolveRedirects( category, ( resolvedCatTitle ) => {
				ajaxcat.handleCategoryEdit(
					$link,
					categoryOld,
					resolvedCatTitle,
					sortkey,
					isAdded
				);
			} );
		};

		/**
		 * Handle delete category submit. Not to be called directly.
		 *
		 * @this Element
		 */
		this.handleDeleteLink = function () {
			const $el = $( this ),
				$link = $el.parent().find( 'a:not(.icon)' ),
				category = $link.text();

			if ( $link.is( '.mw-added-category, .mw-changed-category' ) ) {
				// We're just cancelling the addition or edit
				ajaxcat.resetCatLink( $link, $link.hasClass( 'mw-added-category' ) );
				return;
			} else if ( $link.is( '.mw-removed-category' ) ) {
				// It's already removed...
				return;
			}

			ajaxcat.handleCategoryDelete( $link, category );
		};

		/**
		 * When multiEdit mode is enabled,
		 * this is called when the user clicks "save all"
		 * Combines the dialogDescriptions and edit functions.
		 *
		 * @this Element
		 */
		this.handleStashedCategories = function () {
			// Remove "holes" in array
			// Replace this by .flat() when supported by all Grade A browsers.
			let dialogDescriptions = $.grep( ajaxcat.stash.dialogDescriptions, ( n ) => n );

			if ( dialogDescriptions.length < 1 ) {
				// Nothing to do here.
				ajaxcat.saveAllButton.hide();
				ajaxcat.cancelAllButton.hide();
				return;
			}
			dialogDescriptions = dialogDescriptions.join( '<br/>' );

			// Remove "holes" in array
			// Replace this by .flat() when supported by all Grade A browsers.
			let summaryShort = $.grep( ajaxcat.stash.editSummaries, ( n ) => n );
			summaryShort = summaryShort.join( ', ' );

			const fns = ajaxcat.stash.fns;

			ajaxcat.doConfirmEdit( {
				modFn: function ( oldtext ) {
					// Run the text through all action functions
					let newtext = oldtext;
					for ( let i = 0; i < fns.length; i++ ) {
						if ( typeof fns[ i ] === 'function' ) {
							newtext = fns[ i ]( newtext );
							if ( newtext === false ) {
								return false;
							}
						}
					}
					return newtext;
				},
				dialogDescription: dialogDescriptions,
				editSummary: summaryShort,
				doneFn: function () {
					ajaxcat.resetAll( true );
				},
				$link: null,
				action: 'all'
			} );
		};
	};

	/* Public methods */

	mw.InlineCategorizer.prototype = {
		/**
		 * Create the UI
		 */
		setup: function () {
			// Only do it for articles.
			if ( !mw.config.get( 'wgIsArticle' ) ) {
				return;
			}

			const options = this.options,
				ajaxcat = this,
				// Create [Add Category] link
				$addLink = createButton( 'icon-add',
					mw.msg( 'inlinecategorizer-add-category' ),
					'mw-ajax-addcategory',
					mw.msg( 'inlinecategorizer-add-category' )
				).click( function () {
					$( this ).nextAll().toggle().filter( '.mw-addcategory-input' ).trigger( 'focus' );
				} );

			// Create add category prompt
			this.addContainer = this.makeSuggestionBox( '', this.handleAddLink, mw.msg( 'inlinecategorizer-add-category-submit' ) );
			this.addContainer.children().hide();
			this.addContainer.prepend( $addLink );

			// Create edit & delete link for each category.
			$( '#catlinks' ).find( 'li a' ).each( function () {
				ajaxcat.createCatButtons( $( this ) );
			} );

			options.$containerNormal.append( this.addContainer );

			// @todo Make more clickable
			this.saveAllButton = createButton( 'icon-tick',
				mw.msg( 'inlinecategorizer-confirm-save-all' ),
				'',
				mw.msg( 'inlinecategorizer-confirm-save-all' )
			);
			this.cancelAllButton = createButton( 'icon-close',
				mw.msg( 'inlinecategorizer-cancel-all' ),
				'',
				mw.msg( 'inlinecategorizer-cancel-all' )
			);
			this.saveAllButton.click( this.handleStashedCategories ).hide();
			this.cancelAllButton.click( () => {
				ajaxcat.resetAll( false );
			} ).hide();
			options.$containerNormal.append( this.saveAllButton ).append( this.cancelAllButton );
			options.$container.append( this.addContainer );
		},

		/**
		 * Insert a newly added category into the DOM.
		 *
		 * @param {mw.Title} catTitle Category title for which a link should be created.
		 * @return {jQuery}
		 */
		createCatLink: function ( catTitle ) {
			const catName = catTitle.getMainText(),
				$catLinkWrapper = $( this.options.catLinkWrapper ),
				$anchor = $( '<a>' )
					.text( catName )
					.attr( {
						target: '_blank',
						href: catTitle.getUrl()
					} );

			$catLinkWrapper.append( $anchor );

			this.createCatButtons( $anchor );

			return $anchor;
		},

		/**
		 * Create a suggestion box for use in edit/add dialogs
		 *
		 * @param {string} prefill Prefill input
		 * @param {Function} callback Called on submit
		 * @param {string} buttonVal Button text
		 * @return {jQuery}
		 */
		makeSuggestionBox: function ( prefill, callback, buttonVal ) {
			// Create add category prompt
			const $promptContainer = $( '<div>' )
				.addClass( 'mw-addcategory-prompt' );
			const $promptTextbox = $( '<input>' )
				.attr( { type: 'text', size: 30 } )
				.addClass( 'mw-addcategory-input' );
			const $addButton = $( '<input>' )
				.attr( 'type', 'button' )
				.addClass( 'mw-addcategory-button' );

			if ( prefill !== '' ) {
				$promptTextbox.val( prefill );
			}

			$addButton
				.val( buttonVal )
				.on( 'click', callback );

			$promptTextbox
				.on( 'keyup', ( e ) => {
					if ( e.keyCode === 13 ) {
						$addButton.trigger( 'click' );
					}
				} )
				.suggestions( {
					fetch: fetchSuggestions,
					cancel: function () {
						const req = this.data( 'suggestions-request' );
						if ( req && req.abort ) {
							req.abort();
						}
					}
				} )
				.suggestions();

			$promptContainer
				.append( $promptTextbox )
				.append( $addButton );

			return $promptContainer;
		},

		/**
		 * Execute or queue a category addition.
		 *
		 * @param {jQuery} $link Anchor tag of category link inside #catlinks.
		 * @param {mw.Title} catTitle Instance of mw.Title of the category to be added.
		 * @param {string} [catSortkey] sort key
		 * @param {boolean} [noAppend]
		 * @return {mw.inlineCategorizer}
		 */
		handleCategoryAdd: function ( $link, catTitle, catSortkey, noAppend ) {
			const ajaxcat = this,
				// Suffix is wikitext between '[[Category:Foo' and ']]'.
				suffix = catSortkey ? '|' + catSortkey : '',
				catName = catTitle.getMainText(),
				catFull = catTitle.toText();

			if ( this.containsCat( catName ) ) {
				this.showError( mw.msg( 'inlinecategorizer-category-already-present', catName ) );
				return this;
			}

			if ( !$link.length ) {
				$link = this.createCatLink( catTitle );
			}

			// Mark red if missing
			$link.toggleClass( 'new', !catTitle.exists() );

			this.doConfirmEdit( {
				modFn: function ( oldText ) {
					let newText = ajaxcat.runHooks( oldText, 'beforeAdd', catName );
					newText = newText + '\n[[' + catFull + suffix + ']]\n';
					return ajaxcat.runHooks( newText, 'afterAdd', catName );
				},
				dialogDescription: mw.message( 'inlinecategorizer-add-category-summary', catName ).escaped(),
				editSummary: '+[[' + catFull + ']]',
				doneFn: function ( unsaved ) {
					if ( !noAppend ) {
						ajaxcat.options.$container
							.find( '#mw-normal-catlinks > .mw-addcategory-prompt' ).children( 'input' ).hide();
						ajaxcat.options.$container
							.find( '#mw-normal-catlinks ul' ).append( $link.parent() );
					} else {
						// Remove input box & button
						$link.data( 'deleteButton' ).click();

						// Update link text and href
						$link.show().text( catName ).attr( 'href', catTitle.getUrl() );
					}
					if ( unsaved ) {
						$link.addClass( 'mw-added-category' );
					}
					$( '.mw-ajax-addcategory' ).trigger( 'click' );
				},
				$link: $link,
				action: 'add'
			} );
			return this;
		},

		/**
		 * Execute or queue a category edit.
		 *
		 * @param {jQuery} $link Anchor tag of category link in #catlinks.
		 * @param {string} oldCatName Name of category before edit
		 * @param {mw.Title} catTitle Instance of mw.Title for new category
		 * @param {string} catSortkey Sort key of new category link (optional)
		 * @param {boolean} isAdded True if this is a new link, false if it changed an existing one
		 */
		handleCategoryEdit: function ( $link, oldCatName, catTitle, catSortkey, isAdded ) {
			const ajaxcat = this,
				catName = catTitle.getMainText();

			// Category add needs to be handled differently
			if ( isAdded ) {
				// Pass sortkey back
				this.handleCategoryAdd( $link, catTitle, catSortkey, true );
				return;
			}

			// User didn't change anything, trigger delete
			// @todo Document why it's deleted.
			if ( oldCatName === catName ) {
				$link.data( 'deleteButton' ).click();
				return;
			}

			// Mark red if missing
			$link.toggleClass( 'new', !catTitle.exists() );

			const categoryRegex = buildRegex( oldCatName ),
				editSummary = '[[' + new mw.Title( oldCatName, catNsId ).toText() + ']] -> [[' + catTitle.toText() + ']]';

			ajaxcat.doConfirmEdit( {
				modFn: function ( oldText ) {
					let newText = ajaxcat.runHooks( oldText, 'beforeChange', oldCatName, catName ),
						matches = newText.match( categoryRegex );

					// Old cat wasn't found, likely to be transcluded
					if ( !Array.isArray( matches ) ) {
						ajaxcat.showError( mw.msg( 'inlinecategorizer-edit-category-error', oldCatName ) );
						return false;
					}

					const suffix = catSortkey ? '|' + catSortkey : matches[ 0 ].replace( categoryRegex, '$2' ),
						newCategoryWikitext = '[[' + catTitle + suffix + ']]';

					if ( matches.length > 1 ) {
						// The category is duplicated. Remove all but one match
						for ( let i = 1; i < matches.length; i++ ) {
							oldText = oldText.replace( matches[ i ], '' );
						}
					}
					newText = oldText.replace( categoryRegex, newCategoryWikitext );

					return ajaxcat.runHooks( newText, 'afterChange', oldCatName, catName );
				},
				dialogDescription: mw.message( 'inlinecategorizer-edit-category-summary', oldCatName, catName ).escaped(),
				editSummary: editSummary,
				doneFn: function ( unsaved ) {
					// Remove input box & button
					$link.data( 'deleteButton' ).click();

					// Update link text and href
					$link.show().text( catName ).attr( 'href', catTitle.getUrl() );
					if ( unsaved ) {
						$link.data( 'origCat', oldCatName ).addClass( 'mw-changed-category' );
					}
				},
				$link: $link,
				action: 'edit'
			} );
		},

		/**
		 * Checks the API whether the category in question is a redirect.
		 * Also returns existance info (to color link red/blue)
		 *
		 * @param {string} category Name of category to resolve
		 * @param {Function} callback Called with 1 argument (mw.Title object)
		 */
		resolveRedirects: function ( category, callback ) {
			if ( !this.options.resolveRedirects ) {
				callback( category, true );
				return;
			}
			let catTitle = new mw.Title( category, catNsId ),
				queryVars = {
					action: 'query',
					titles: catTitle.toString(),
					redirects: 1,
					format: 'json'
				};

			$.getJSON( mw.util.wikiScript( 'api' ), queryVars, ( json ) => {
				const redirect = json.query.redirects,
					exists = !json.query.pages[ -1 ];

				// If it's a redirect 'exists' is for the target, not the origin
				if ( redirect ) {
					// Register existance of redirect origin as well,
					// a non-existent page can't be a redirect.
					mw.Title.exist.set( catTitle.toString(), true );

					// Override title with the redirect target
					catTitle = new mw.Title( redirect[ 0 ].to ).getMainText();
				}

				// Register existence
				mw.Title.exist.set( catTitle.toString(), exists );

				callback( catTitle );
			} );
		},

		/**
		 * Append edit and remove buttons to a given category link
		 *
		 * @param {jQuery} $element Anchor element, to which the buttons should be appended.
		 * @return {mw.inlineCategorizer}
		 */
		createCatButtons: function ( $element ) {
			const deleteButton = createButton( 'icon-close', mw.msg( 'inlinecategorizer-remove-category' ) ),
				editButton = createButton( 'icon-edit', mw.msg( 'inlinecategorizer-edit-category' ) ),
				saveButton = createButton( 'icon-tick', mw.msg( 'inlinecategorizer-confirm-save' ) ).hide(),
				ajaxcat = this;

			deleteButton.click( this.handleDeleteLink );
			editButton.click( ajaxcat.createEditInterface );

			$element.after( deleteButton ).after( editButton );

			// Save references to all links and buttons
			$element.data( {
				deleteButton: deleteButton,
				editButton: editButton,
				saveButton: saveButton
			} );
			editButton.data( {
				link: $element
			} );
			return this;
		},

		/**
		 * Append spinner wheel to element.
		 *
		 * @param {jQuery} $el
		 * @return {mw.inlineCategorizer}
		 */
		addProgressIndicator: function ( $el ) {
			$el.append( $( '<div>' ).addClass( 'mw-ajax-loader' ) );
			return this;
		},

		/**
		 * Find and remove spinner wheel from inside element.
		 *
		 * @param {jQuery} $el
		 * @return {mw.inlineCategorizer}
		 */
		removeProgressIndicator: function ( $el ) {
			$el.find( '.mw-ajax-loader' ).remove();
			return this;
		},

		/**
		 * Parse the DOM $container and build a list of
		 * present categories.
		 *
		 * @return {Array} All categories
		 */
		getCats: function () {
			const cats = this.options.$container
				.find( this.options.categoryLinkSelector )
				.map( function () {
					return mw.Title.makeTitle( catNsId, $( this ).text() ).getNameText();
				} );
			return cats;
		},

		/**
		 * Check whether a passed category is present in the DOM.
		 *
		 * @param {string} newCat Category name to be checked for.
		 * @return {boolean}
		 */
		containsCat: function ( newCat ) {
			newCat = mw.Title.makeTitle( catNsId, newCat ).getNameText();
			return this.getCats().includes( newCat );
		},

		/**
		 * Execute or queue a category delete.
		 *
		 * @param {jQuery} $link
		 * @param {string} category
		 */
		handleCategoryDelete: function ( $link, category ) {
			const categoryRegex = buildRegex( category, true ),
				ajaxcat = this;

			this.doConfirmEdit( {
				modFn: function ( oldText ) {
					let newText = ajaxcat.runHooks( oldText, 'beforeDelete', category );
					newText = newText.replace( categoryRegex, '' );

					if ( newText === oldText ) {
						ajaxcat.showError( mw.msg( 'inlinecategorizer-remove-category-error', category ) );
						return false;
					}

					return ajaxcat.runHooks( newText, 'afterDelete', category );
				},
				dialogDescription: mw.message( 'inlinecategorizer-remove-category-summary', category ).escaped(),
				editSummary: '-[[' + new mw.Title( category, catNsId ) + ']]',
				doneFn: function ( unsaved ) {
					if ( unsaved ) {
						$link.addClass( 'mw-removed-category' );
					} else {
						$link.parent().remove();
					}
				},
				$link: $link,
				action: 'delete'
			} );
		},

		/**
		 * Takes a category link element
		 * and strips all data from it.
		 *
		 * @param {jQuery} $link
		 * @param {boolean} del
		 * @param {boolean} dontRestoreText
		 */
		resetCatLink: function ( $link, del, dontRestoreText ) {
			$link.removeClass( 'mw-removed-category mw-added-category mw-changed-category' );
			const data = $link.data();

			if ( typeof data.stashIndex === 'number' ) {
				this.removeStashItem( data.stashIndex );
			}
			if ( del ) {
				$link.parent().remove();
				return;
			}
			if ( data.origCat && !dontRestoreText ) {
				const catTitle = new mw.Title( data.origCat, catNsId );
				$link.text( catTitle.getMainText() );
				$link.attr( 'href', catTitle.getUrl() );
			}

			$link.removeData();

			// Re-add data
			$link.data( {
				saveButton: data.saveButton,
				deleteButton: data.deleteButton,
				editButton: data.editButton
			} );
		},

		/**
		 * Do the actual edit.
		 * Gets token & text from api, runs it through fn and saves it with summary.
		 *
		 * @param {string} page Pagename
		 * @param {Function} fn edit function
		 * @param {string} summary
		 * @param {Function} doneFn Callback after all is done
		 */
		doEdit: function ( page, fn, summary, doneFn ) {
			// Get an edit token for the page.
			const getTokenVars = {
					action: 'query',
					prop: 'info|revisions',
					intoken: 'edit',
					titles: page,
					rvprop: 'content|timestamp',
					format: 'json'
				}, ajaxcat = this;

			$.post(
				mw.util.wikiScript( 'api' ),
				getTokenVars,
				( json ) => {
					if ( 'error' in json ) {
						ajaxcat.showError(
							mw.msg( 'inlinecategorizer-api-error', json.error.code, json.error.info )
						);
						return;
					}
					if ( !json.query || !json.query.pages ) {
						ajaxcat.showError( mw.msg( 'inlinecategorizer-api-unknown-error' ) );
						return;
					}
					const infos = json.query.pages;

					$.each( infos, ( pageid, data ) => {
						let token = data.edittoken,
							timestamp = data.revisions[ 0 ].timestamp,
							oldText = data.revisions[ 0 ][ '*' ],
							// Unique ID for nowiki replacement
							nowikiKey = generateRandomId(),
							// Nowiki fragments will be stored here during the changes
							nowikiFragments = [];

						// Replace all nowiki parts with unique keys..
						oldText = replaceNowikis( oldText, nowikiKey, nowikiFragments );

						// ..then apply the changes to the page text..
						let newText = fn( oldText );
						if ( newText === false ) {
							return;
						}

						// ..and restore the nowiki parts back.
						newText = restoreNowikis( newText, nowikiKey, nowikiFragments );

						const postEditVars = {
							action: 'edit',
							title: page,
							text: newText,
							summary: summary,
							token: token,
							basetimestamp: timestamp,
							format: 'json'
						};

						$.post(
							mw.util.wikiScript( 'api' ),
							postEditVars,
							doneFn,
							'json'
						).fail( ( xhr, text, error ) => {
							ajaxcat.showError( mw.msg( 'inlinecategorizer-api-error', text, error ) );
						} );
					} );
				},
				'json'
			).fail( ( xhr, text, error ) => {
				ajaxcat.showError( mw.msg( 'inlinecategorizer-api-error', text, error ) );
			} );
		},

		/**
		 * This gets called by all action buttons
		 * Displays a dialog to confirm the action
		 * Afterwards do the actual edit.
		 *
		 * @param {Object} props
		 * - {Function} modFn text-modifying function
		 * - {string} dialogDescription Changes done
		 *            (HTML for in the dialog, escape before hand if needed)
		 * - {string} editSummary Changes done (text for the edit summary)
		 * - {Function} doneFn callback after everything is done
		 * - {jQuery} $link
		 * - {string} action
		 * @return {mw.inlineCategorizer}
		 */
		doConfirmEdit: function ( props ) {
			let $summaryHolder, $reasonBox, $dialog, submitFunction,
				buttons = {},
				dialogOptions = {
					AutoOpen: true,
					buttons: buttons,
					width: 450
				},
				ajaxcat = this;

			// Check whether to use multiEdit mode:
			if ( this.options.multiEdit && props.action !== 'all' ) {
				// Stash away
				props.$link
					.data( 'stashIndex', this.stash.fns.length )
					.data( 'summary', props.dialogDescription );

				this.stash.dialogDescriptions.push( props.dialogDescription );
				this.stash.editSummaries.push( props.editSummary );
				this.stash.fns.push( props.modFn );

				this.saveAllButton.show();
				this.cancelAllButton.show();

				// Clear input field after action
				ajaxcat.addContainer.find( '.mw-addcategory-input' ).val( '' );

				// This only does visual changes, fire done and return.
				props.doneFn( true );
				return this;
			}

			// Summary of the action to be taken
			$summaryHolder = $( '<p>' ).append(
				$( '<strong>' ).text( mw.msg( 'inlinecategorizer-category-question' ) ),
				$( '<br>' ),
				props.dialogDescription
			);

			// Reason textbox.
			$reasonBox = $( '<input>' )
				.attr( { type: 'text', size: 45 } )
				.addClass( 'mw-ajax-confirm-reason' );

			// Produce a confirmation dialog
			$dialog = $( '<div>' )
				.addClass( 'mw-ajax-confirm-dialog' )
				.attr( 'title', mw.msg( 'inlinecategorizer-confirm-title' ) )
				.append(
					$summaryHolder,
					$reasonBox
				);

			// Submit button
			submitFunction = function () {
				ajaxcat.addProgressIndicator( $dialog );
				ajaxcat.doEdit(
					mw.config.get( 'wgPageName' ),
					props.modFn,
					props.editSummary + ': ' + $reasonBox.val(),
					() => {
						props.doneFn();

						// Clear input field after successful edit
						ajaxcat.addContainer.find( '.mw-addcategory-input' ).val( '' );

						$dialog.dialog( 'close' );
						ajaxcat.removeProgressIndicator( $dialog );
					}
				);
			};

			buttons[ mw.msg( 'inlinecategorizer-confirm-save' ) ] = submitFunction;

			$dialog.dialog( dialogOptions ).keyup( ( e ) => {
				// Close on enter
				if ( e.keyCode === 13 ) {
					submitFunction();
				}
			} );

			return this;
		},

		/**
		 * @param {number|jQuery} i Stash index or jQuery object of stash item.
		 * @return {mw.inlineCategorizer}
		 */
		removeStashItem: function ( i ) {
			if ( typeof i !== 'number' ) {
				i = i.data( 'stashIndex' );
			}

			try {
				delete this.stash.fns[ i ];
				delete this.stash.dialogDescriptions[ i ];
			} catch ( e ) {}

			if ( $.isEmptyObject( this.stash.fns ) ) {
				this.stash.fns = [];
				this.stash.dialogDescriptions = [];
				this.stash.editSummaries = [];
				this.saveAllButton.hide();
				this.cancelAllButton.hide();
			}
			return this;
		},

		/**
		 * Reset all data from the category links and the stash.
		 *
		 * @param {boolean} del Delete any category links with .mw-removed-category
		 * @return {mw.inlineCategorizer}
		 */
		resetAll: function ( del ) {
			let $links = this.options.$container.find( this.options.categoryLinkSelector ),
				$del = $( [] ),
				ajaxcat = this;

			if ( del ) {
				$del = $links.filter( '.mw-removed-category' ).parent();
			}

			$links.each( function () {
				ajaxcat.resetCatLink( $( this ), false, del );
			} );

			$del.remove();

			this.options.$container.find( '#mw-hidden-catlinks' ).remove();

			return this;
		},

		/**
		 * Add hooks
		 * Currently available: beforeAdd, beforeChange, beforeDelete,
		 * afterAdd, afterChange, afterDelete
		 * If the hook function returns false, all changes are aborted.
		 *
		 * @param {string} type Type of hook to add
		 * @param {Function} fn Hook function. The following vars are passed to it:
		 * 1. oldtext: The wikitext before the hook
		 * 2. category: The deleted, added, or changed category
		 * 3. (only for beforeChange/afterChange): newcategory
		 */
		addHook: function ( type, fn ) {
			if ( !this.hooks[ type ] || typeof fn !== 'function' ) {
				return;
			} else {
				this.hooks[ type ].push( fn );
			}
		},

		/**
		 * Open a dismissable error dialog
		 *
		 * @param {string} str The error description
		 */
		showError: function ( str ) {
			const $oldDialog = $( '.mw-ajax-confirm-dialog' );
			this.removeProgressIndicator( $oldDialog );
			$oldDialog.dialog( 'close' );

			const $dialog = $( '<div>' ).text( str );

			const buttons = {};
			buttons[ mw.msg( 'inlinecategorizer-confirm-ok' ) ] = function () {
				$dialog.dialog( 'close' );
			};

			const dialogOptions = {
				buttons: buttons,
				AutoOpen: true,
				title: mw.msg( 'inlinecategorizer-error-title' )
			};
			$dialog.dialog( dialogOptions ).keyup( ( e ) => {
				if ( e.keyCode === 13 ) {
					$dialog.dialog( 'close' );
				}
			} );
		},

		/**
		 * @param {string} oldtext
		 * @param {string} type
		 * @param {string} category
		 * @param {string} [categoryNew]
		 * @return {string}
		 */
		runHooks: function ( oldtext, type, category, categoryNew ) {
			// No hooks registered
			if ( !this.hooks[ type ] ) {
				return oldtext;
			} else {
				for ( let i = 0; i < this.hooks[ type ].length; i++ ) {
					oldtext = this.hooks[ type ][ i ]( oldtext, category, categoryNew );
					if ( oldtext === false ) {
						this.showError( mw.msg( 'inlinecategorizer-category-hook-error', category ) );
						return;
					}
				}
				return oldtext;
			}
		}
	};

	$( () => {
		const categorizer = new mw.InlineCategorizer();
		// Separate function for call to prevent jQuery
		// from executing it in the document context.
		categorizer.setup();
	} );

	// Expose private functions for QUnit tests.
	if ( window.QUnit ) {
		module.exports = {
			makeCaseInsensitive: makeCaseInsensitive,
			buildRegex: buildRegex
		};
	}

}() );
