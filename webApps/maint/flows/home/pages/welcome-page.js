define([], () => {
  'use strict';

  function plural(n, one, many) {
    return `${n} ${n === 1 ? one : many}`;
  }

  /** Home page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** One or two sentences for the welcome banner, built from the dashboard model. */
    summaryLine(model) {
      if (!model || !model.kpis || model.kpis.length === 0) {
        return 'Loading the latest maintenance picture...';
      }
      const parts = [`${plural(model.pending, 'request is', 'requests are')} waiting for approval`];
      if (model.down > 0) {
        parts.push(`${plural(model.down, 'asset is', 'assets are')} down`);
      }
      let line = `${parts.join(' and ')}.`;
      if (model.pmDue > 0) {
        line += ` ${plural(model.pmDue, 'preventive task is', 'preventive tasks are')} due this week.`;
      }
      return line;
    }

    /** The shortcut cards: the main jobs of the module, with live counts. */
    shortcuts(counts) {
      const c = counts || {};
      return [
        {
          id: 'send',
          badge: String(c.drafts || 0),
          label: 'Requests',
          title: 'Send for approval',
          text: `${plural(c.drafts || 0, 'draft is', 'drafts are')} not sent yet`,
          flow: 'requests',
          page: 'send-approval',
          requestId: '',
        },
        {
          id: 'inbox',
          badge: String(c.pending || 0),
          label: 'Approvals',
          title: 'Approval inbox',
          text: `${plural(c.pending || 0, 'request is', 'requests are')} waiting for a decision`,
          flow: 'inbox',
          page: '',
          requestId: '',
        },
        {
          id: 'workorders',
          badge: String(c.workOrdersActive || 0),
          label: 'Work',
          title: 'Work orders',
          text: `${plural(c.workOrdersActive || 0, 'work order is', 'work orders are')} scheduled or in progress`,
          flow: 'workorders',
          page: '',
          requestId: '',
        },
      ];
    }

    /** Recent requests as cards that open the request on the Requests page. */
    requestCards(requests) {
      return (requests || []).map((r) => ({
        id: r.id,
        badge: r.status,
        label: `${r.id} · ${r.priority}`,
        title: r.title,
        text: r.equipmentName,
        flow: 'requests',
        page: '',
        requestId: r.id,
      }));
    }

    /** Attention items from the store, in the card shape. */
    attentionCards(items) {
      return (items || []).map((a) => ({
        id: a.id,
        badge: a.badge,
        label: a.label,
        title: a.title,
        text: a.text,
        flow: a.flow,
        page: a.page || '',
        requestId: a.requestId || '',
      }));
    }
  }

  return PageModule;
});
