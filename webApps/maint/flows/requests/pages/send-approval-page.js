define([], () => {
  'use strict';

  /** Send for approval page module: $functions.<name>() in HTML, $page.functions.<name>() in chains. */
  class PageModule {
    /** Copies the drafts and marks the selected ones. */
    decorate(drafts, ids) {
      const set = new Set(ids || []);
      return (drafts || []).map((d) => Object.assign({}, d, { selected: set.has(d.id) }));
    }

    /** Everyone who will receive at least one of the selected drafts, with how many. */
    approvers(drafts, ids) {
      const set = new Set(ids || []);
      const byRole = {};
      const order = [];
      (drafts || [])
        .filter((d) => set.has(d.id))
        .forEach((d) => {
          (d.routePreview || []).forEach((step) => {
            if (!byRole[step.roleId]) {
              byRole[step.roleId] = { roleId: step.roleId, role: step.role, name: step.name, count: 0 };
              order.push(step.roleId);
            }
            byRole[step.roleId].count += 1;
          });
        });
      return order.map((id) => byRole[id]);
    }

    toggle(ids, id) {
      const list = Array.from(ids || []);
      const at = list.indexOf(id);
      if (at >= 0) {
        list.splice(at, 1);
      } else {
        list.push(id);
      }
      return list;
    }
  }

  return PageModule;
});
