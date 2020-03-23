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

if ( function_exists( 'wfLoadExtension' ) ) {
	wfLoadExtension( 'InlineCategorizer' );
	// Keep i18n globals so mergeMessageFileList.php doesn't break
	$wgMessagesDirs['InlineCategorizer'] = __DIR__ . '/i18n';
	wfWarn(
		'Deprecated PHP entry point used for InlineCategorizer extension. ' .
		'Please use wfLoadExtension instead, ' .
		'see https://www.mediawiki.org/wiki/Extension_registration for more details.'
	);
	return;
} else {
	die( 'This version of the InlineCategorizer extension requires MediaWiki 1.29+' );
}
