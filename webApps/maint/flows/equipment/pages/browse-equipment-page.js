define([], () => {
  'use strict';

  const CATEGORY_ORDER = ['HVAC', 'Production', 'Electrical', 'Utilities', 'Material handling', 'Fleet'];

  /** Browse equipment page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** Applies the search text, category and status filters. */
    filterList(all, text, category, status) {
      const q = String(text || '').trim().toLowerCase();
      return (all || []).filter((e) => {
        if (category && category !== 'All' && e.category !== category) {
          return false;
        }
        if (status && status !== 'all' && e.status !== status) {
          return false;
        }
        if (!q) {
          return true;
        }
        return [e.id, e.name, e.location, e.manufacturer, e.model, e.category].join(' ').toLowerCase().includes(q);
      });
    }

    /** Category choices for the select, each with its count. */
    categoryOptions(all) {
      const list = all || [];
      const options = [{ value: 'All', label: `All categories (${list.length})` }];
      CATEGORY_ORDER.forEach((cat) => {
        const count = list.filter((e) => e.category === cat).length;
        if (count) {
          options.push({ value: cat, label: `${cat} (${count})` });
        }
      });
      return options;
    }

    /** Subtitle under the page title. */
    subtitle(stats) {
      const s = stats || {};
      return `${s.total || 0} assets across three sites: ${s.running || 0} running, ${s.maintenance || 0} in maintenance, ${s.down || 0} down`;
    }

    stats(all) {
      const list = all || [];
      return {
        total: list.length,
        running: list.filter((e) => e.status === 'Running').length,
        maintenance: list.filter((e) => e.status === 'Maintenance').length,
        down: list.filter((e) => e.status === 'Down').length,
      };
    }
  }

  return PageModule;
});
