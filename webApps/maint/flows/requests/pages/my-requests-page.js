define([], () => {
  'use strict';

  const OPEN = ['Pending approval', 'Approved', 'In progress'];
  const CHIPS = [
    { key: 'All', label: 'All', tone: '' },
    { key: 'Open', label: 'Open', tone: '' },
    { key: 'Draft', label: 'Draft', tone: 'draft' },
    { key: 'Pending approval', label: 'Pending approval', tone: 'pending' },
    { key: 'Approved', label: 'Approved', tone: 'approved' },
    { key: 'In progress', label: 'In progress', tone: 'progress' },
    { key: 'Completed', label: 'Completed', tone: 'done' },
    { key: 'Rejected', label: 'Rejected', tone: 'rejected' },
  ];

  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function when(value) {
    if (!value) {
      return '';
    }
    const [d, t] = String(value).split('T');
    const [y, m, day] = d.split('-').map(Number);
    return `${day} ${MONTHS[m - 1]} ${y}${t ? `, ${t}` : ''}`;
  }

  function matches(r, status) {
    if (!status || status === 'All') {
      return true;
    }
    if (status === 'Open') {
      return OPEN.includes(r.status);
    }
    return r.status === status;
  }

  /** My requests page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    filterRequests(all, status, scope) {
      return (all || []).filter((r) => matches(r, status) && (scope !== 'mine' || r.requestedBy === 'You'));
    }

    statusChips(all, selected, scope) {
      const list = (all || []).filter((r) => scope !== 'mine' || r.requestedBy === 'You');
      return CHIPS.map((c) => ({
        key: c.key,
        label: c.label,
        tone: c.tone,
        count: list.filter((r) => matches(r, c.key)).length,
        selected: c.key === (selected || 'All'),
      }));
    }

    /** Text inside the step circle: a tick, a cross, or the step number. */
    stepMark(status, level) {
      if (status === 'Approved') return '✓';
      if (status === 'Rejected') return '✕';
      return String(level);
    }

    stepLine(step) {
      if (!step) {
        return '';
      }
      if (step.status === 'Approved' || step.status === 'Rejected') {
        return `${step.status} · ${when(step.decidedOn)}`;
      }
      if (step.status === 'Waiting') {
        return `Waiting for a decision · ${step.reason}`;
      }
      return `Not started · ${step.reason}`;
    }
  }

  return PageModule;
});
