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

    /** The compact counters under the banner; each one opens the right place. */
    tiles(counts, model) {
      const c = counts || {};
      const m = model || {};
      return [
        { id: 'pending', value: String(c.pending || 0), label: 'Waiting for approval', hint: 'Approval inbox', tone: c.pending ? 'warn' : 'ok', flow: 'inbox', page: '' },
        { id: 'down', value: String(c.equipmentDown || 0), label: 'Equipment down', hint: 'Equipment', tone: c.equipmentDown ? 'danger' : 'ok', flow: 'equipment', page: '' },
        { id: 'drafts', value: String(c.drafts || 0), label: 'Drafts not sent', hint: 'Send for approval', tone: c.drafts ? 'info' : 'ok', flow: 'requests', page: 'send-approval' },
        { id: 'wo', value: String(c.workOrdersActive || 0), label: 'Active work orders', hint: 'Work orders', tone: 'ok', flow: 'workorders', page: '' },
        { id: 'pm', value: String(m.pmDue || 0), label: 'PM due in 7 days', hint: m.pmOverdue ? `${m.pmOverdue} overdue` : 'Dashboard', tone: m.pmOverdue ? 'warn' : 'ok', flow: 'dashboard', page: '' },
      ];
    }

    /** Attention items from the store, at most six. */
    attentionRows(items) {
      return (items || []).slice(0, 6).map((a) => ({
        id: a.id,
        tone: a.tone,
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
