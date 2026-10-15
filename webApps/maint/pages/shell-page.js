define([], () => {
  'use strict';

  /** Shell page module: $functions.<name>() in shell HTML, $page.functions.<name>() in shell chains. */
  class PageModule {
    /** True on phone and small tablet widths, where the menu overlays the page. */
    isNarrow() {
      return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(max-width: 1023px)').matches;
    }
  }

  return PageModule;
});
