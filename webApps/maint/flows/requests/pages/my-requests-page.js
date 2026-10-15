define([], () => {
  'use strict';

  const OPEN = ['Pending approval', 'Approved', 'In progress'];
  const STATUS_OPTIONS = ['All', 'Open', 'Draft', 'Pending approval', 'Approved', 'In progress', 'Completed', 'Rejected'];

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function when(value) {
    if (!value) {
      return '';
    }
    const [d, t] = String(value).split('T');
    const [y, m, day] = d.split('-').map(Number);
    return `${day} ${MONTHS[m - 1]} ${y}${t ? `, ${t}` : ''}`;
  }

  function matchesStatus(r, status) {
    if (!status || status === 'All') {
      return true;
    }
    if (status === 'Open') {
      return OPEN.includes(r.status);
    }
    return r.status === status;
  }

  function matchesScope(r, scope) {
    return scope !== 'mine' || r.requestedBy === 'You';
  }

  function matchesText(r, text) {
    const q = String(text || '').trim().toLowerCase();
    if (!q) {
      return true;
    }
    return [r.id, r.title, r.equipmentName, r.location, r.requestedBy, r.type, r.priority, r.status]
      .join(' ')
      .toLowerCase()
      .includes(q);
  }

  /** Requests page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** Applies the status, scope and search filters. */
    filterRequests(all, status, scope, text) {
      return (all || []).filter((r) => matchesStatus(r, status) && matchesScope(r, scope) && matchesText(r, text));
    }

    /** Status choices for the select, each with its count for the current scope and search. */
    statusOptions(all, scope, text) {
      const list = (all || []).filter((r) => matchesScope(r, scope) && matchesText(r, text));
      return STATUS_OPTIONS.map((s) => ({
        value: s,
        label: `${s} (${list.filter((r) => matchesStatus(r, s)).length})`,
      }));
    }

    /** Text in the circle of a workflow step. */
    flowMark(node) {
      if (!node) {
        return '';
      }
      return { done: '✓', rejected: '✕', skipped: '↷', cancelled: '–' }[node.state] || String(node.index + 1);
    }

    /** Redwood badge classes for a workflow step state. */
    flowBadge(state) {
      return (
        {
          done: 'oj-badge oj-badge-subtle oj-badge-success',
          current: 'oj-badge oj-badge-warning',
          rejected: 'oj-badge oj-badge-danger',
        }[state] || 'oj-badge oj-badge-subtle'
      );
    }

    /** One line under an approval step. */
    stepLine(step) {
      if (!step) {
        return '';
      }
      if (step.status === 'Approved' || step.status === 'Rejected') {
        return `${when(step.decidedOn)} · ${step.reason}`;
      }
      if (step.status === 'Waiting') {
        return `Waiting for a decision · ${step.reason}`;
      }
      return `Not started · ${step.reason}`;
    }
  }

  return PageModule;
});
