<?php
/**
 * InlineCategorizer extension
 *
 * @file
 * @ingroup Extensions
 *
 * @author Timo Tijhof <ttijhof@wikimedia.org>
 * @license GPL v2 or later
 */

/* Configuration */

/**
 * Optinally enable InlineCategorizer only on a set of namespaces.
 * Default is all.
 *
 * Example:
 *   $wgInlineCategorizerNamespaces = array( NS_MAIN, NS_PROJECT );
 */
$wgInlineCategorizerNamespaces = array();

/* Setup */

$wgExtensionCredits['other'][] = array(
	'path' => __FILE__,
	'name' => 'InlineCategorizer',
	'author' => array(
		'Michael Dale',
		'Timo Tijhof',
		'Leo Koppelkamm',
	),
	'version' => '0.1.0',
	'descriptionmsg' => 'inlinecategorizer-desc',
	'url' => 'https://www.mediawiki.org/wiki/Extension:InlineCategorizer',
	'license-name' => 'GPL-2.0-or-later'
);

// Autoloading
$dir = dirname( __FILE__ ) . '/';
$wgAutoloadClasses['InlineCategorizerHooks'] = $dir . 'InlineCategorizer.hooks.php';
$wgMessagesDirs['InlineCategorizer'] = __DIR__ . '/i18n';

// Hooks
$wgHooks['BeforePageDisplay'][] = 'InlineCategorizerHooks::beforePageDisplay';

// Modules
$commonModuleInfo = array(
	'localBasePath' => dirname( __FILE__ ) . '/modules',
	'remoteExtPath' => 'InlineCategorizer/modules',
);

$wgResourceModules['ext.inlineCategorizer.core'] = array(
	'scripts' => 'ext.inlineCategorizer.core.js',
	'styles' => 'ext.inlineCategorizer.core.css',
	'dependencies' => array(
		'jquery.suggestions',
		'jquery.ui.dialog',
		'mediawiki.Title',
		'mediawiki.util',
	),
	'messages' => array(
		'inlinecategorizer-add-category',
		'inlinecategorizer-remove-category',
		'inlinecategorizer-edit-category',
		'inlinecategorizer-add-category-submit',
		'inlinecategorizer-confirm-ok',
		'inlinecategorizer-confirm-title',
		'inlinecategorizer-confirm-save',
		'inlinecategorizer-confirm-save-all',
		'inlinecategorizer-cancel',
		'inlinecategorizer-cancel-all',
		'inlinecategorizer-add-category-summary',
		'inlinecategorizer-edit-category-summary',
		'inlinecategorizer-remove-category-summary',
		'inlinecategorizer-category-question',
		'inlinecategorizer-error-title',
		'inlinecategorizer-remove-category-error',
		'inlinecategorizer-edit-category-error',
		'inlinecategorizer-category-already-present',
		'inlinecategorizer-category-hook-error',
		'inlinecategorizer-api-error',
		'inlinecategorizer-api-unknown-error',
	),
) + $commonModuleInfo;
