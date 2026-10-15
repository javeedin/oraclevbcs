define([], () => {
  'use strict';

  /** Dashboard page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** One sentence for the banner, built from the dashboard model. */
    summaryLine(model) {
      if (!model || !model.kpis || model.kpis.length === 0) {
        return 'Loading the latest maintenance picture...';
      }
      const parts = [];
      parts.push(model.pending === 1 ? '1 request is waiting for approval' : `${model.pending} requests are waiting for approval`);
      if (model.down > 0) {
        parts.push(model.down === 1 ? '1 asset is down' : `${model.down} assets are down`);
      }
      let line = parts.join(' and ') + '.';
      if (model.pmDue > 0) {
        line += ` ${model.pmDue} preventive ${model.pmDue === 1 ? 'task is' : 'tasks are'} due this week.`;
      }
      return line;
    }
  }

  return PageModule;
});
