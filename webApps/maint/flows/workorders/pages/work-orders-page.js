define([], () => {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  function parse(value) {
    if (!value) {
      return null;
    }
    const [d, t] = String(value).split('T');
    const [y, m, day] = d.split('-').map(Number);
    const [hh, mm] = (t || '00:00').split(':').map(Number);
    return new Date(y, m - 1, day, hh || 0, mm || 0);
  }

  function short(value) {
    const d = parse(value);
    return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '';
  }

  const RANK = { Critical: 0, High: 1, Medium: 2, Low: 3 };

  /** Work orders page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** Splits work orders into the three board lanes. */
    board(list) {
      const all = (list || []).map((w) =>
        Object.assign({}, w, {
          whenLine:
            w.status === 'Completed'
              ? `done ${short(w.completedOn)}`
              : w.status === 'In progress'
                ? `started ${short(w.startedOn)}`
                : `planned ${short(w.scheduledFor)}`,
        }),
      );
      const byPriority = (a, b) => RANK[a.priority] - RANK[b.priority];
      const scheduled = all.filter((w) => w.status === 'Scheduled').sort((a, b) => (a.scheduledFor < b.scheduledFor ? -1 : 1));
      const inProgress = all.filter((w) => w.status === 'In progress').sort(byPriority);
      const completed = all
        .filter((w) => w.status === 'Completed')
        .sort((a, b) => (a.completedOn < b.completedOn ? 1 : -1));

      return [
        { key: 'scheduled', title: 'Scheduled', tone: 'approved', note: 'Approved and planned', count: scheduled.length, items: scheduled },
        { key: 'progress', title: 'In progress', tone: 'progress', note: 'A technician is on it', count: inProgress.length, items: inProgress },
        {
          key: 'completed',
          title: 'Completed',
          tone: 'done',
          note: completed.length > 8 ? 'Latest 8 shown' : 'Finished work',
          count: completed.length,
          items: completed.slice(0, 8),
        },
      ];
    }

    /** Keeps the work orders that match the search text. */
    filterList(list, text) {
      const q = String(text || '').trim().toLowerCase();
      if (!q) {
        return list || [];
      }
      return (list || []).filter((w) =>
        [w.id, w.requestId, w.title, w.equipmentName, w.location, w.technician, w.priority, w.type]
          .join(' ')
          .toLowerCase()
          .includes(q),
      );
    }

    /** Subtitle under the page title. */
    subtitle(stats) {
      const s = stats || {};
      return `${s.inProgress || 0} in progress · ${s.scheduled || 0} scheduled · ${s.completedThisWeek || 0} completed in the last 7 days`;
    }

    stats(list) {
      const all = list || [];
      const weekAgo = Date.now() - 7 * DAY;
      return {
        scheduled: all.filter((w) => w.status === 'Scheduled').length,
        inProgress: all.filter((w) => w.status === 'In progress').length,
        completed: all.filter((w) => w.status === 'Completed').length,
        completedThisWeek: all.filter((w) => w.status === 'Completed' && parse(w.completedOn) && parse(w.completedOn).getTime() >= weekAgo).length,
      };
    }
  }

  return PageModule;
});
