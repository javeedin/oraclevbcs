define([], () => {
  'use strict';

  /** Dashboard page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** Subtitle under the page title, built from the dashboard model. */
    subtitle(model) {
      if (!model || !model.kpis || model.kpis.length === 0) {
        return 'Loading the latest maintenance picture...';
      }
      return `${model.totalRequests} requests and ${model.totalWorkOrders} work orders across three sites. Select a KPI to see its details.`;
    }
  }

  return PageModule;
});
