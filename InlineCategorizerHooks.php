<?php
/**
 * Hooks for InlineCategorizer
 *
 * @file
 * @ingroup Extensions
 */

class InlineCategorizerHooks implements
	\MediaWiki\Hook\BeforePageDisplayHook
{

	private Config $config;

	public function __construct(
		Config $config
	) {
		$this->config = $config;
	}

	/**
	 * @param OutputPage $out
	 * @param Skin $skin
	 */
	public function onBeforePageDisplay( $out, $skin ): void {
		$namespaces = $this->config->get( 'InlineCategorizerNamespaces' );

		// Only load if there are no restrictions, or if the current namespace
		// is in the array.
		if ( count( $namespaces ) === 0
			|| in_array( $out->getTitle()->getNamespace(), $namespaces )
		) {
			$out->addModules( 'ext.inlineCategorizer.core' );
		}
	}

}
