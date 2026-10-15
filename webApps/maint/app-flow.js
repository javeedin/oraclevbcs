define([], () => {
  'use strict';

  /* ======================================================================
   * Maintenance module - application module
   *
   * Every method of AppModule is callable as $application.functions.<name>()
   * from page HTML and from action chains.
   *
   * It contains a small in-browser "database" of sample data (equipment,
   * maintenance requests, approval routes and work orders). Changes are saved
   * to localStorage, so a request you raise survives a page reload while you
   * test locally. "Reset sample data" in the menu starts again.
   *
   * Going live: each action chain calls one of the store methods below
   * (equipmentList, createRequest, decide, ...). Replace those calls with
   * Actions.callRest(...) against ORDS endpoints that return the same shapes.
   * ====================================================================== */

  const STORE_KEY = 'mx-maintenance-sample-v1';
  const STORE_VERSION = 1;
  const DAY = 24 * 60 * 60 * 1000;
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const COST_THRESHOLD = 10000;
  const ME = 'You';

  const ROLES = [
    { id: 'supervisor', role: 'Maintenance supervisor', name: 'Rashid Al Mansoori' },
    { id: 'manager', role: 'Plant manager', name: 'Priya Nair' },
    { id: 'hse', role: 'HSE officer', name: 'Omar Haddad' },
  ];

  const TECHNICIANS = ['Arjun Menon', 'Fatima Zahra', 'Daniel Okafor', 'Lina Haddad', 'Sameer Khan'];
  const REQUESTERS = ['Sara Ali', 'Vikram Rao', 'Ahmed Saleh', 'Grace Lim', 'Hassan Qureshi'];
  const TYPES = ['Breakdown', 'Corrective', 'Preventive', 'Inspection', 'Safety'];
  const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];
  const STATUSES = ['Draft', 'Pending approval', 'Approved', 'In progress', 'Completed', 'Rejected'];

  const STATUS_COLORS = {
    Draft: '#8a8580',
    'Pending approval': '#c68a1d',
    Approved: '#2e7d99',
    'In progress': '#4f64a8',
    Completed: '#4c825c',
    Rejected: '#c74634',
  };
  const PRIORITY_COLORS = { Low: '#a9c4d2', Medium: '#5b98b5', High: '#d99a3d', Critical: '#c74634' };

  const CATEGORIES = {
    HVAC: { key: 'hvac', icon: 'M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9M9.5 4.5L12 6.5l2.5-2M9.5 19.5l2.5-2 2.5 2' },
    Production: { key: 'production', icon: 'M3 20V10l5 3V10l5 3V10l5 3V5h3v15zM7 17h2M12 17h2M17 17h2' },
    Electrical: { key: 'electrical', icon: 'M13 2.5L5 13.5h6l-1 8 8-11h-6z' },
    Utilities: { key: 'utilities', icon: 'M12 3.5s-6 6.6-6 10.8a6 6 0 0 0 12 0C18 10.1 12 3.5 12 3.5zM9.5 15a2.5 2.5 0 0 0 2.5 2.5' },
    'Material handling': { key: 'handling', icon: 'M4 18V6h5l3 6h5v6M4 13h8M15 6v6M3 18h18M7 18a2 2 0 1 0 0 .01M17 18a2 2 0 1 0 0 .01' },
    Fleet: { key: 'fleet', icon: 'M3 16V7h11v9M14 10h4l3 3v3h-7M7.5 18.5a1.8 1.8 0 1 0 0-.01M17.5 18.5a1.8 1.8 0 1 0 0-.01M3 16h2M10 16h4' },
  };

  /* --------------------------------------------------------------------
   * Sample master data
   * ------------------------------------------------------------------ */

  const EQUIPMENT = [
    ['EQ-1001', 'Air handling unit AHU-01', 'HVAC', 'Jebel Ali plant', 'Admin block', 'A', 'Carrier', '39HQ', 'Running'],
    ['EQ-1002', 'Chiller CH-02', 'HVAC', 'Jebel Ali plant', 'Utility yard', 'A', 'Trane', 'RTAC 400', 'Maintenance'],
    ['EQ-1003', 'Cooling tower CT-01', 'HVAC', 'Jebel Ali plant', 'Utility yard', 'B', 'Baltimore Aircoil', 'S3000E', 'Running'],
    ['EQ-1004', 'Packaging conveyor PL-2', 'Production', 'Jebel Ali plant', 'Line 2', 'A', 'Interroll', 'RM 8310', 'Running'],
    ['EQ-1005', 'Filling machine FM-3', 'Production', 'Jebel Ali plant', 'Line 3', 'A', 'Krones', 'Modulfill', 'Down'],
    ['EQ-1006', 'Labeller LB-3', 'Production', 'Jebel Ali plant', 'Line 3', 'B', 'Krones', 'Ergomatic', 'Running'],
    ['EQ-1007', 'Air compressor AC-01', 'Utilities', 'Jebel Ali plant', 'Utility yard', 'A', 'Atlas Copco', 'GA 75', 'Running'],
    ['EQ-1008', 'Standby generator GEN-1', 'Electrical', 'Jebel Ali plant', 'Substation', 'A', 'Caterpillar', 'C18', 'Running'],
    ['EQ-1009', 'Main switchboard MSB-1', 'Electrical', 'Jebel Ali plant', 'Substation', 'A', 'Schneider', 'Okken', 'Running'],
    ['EQ-1010', 'UPS system UPS-2', 'Electrical', 'Dubai Industrial City', 'Data room', 'B', 'Eaton', '93PM', 'Running'],
    ['EQ-1011', 'Forklift FL-07', 'Material handling', 'Dubai Industrial City', 'Warehouse', 'B', 'Toyota', '8FBE20', 'Down'],
    ['EQ-1012', 'Forklift FL-09', 'Material handling', 'Dubai Industrial City', 'Warehouse', 'C', 'Toyota', '8FBE20', 'Running'],
    ['EQ-1013', 'Reach truck RT-02', 'Material handling', 'Dubai Industrial City', 'Warehouse', 'B', 'Linde', 'R14', 'Running'],
    ['EQ-1014', 'Delivery truck DT-14', 'Fleet', 'Abu Dhabi depot', 'Fleet bay', 'B', 'Isuzu', 'FVR', 'Maintenance'],
    ['EQ-1015', 'Delivery van DV-03', 'Fleet', 'Abu Dhabi depot', 'Fleet bay', 'C', 'Toyota', 'Hiace', 'Running'],
    ['EQ-1016', 'Boiler BL-01', 'Utilities', 'Jebel Ali plant', 'Boiler house', 'A', 'Bosch', 'UL-S', 'Running'],
    ['EQ-1017', 'Water treatment RO-1', 'Utilities', 'Jebel Ali plant', 'Utility yard', 'B', 'Veolia', 'Sirion', 'Running'],
    ['EQ-1018', 'Fire pump FP-1', 'Utilities', 'Jebel Ali plant', 'Pump room', 'A', 'Grundfos', 'NKF', 'Running'],
    ['EQ-1019', 'CNC machining centre CNC-4', 'Production', 'Dubai Industrial City', 'Workshop', 'B', 'Haas', 'VF-2', 'Maintenance'],
    ['EQ-1020', 'Overhead crane OC-1', 'Material handling', 'Dubai Industrial City', 'Workshop', 'A', 'Konecranes', 'CXT', 'Running'],
    ['EQ-1021', 'Cold room CR-2', 'HVAC', 'Abu Dhabi depot', 'Cold store', 'A', 'Bitzer', 'Ecoline', 'Down'],
    ['EQ-1022', 'Dock leveller DL-5', 'Material handling', 'Abu Dhabi depot', 'Dock 5', 'C', 'Hormann', 'HLS 2', 'Running'],
    ['EQ-1023', 'Elevator EL-1', 'Electrical', 'Dubai Industrial City', 'Admin block', 'B', 'Otis', 'Gen2', 'Running'],
    ['EQ-1024', 'Solar inverter SI-3', 'Electrical', 'Jebel Ali plant', 'Roof array', 'C', 'SMA', 'Sunny Tripower', 'Running'],
  ];

  // Days from today to the next preventive maintenance, one per asset (negative = overdue).
  const PM_OFFSETS = [12, 3, -2, 6, 25, 40, 1, 18, 33, 5, -4, 22, 9, 15, 2, 30, 45, 11, 4, 27, 7, 60, 19, 14];

  // Open requests are written out so the demo tells a coherent story.
  // [equipmentId, type, priority, title, description, estCost, neededInDays, requester]
  const OPEN_REQUESTS = [
    // Drafts (yours, not sent yet)
    ['EQ-1018', 'Inspection', 'Medium', 'Weekly fire pump churn test', 'Run the churn test and record the discharge pressure. Last week the gauge showed a slight drop.', 1200, 5, ME],
    ['EQ-1009', 'Safety', 'High', 'Hot spot on incomer busbar', 'Thermal survey flagged 68°C on the incomer busbar joint, phase L2. Re-torque and inspect during a planned shutdown.', 14500, 7, ME],
    ['EQ-1013', 'Corrective', 'Low', 'Mast chain needs adjustment', 'Forks drop slightly when the mast is fully raised. Check chain tension and lubrication.', 650, 10, ME],
    // Pending approval
    ['EQ-1005', 'Breakdown', 'Critical', 'Filler stopped - valve block leaking', 'Line 3 stopped at 06:40. Product is leaking from the valve block on station 14. The line is down until this is fixed.', 18750, 1, 'Vikram Rao'],
    ['EQ-1021', 'Breakdown', 'Critical', 'Cold room temperature rising', 'Cold room at 9°C and climbing. Compressor trips on high pressure. Stock moved to CR-1 as a precaution.', 9800, 1, 'Grace Lim'],
    ['EQ-1003', 'Corrective', 'High', 'Fan motor vibration above limit', 'Vibration on the fan motor drive-end bearing reads 7.8 mm/s against a 4.5 mm/s limit.', 4300, 3, 'Ahmed Saleh'],
    ['EQ-1020', 'Safety', 'High', 'Hoist upper limit switch not cutting out', 'During the pre-use check the hoist did not stop at the upper limit. The crane is tagged out.', 2900, 2, 'Sara Ali'],
    ['EQ-1008', 'Inspection', 'Medium', 'Generator slow to start on weekly test', 'Needed a second crank attempt during the Monday test run. Check the batteries and the starter motor.', 1850, 4, 'Hassan Qureshi'],
    ['EQ-1017', 'Preventive', 'Medium', 'RO membrane clean-in-place', 'Normalised permeate flow is down 12%. Schedule a clean-in-place for both membrane trains.', 11200, 9, 'Vikram Rao'],
    // Approved, work order scheduled
    ['EQ-1011', 'Breakdown', 'High', 'Hydraulic leak on lift cylinder', 'Oil under the mast and the forks drift down under load. Forklift is parked.', 3400, 2, 'Grace Lim'],
    ['EQ-1016', 'Preventive', 'Medium', 'Annual burner service', 'Annual combustion analysis with nozzle and electrode replacement.', 6200, 12, 'Ahmed Saleh'],
    ['EQ-1023', 'Inspection', 'Low', 'Door sensor intermittent', 'Doors re-open at random on floor 2. Check the light curtain alignment.', 900, 8, 'Sara Ali'],
    // In progress
    ['EQ-1002', 'Corrective', 'High', 'High discharge temperature on circuit 2', 'Circuit 2 trips on high discharge temperature during the afternoon peak.', 12800, 1, 'Vikram Rao'],
    ['EQ-1014', 'Preventive', 'Medium', '60,000 km service', 'Scheduled service: engine oil, filters and brake inspection.', 2450, 0, 'Hassan Qureshi'],
    ['EQ-1019', 'Corrective', 'High', 'Spindle temperature alarm', 'Spindle runs above 55°C after 30 minutes. Check the coolant flow and the bearings.', 7600, 2, 'Ahmed Saleh'],
    ['EQ-1004', 'Corrective', 'Medium', 'Belt tracking drifts to the left', 'The belt rubs the side guide near the transfer point.', 1300, 1, 'Grace Lim'],
    // Completed (recent)
    ['EQ-1007', 'Preventive', 'Medium', 'Compressor 4,000-hour service', 'Replace the air and oil filters and the separator element.', 3100, 0, 'Vikram Rao'],
    // Rejected
    ['EQ-1024', 'Corrective', 'Low', 'Replace inverter display', 'The display is faded but the unit works normally.', 2100, 14, 'Hassan Qureshi'],
  ];

  // Issues used to generate the older, completed history.
  const ISSUES = {
    HVAC: ['Filter pressure drop high', 'Thermostat calibration', 'Refrigerant top-up', 'Fan belt replacement'],
    Production: ['Line stops intermittently', 'Gearbox noise', 'Sensor fault at the label station', 'Nozzle leaking during fill'],
    Electrical: ['Breaker trips under load', 'Battery test failed', 'Lighting circuit fault', 'Loose terminal found on inspection'],
    Utilities: ['Pressure drop in the network', 'Pump seal leaking', 'Burner ignition failure', 'Drain valve stuck'],
    'Material handling': ['Brake pedal soft', 'Battery not holding charge', 'Hydraulic hose worn', 'Hoist chain inspection'],
    Fleet: ['Engine warning light', 'Tyre replacement due', 'Cabin AC not cooling', 'Brake pads worn'],
  };

  /* --------------------------------------------------------------------
   * Small helpers
   * ------------------------------------------------------------------ */

  function seededRandom(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function today() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function addDays(date, days) {
    const d = new Date(date.getTime());
    d.setDate(d.getDate() + days);
    return d;
  }

  // Local calendar date as YYYY-MM-DD (never toISOString, which shifts to UTC).
  function isoDate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function isoStamp(date) {
    return `${isoDate(date)}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  function parse(value) {
    if (!value) {
      return null;
    }
    if (value instanceof Date) {
      return value;
    }
    const [datePart, timePart] = String(value).split('T');
    const [y, m, d] = datePart.split('-').map(Number);
    const [hh, mm] = (timePart || '00:00').split(':').map(Number);
    return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
  }

  function dayDiff(value) {
    const d = parse(value);
    if (!d) {
      return null;
    }
    const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    return Math.round((day.getTime() - today().getTime()) / DAY);
  }

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function nowStamp() {
    return isoStamp(new Date());
  }

  // "Plant manager" -> "plant manager", but "HSE officer" keeps its capitals.
  function roleText(role) {
    const text = String(role || '');
    return /^[A-Z][a-z]/.test(text) ? text.charAt(0).toLowerCase() + text.slice(1) : text;
  }

  function roleById(id) {
    return ROLES.find((r) => r.id === id);
  }

  function locationOf(eq) {
    return `${eq.site} · ${eq.area}`;
  }

  /* --------------------------------------------------------------------
   * Approval routing rules
   *   1. Maintenance supervisor approves every request
   *   2. Plant manager as well when priority is Critical or cost >= AED 10,000
   *   3. HSE officer as well for Safety requests
   * ------------------------------------------------------------------ */

  function buildRoute(priority, type, estCost) {
    const steps = [{ roleId: 'supervisor', reason: 'Every request' }];
    if (priority === 'Critical' || Number(estCost) >= COST_THRESHOLD) {
      steps.push({
        roleId: 'manager',
        reason: priority === 'Critical' ? 'Critical priority' : 'Cost of AED 10,000 or more',
      });
    }
    if (type === 'Safety') {
      steps.push({ roleId: 'hse', reason: 'Safety request' });
    }
    return steps.map((s, i) => {
      const r = roleById(s.roleId);
      return {
        level: i + 1,
        roleId: r.id,
        role: r.role,
        name: r.name,
        reason: s.reason,
        status: 'Not started',
        decidedOn: '',
        comment: '',
      };
    });
  }

  /* --------------------------------------------------------------------
   * Seed data
   * ------------------------------------------------------------------ */

  function seed() {
    const rnd = seededRandom(20261015);
    const t0 = today();
    const int = (min, max) => min + Math.floor(rnd() * (max - min + 1));

    const equipment = EQUIPMENT.map((row, i) => {
      const [id, name, category, site, area, criticality, manufacturer, model, status] = row;
      let health;
      if (status === 'Down') {
        health = int(18, 34);
      } else if (status === 'Maintenance') {
        health = int(46, 62);
      } else {
        health = int(72, 97);
      }
      return {
        id,
        name,
        category,
        site,
        area,
        location: `${site} · ${area}`,
        criticality,
        manufacturer,
        model,
        serial: `${manufacturer.slice(0, 2).toUpperCase()}${int(100000, 999999)}`,
        status,
        health,
        installed: isoDate(addDays(t0, -int(500, 3200))),
        lastService: isoDate(addDays(t0, -int(10, 85))),
        nextPm: isoDate(addDays(t0, PM_OFFSETS[i])),
        meterHours: int(1800, 41000),
      };
    });
    const eqById = (id) => equipment.find((e) => e.id === id);

    const total = 40;
    const requests = [];
    const workOrders = [];
    let woNumber = 31000;

    // Days since each open request was raised (index matches OPEN_REQUESTS).
    const OPEN_AGE = [0, 1, 2, 0, 1, 2, 3, 1, 4, 3, 5, 4, 2, 3, 4, 2, 6, 9];
    const latest = new Date(Date.now() - 45 * 60000);

    for (let k = 0; k < total; k++) {
      const daysAgo = k < OPEN_AGE.length ? OPEN_AGE[k] : 8 + Math.round((k - OPEN_AGE.length) * 2.2);
      let created = addDays(t0, -daysAgo);
      created.setHours(int(7, 16), int(0, 59));
      if (created > latest) {
        created = new Date(latest.getTime() - int(30, 240) * 60000);
      }

      let eq;
      let type;
      let priority;
      let title;
      let description;
      let estCost;
      let neededBy;
      let requestedBy;
      let status;

      if (k < OPEN_REQUESTS.length) {
        const o = OPEN_REQUESTS[k];
        eq = eqById(o[0]);
        [, type, priority, title, description, estCost] = o;
        neededBy = isoDate(addDays(t0, o[6]));
        requestedBy = o[7];
        if (k <= 2) status = 'Draft';
        else if (k <= 8) status = 'Pending approval';
        else if (k <= 11) status = 'Approved';
        else if (k <= 15) status = 'In progress';
        else if (k === 16) status = 'Completed';
        else status = 'Rejected';
      } else {
        eq = equipment[(k * 5 + 2) % equipment.length];
        const issues = ISSUES[eq.category];
        title = issues[k % issues.length];
        description = `${title}. Reported during the routine round on ${eq.area.toLowerCase()}.`;
        type = ['Corrective', 'Breakdown', 'Preventive', 'Inspection', 'Corrective'][k % 5];
        const p = rnd();
        priority = p < 0.22 ? 'Low' : p < 0.62 ? 'Medium' : p < 0.9 ? 'High' : 'Critical';
        estCost = int(4, 95) * 100;
        neededBy = isoDate(addDays(created, int(2, 10)));
        requestedBy = REQUESTERS[k % REQUESTERS.length];
        status = k === 27 ? 'Rejected' : 'Completed';
      }

      const id = `MR-${24100 + (total - 1 - k)}`;
      const createdStamp = isoStamp(created);
      const history = [{ at: createdStamp, who: requestedBy, text: 'Request created' }];
      let route = [];

      if (status !== 'Draft') {
        route = buildRoute(priority, type, estCost);
        let sent = new Date(created.getTime() + int(10, 90) * 60000);
        if (sent > latest) {
          sent = new Date(created.getTime() + 5 * 60000);
        }
        history.push({ at: isoStamp(sent), who: requestedBy, text: `Sent for approval to ${route[0].name} (${route[0].role})` });

        // How many approval steps are already decided.
        let decided = route.length;
        if (status === 'Pending approval') {
          // Requests 3, 6 and 8 already cleared the supervisor and wait on the next level.
          decided = k === 3 || k === 6 || k === 8 ? 1 : 0;
        }
        if (status === 'Rejected') {
          decided = 1;
        }

        let when = sent;
        for (let s = 0; s < route.length; s++) {
          const step = route[s];
          if (s < decided) {
            when = new Date(when.getTime() + int(1, 20) * 3600000);
            if (when > new Date()) {
              when = new Date(Date.now() - (route.length - s) * 3600000);
            }
            const rejected = status === 'Rejected' && s === decided - 1;
            step.status = rejected ? 'Rejected' : 'Approved';
            step.decidedOn = isoStamp(when);
            if (rejected) {
              step.comment = k === 17 ? 'Cosmetic only. Add it to the next scheduled PM instead.' : 'Duplicate of an existing request.';
            }
            history.push({
              at: step.decidedOn,
              who: step.name,
              text: `${rejected ? 'Rejected' : 'Approved'} by ${step.name} (${step.role})${step.comment ? `: "${step.comment}"` : ''}`,
            });
          } else if (s === decided && status === 'Pending approval') {
            step.status = 'Waiting';
            if (s > 0) {
              history.push({ at: route[s - 1].decidedOn, who: route[s - 1].name, text: `Sent to ${step.name} (${step.role})` });
            }
          }
        }

        if (['Approved', 'In progress', 'Completed'].includes(status)) {
          const tech = TECHNICIANS[(k + 2) % TECHNICIANS.length];
          woNumber += 1;
          const woId = `WO-${woNumber}`;
          let scheduledFor;
          let startedOn = '';
          let completedOn = '';
          let progress = 0;
          let woStatus;
          if (status === 'Approved') {
            woStatus = 'Scheduled';
            scheduledFor = isoDate(addDays(t0, [1, 6, 3][k - 9] || 2));
          } else if (status === 'In progress') {
            woStatus = 'In progress';
            scheduledFor = isoDate(addDays(t0, -int(0, 2)));
            startedOn = `${scheduledFor}T0${int(7, 9)}:${pad(int(0, 59))}`;
            progress = [60, 35, 20, 80][k - 12] || 40;
          } else {
            woStatus = 'Completed';
            const start = addDays(created, int(1, 3));
            scheduledFor = isoDate(start);
            startedOn = `${scheduledFor}T08:${pad(int(0, 59))}`;
            const done = addDays(start, int(0, 2));
            if (done > t0) {
              completedOn = `${isoDate(t0)}T${pad(Math.max(9, new Date().getHours() - 1))}:10`;
            } else {
              completedOn = `${isoDate(done)}T${pad(int(11, 17))}:${pad(int(0, 59))}`;
            }
            progress = 100;
          }
          workOrders.push({
            id: woId,
            requestId: id,
            title,
            equipmentId: eq.id,
            equipmentName: eq.name,
            location: locationOf(eq),
            category: eq.category,
            priority,
            type,
            status: woStatus,
            technician: tech,
            scheduledFor,
            startedOn,
            completedOn,
            progress,
          });
          history.push({ at: route[route.length - 1].decidedOn, who: 'System', text: `Work order ${woId} created for ${tech}` });
          if (startedOn) {
            history.push({ at: startedOn, who: tech, text: 'Work started' });
          }
          if (completedOn) {
            history.push({ at: completedOn, who: tech, text: 'Work completed' });
          }
        }
      }

      requests.push({
        id,
        title,
        description,
        equipmentId: eq.id,
        equipmentName: eq.name,
        location: locationOf(eq),
        category: eq.category,
        type,
        priority,
        status,
        requestedBy,
        requestedOn: createdStamp,
        neededBy,
        estCost,
        downtime: eq.status === 'Down' && k < OPEN_REQUESTS.length && type === 'Breakdown',
        route,
        history,
        workOrderId: (workOrders.find((w) => w.requestId === id) || {}).id || '',
      });
    }

    return {
      version: STORE_VERSION,
      seededOn: isoDate(t0),
      equipment,
      requests,
      workOrders,
      nextRequest: 24100 + total,
      nextWorkOrder: woNumber + 1,
    };
  }

  /* --------------------------------------------------------------------
   * Store (singleton for the whole app)
   * ------------------------------------------------------------------ */

  let state = null;

  function load() {
    if (state) {
      return state;
    }
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.version === STORE_VERSION && Array.isArray(parsed.requests)) {
          state = parsed;
          return state;
        }
      }
    } catch {
      // Storage blocked (private window, preview frame): fall back to memory only.
    }
    state = seed();
    save();
    return state;
  }

  function save() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify(state));
    } catch {
      // Ignore: the sample still works in memory.
    }
  }

  function findRequest(id) {
    return load().requests.find((r) => r.id === id);
  }

  function findEquipment(id) {
    return load().equipment.find((e) => e.id === id);
  }

  function findWorkOrder(id) {
    return load().workOrders.find((w) => w.id === id);
  }

  function waitingStep(req) {
    return (req.route || []).find((s) => s.status === 'Waiting') || null;
  }

  function enrichRequest(req) {
    const r = clone(req);
    const step = waitingStep(req);
    r.waitingFor = step ? `${step.name} (${step.role})` : '';
    r.waitingRole = step ? step.roleId : '';
    r.stepLabel = step ? `Step ${step.level} of ${req.route.length}` : '';
    r.ageDays = Math.max(0, -dayDiff(req.requestedOn));
    r.route = r.route || [];
    r.history = (r.history || []).slice().reverse(); // newest first
    return r;
  }

  function enrichEquipment(eq) {
    const e = clone(eq);
    const s = load();
    e.pmDays = dayDiff(eq.nextPm);
    e.pmState = e.pmDays < 0 ? 'overdue' : e.pmDays <= 7 ? 'due' : 'ok';
    e.openRequests = s.requests.filter(
      (r) => r.equipmentId === eq.id && ['Draft', 'Pending approval', 'Approved', 'In progress'].includes(r.status),
    ).length;
    return e;
  }

  function createWorkOrder(req) {
    const s = load();
    const id = `WO-${s.nextWorkOrder}`;
    s.nextWorkOrder += 1;
    const t0 = today();
    let scheduled = parse(req.neededBy);
    if (!scheduled || scheduled < t0) {
      scheduled = addDays(t0, 1);
    }
    const eq = findEquipment(req.equipmentId);
    const wo = {
      id,
      requestId: req.id,
      title: req.title,
      equipmentId: req.equipmentId,
      equipmentName: req.equipmentName,
      location: eq ? locationOf(eq) : req.location,
      category: req.category,
      priority: req.priority,
      type: req.type,
      status: 'Scheduled',
      technician: TECHNICIANS[s.nextWorkOrder % TECHNICIANS.length],
      scheduledFor: isoDate(scheduled),
      startedOn: '',
      completedOn: '',
      progress: 0,
    };
    s.workOrders.unshift(wo);
    req.workOrderId = id;
    return wo;
  }

  function sendRequest(req, note) {
    req.route = buildRoute(req.priority, req.type, req.estCost);
    req.route[0].status = 'Waiting';
    req.status = 'Pending approval';
    req.history.push({
      at: nowStamp(),
      who: ME,
      text: `Sent for approval to ${req.route[0].name} (${req.route[0].role})${note ? `: "${note}"` : ''}`,
    });
  }

  function listRequests() {
    return load()
      .requests.slice()
      .sort((a, b) => (a.requestedOn < b.requestedOn ? 1 : -1))
      .map(enrichRequest);
  }

  function fmtDate(value) {
    const d = parse(value);
    return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : '—';
  }

  function relDays(value) {
    const n = dayDiff(value);
    if (n === null) {
      return '';
    }
    if (n === 0) return 'today';
    if (n === 1) return 'tomorrow';
    if (n === -1) return 'yesterday';
    return n > 1 ? `in ${n} days` : `${-n} days ago`;
  }

  /* --------------------------------------------------------------------
   * Application module: everything below is $application.functions.*
   * ------------------------------------------------------------------ */

  class AppModule {
    /* ---------- Reference data ---------- */

    roles() {
      return clone(ROLES);
    }

    roleName(roleId) {
      const r = roleById(roleId);
      return r ? r.role : '';
    }

    /** Role in running text: "plant manager", "HSE officer". */
    roleText(roleOrId) {
      const r = roleById(roleOrId);
      return roleText(r ? r.role : roleOrId);
    }

    equipmentOptions() {
      return load().equipment.map((e) => ({ value: e.id, label: `${e.name} (${e.id})` }));
    }

    typeOptions() {
      return TYPES.map((t) => ({ value: t, label: t }));
    }

    routePreview(priority, type, estCost) {
      return buildRoute(priority, type, estCost);
    }

    /* ---------- Queries ---------- */

    equipmentList() {
      return load().equipment.map(enrichEquipment);
    }

    equipmentById(id) {
      const eq = findEquipment(id);
      return eq ? enrichEquipment(eq) : null;
    }

    equipmentRequests(id) {
      return load()
        .requests.filter((r) => r.equipmentId === id)
        .sort((a, b) => (a.requestedOn < b.requestedOn ? 1 : -1))
        .map(enrichRequest);
    }

    requestList() {
      return listRequests();
    }

    requestById(id) {
      const r = findRequest(id);
      return r ? enrichRequest(r) : null;
    }

    drafts() {
      return listRequests()
        .filter((r) => r.status === 'Draft')
        .map((r) => Object.assign(r, { routePreview: buildRoute(r.priority, r.type, r.estCost) }));
    }

    inbox(roleId) {
      const rank = { Critical: 0, High: 1, Medium: 2, Low: 3 };
      return listRequests()
        .filter((r) => r.status === 'Pending approval' && r.waitingRole === roleId)
        .sort((a, b) => rank[a.priority] - rank[b.priority] || b.ageDays - a.ageDays);
    }

    workOrderList() {
      return clone(load().workOrders);
    }

    counts() {
      const s = load();
      const pending = s.requests.filter((r) => r.status === 'Pending approval');
      const inboxByRole = {};
      ROLES.forEach((role) => {
        inboxByRole[role.id] = pending.filter((r) => (waitingStep(r) || {}).roleId === role.id).length;
      });
      return {
        openRequests: s.requests.filter((r) => ['Pending approval', 'Approved', 'In progress'].includes(r.status)).length,
        drafts: s.requests.filter((r) => r.status === 'Draft').length,
        pending: pending.length,
        inboxByRole,
        workOrdersActive: s.workOrders.filter((w) => w.status !== 'Completed').length,
        equipmentDown: s.equipment.filter((e) => e.status === 'Down').length,
      };
    }

    dashboard() {
      const s = load();
      const reqs = s.requests;
      const eqs = s.equipment.map(enrichEquipment);
      const open = reqs.filter((r) => ['Pending approval', 'Approved', 'In progress'].includes(r.status));
      const pending = reqs.filter((r) => r.status === 'Pending approval');
      const critical = open.filter((r) => r.priority === 'Critical').length;
      const oldestPending = pending.reduce((m, r) => Math.max(m, -dayDiff(r.requestedOn)), 0);
      const down = eqs.filter((e) => e.status === 'Down');
      const inMaint = eqs.filter((e) => e.status === 'Maintenance');
      const availability = Math.round(((eqs.length - down.length) / eqs.length) * 100);
      const scheduled = s.workOrders.filter((w) => w.status === 'Scheduled').length;
      const inProgress = s.workOrders.filter((w) => w.status === 'In progress').length;
      const pmDue = eqs.filter((e) => e.pmDays >= 0 && e.pmDays <= 7).length;
      const pmOverdue = eqs.filter((e) => e.pmDays < 0).length;

      const kpis = [
        {
          id: 'open',
          label: 'Open requests',
          value: String(open.length),
          sub: critical ? `${critical} critical` : 'none critical',
          tone: critical ? 'danger' : 'ok',
          flow: 'requests',
        },
        {
          id: 'approval',
          label: 'Awaiting approval',
          value: String(pending.length),
          sub: pending.length ? `oldest waiting ${oldestPending} ${oldestPending === 1 ? 'day' : 'days'}` : 'nothing waiting',
          tone: oldestPending > 3 ? 'warn' : 'ok',
          flow: 'inbox',
        },
        {
          id: 'availability',
          label: 'Equipment availability',
          value: `${availability}%`,
          sub: `${down.length} down · ${inMaint.length} in maintenance`,
          tone: down.length ? 'danger' : 'ok',
          flow: 'equipment',
        },
        {
          id: 'wo',
          label: 'Active work orders',
          value: String(scheduled + inProgress),
          sub: `${inProgress} in progress · ${scheduled} scheduled`,
          tone: 'ok',
          flow: 'workorders',
        },
        {
          id: 'pm',
          label: 'PM due in 7 days',
          value: String(pmDue),
          sub: pmOverdue ? `${pmOverdue} overdue` : 'none overdue',
          tone: pmOverdue ? 'warn' : 'ok',
          flow: 'equipment',
        },
      ];

      const statusPoints = STATUSES.map((st) => ({
        id: st,
        series: st,
        group: 'Requests',
        value: reqs.filter((r) => r.status === st).length,
        color: STATUS_COLORS[st],
      })).filter((p) => p.value > 0);

      // Requests raised per week (Monday start), last 8 weeks, stacked by priority.
      const t0 = today();
      const monday = addDays(t0, -((t0.getDay() + 6) % 7));
      const weeklyPoints = [];
      for (let w = 7; w >= 0; w--) {
        const start = addDays(monday, -7 * w);
        const end = addDays(start, 7);
        const label = `${start.getDate()} ${MONTHS[start.getMonth()]}`;
        PRIORITIES.forEach((p) => {
          weeklyPoints.push({
            id: `${label}-${p}`,
            series: p,
            group: label,
            value: reqs.filter((r) => {
              const d = parse(r.requestedOn);
              return r.priority === p && d >= start && d < end;
            }).length,
            color: PRIORITY_COLORS[p],
          });
        });
      }

      const health = Object.keys(CATEGORIES).map((cat) => {
        const list = eqs.filter((e) => e.category === cat);
        const avg = list.length ? Math.round(list.reduce((a, e) => a + e.health, 0) / list.length) : 0;
        return {
          category: cat,
          key: CATEGORIES[cat].key,
          avg,
          count: list.length,
          down: list.filter((e) => e.status === 'Down').length,
          tone: avg < 60 ? 'danger' : avg < 75 ? 'warn' : 'ok',
        };
      }).sort((a, b) => a.avg - b.avg);

      const attention = [];
      pending
        .filter((r) => r.priority === 'Critical')
        .forEach((r) => {
          const step = waitingStep(r);
          attention.push({
            id: `a-${r.id}`,
            tone: 'danger',
            title: `${r.id} · ${r.title}`,
            text: `Critical · waiting for ${step ? roleText(step.role) : 'approval'}`,
            flow: 'inbox',
          });
        });
      down.forEach((e) => {
        const req = reqs.find((r) => r.equipmentId === e.id && ['Pending approval', 'Approved', 'In progress'].includes(r.status));
        attention.push({
          id: `d-${e.id}`,
          tone: 'danger',
          title: `${e.name} is down`,
          text: req ? `${req.id} is ${req.status.toLowerCase()}` : 'No request raised yet',
          flow: 'equipment',
        });
      });
      eqs
        .filter((e) => e.pmDays < 0)
        .forEach((e) => {
          attention.push({
            id: `p-${e.id}`,
            tone: 'warn',
            title: `PM overdue: ${e.name}`,
            text: `was due ${-e.pmDays} ${e.pmDays === -1 ? 'day' : 'days'} ago`,
            flow: 'equipment',
          });
        });
      const draftCount = reqs.filter((r) => r.status === 'Draft').length;
      if (draftCount) {
        attention.push({
          id: 'drafts',
          tone: 'info',
          title: `${draftCount} draft ${draftCount === 1 ? 'request' : 'requests'} not sent`,
          text: 'Send them for approval',
          flow: 'approval',
        });
      }

      const upcomingPm = eqs
        .filter((e) => e.pmDays >= 0 && e.pmDays <= 14)
        .sort((a, b) => a.pmDays - b.pmDays)
        .slice(0, 6)
        .map((e) => {
          const d = parse(e.nextPm);
          return {
            id: e.id,
            name: e.name,
            location: e.location,
            day: String(d.getDate()),
            month: MONTHS[d.getMonth()],
            when: relDays(e.nextPm),
            soon: e.pmDays <= 3,
          };
        });

      const recent = listRequests().slice(0, 6);

      return {
        kpis,
        statusPoints,
        weeklyPoints,
        totalRequests: reqs.length,
        health,
        attention: attention.slice(0, 6),
        upcomingPm,
        recent,
        down: down.length,
        pending: pending.length,
        pmDue,
        pmOverdue,
      };
    }

    /* ---------- Commands ---------- */

    createRequest(form, submit) {
      const s = load();
      const eq = findEquipment(form.equipmentId);
      if (!eq) {
        throw new Error('Choose the equipment first.');
      }
      const req = {
        id: `MR-${s.nextRequest}`,
        title: String(form.title || '').trim(),
        description: String(form.description || '').trim(),
        equipmentId: eq.id,
        equipmentName: eq.name,
        location: locationOf(eq),
        category: eq.category,
        type: form.type || 'Corrective',
        priority: form.priority || 'Medium',
        status: 'Draft',
        requestedBy: ME,
        requestedOn: nowStamp(),
        neededBy: form.neededBy || '',
        estCost: Number(form.estCost) || 0,
        downtime: !!form.downtime,
        route: [],
        history: [{ at: nowStamp(), who: ME, text: 'Request created as a draft' }],
        workOrderId: '',
      };
      s.nextRequest += 1;
      s.requests.unshift(req);

      if (req.downtime && eq.status === 'Running') {
        eq.status = 'Down';
        eq.health = Math.min(eq.health, 35);
      }
      if (submit) {
        sendRequest(req, '');
      }
      save();
      return enrichRequest(req);
    }

    sendForApproval(ids, note) {
      const sent = [];
      (ids || []).forEach((id) => {
        const req = findRequest(id);
        if (req && req.status === 'Draft') {
          sendRequest(req, String(note || '').trim());
          sent.push(enrichRequest(req));
        }
      });
      save();
      return sent;
    }

    decide(id, roleId, approve, comment) {
      const req = findRequest(id);
      if (!req || req.status !== 'Pending approval') {
        return null;
      }
      const index = req.route.findIndex((st) => st.status === 'Waiting');
      const step = req.route[index];
      if (!step || step.roleId !== roleId) {
        return null;
      }
      const text = String(comment || '').trim();
      step.status = approve ? 'Approved' : 'Rejected';
      step.decidedOn = nowStamp();
      step.comment = text;
      req.history.push({
        at: step.decidedOn,
        who: step.name,
        text: `${approve ? 'Approved' : 'Rejected'} by ${step.name} (${step.role})${text ? `: "${text}"` : ''}`,
      });

      let workOrder = null;
      let next = null;
      if (!approve) {
        req.status = 'Rejected';
      } else if (index + 1 < req.route.length) {
        next = req.route[index + 1];
        next.status = 'Waiting';
        req.history.push({ at: nowStamp(), who: 'System', text: `Sent to ${next.name} (${next.role})` });
      } else {
        req.status = 'Approved';
        workOrder = createWorkOrder(req);
        req.history.push({
          at: nowStamp(),
          who: 'System',
          text: `Work order ${workOrder.id} created for ${workOrder.technician}, scheduled ${fmtDate(workOrder.scheduledFor)}`,
        });
      }
      save();
      return {
        request: enrichRequest(req),
        workOrder: clone(workOrder),
        nextRole: next ? next.role : '',
      };
    }

    advanceWorkOrder(id) {
      const wo = findWorkOrder(id);
      if (!wo || wo.status === 'Completed') {
        return null;
      }
      const req = findRequest(wo.requestId);
      const eq = findEquipment(wo.equipmentId);
      if (wo.status === 'Scheduled') {
        wo.status = 'In progress';
        wo.startedOn = nowStamp();
        wo.progress = 10;
        if (req) {
          req.status = 'In progress';
          req.history.push({ at: wo.startedOn, who: wo.technician, text: 'Work started' });
        }
        if (eq && eq.status === 'Running') {
          eq.status = 'Maintenance';
        }
      } else {
        wo.status = 'Completed';
        wo.completedOn = nowStamp();
        wo.progress = 100;
        if (req) {
          req.status = 'Completed';
          req.history.push({ at: wo.completedOn, who: wo.technician, text: 'Work completed' });
        }
        if (eq) {
          eq.status = 'Running';
          eq.health = Math.max(eq.health, 86);
          eq.lastService = isoDate(today());
          if (wo.type === 'Preventive') {
            eq.nextPm = isoDate(addDays(today(), 90));
          }
        }
      }
      save();
      return clone(wo);
    }

    resetDemo() {
      try {
        window.localStorage.removeItem(STORE_KEY);
      } catch {
        // ignore
      }
      state = seed();
      save();
      return true;
    }

    /* ---------- Messages (shell toasts) ---------- */

    message(severity, summary, detail) {
      return [
        {
          severity: severity || 'confirmation',
          summary: summary || '',
          detail: detail || '',
          autoTimeout: 5000,
          closeAffordance: 'defaults',
        },
      ];
    }

    /* ---------- Formatting helpers used in HTML ---------- */

    todayIso() {
      return isoDate(today());
    }

    greeting() {
      const h = new Date().getHours();
      return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
    }

    longToday() {
      const d = new Date();
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      return `${days[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    }

    fmtDate(value) {
      return fmtDate(value);
    }

    fmtShort(value) {
      const d = parse(value);
      return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}` : '—';
    }

    fmtDateTime(value) {
      const d = parse(value);
      return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '—';
    }

    fmtMoney(value) {
      const n = Number(value) || 0;
      return `AED ${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }

    fmtNumber(value) {
      return (Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
    }

    relDays(value) {
      return relDays(value);
    }

    plural(count, one, many) {
      return Number(count) === 1 ? one : many;
    }

    initials(name) {
      return String(name || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0].toUpperCase())
        .join('');
    }

    statusTone(status) {
      return (
        {
          Draft: 'draft',
          'Pending approval': 'pending',
          Approved: 'approved',
          Scheduled: 'approved',
          'In progress': 'progress',
          Completed: 'done',
          Rejected: 'rejected',
          Waiting: 'pending',
          'Not started': 'draft',
        }[status] || 'draft'
      );
    }

    priorityTone(priority) {
      return String(priority || 'low').toLowerCase();
    }

    equipmentTone(status) {
      return { Running: 'running', Down: 'down', Maintenance: 'maint' }[status] || 'running';
    }

    healthTone(health) {
      const h = Number(health) || 0;
      return h < 45 ? 'danger' : h < 70 ? 'warn' : 'ok';
    }

    categoryKey(category) {
      return (CATEGORIES[category] || { key: 'other' }).key;
    }

    categoryIcon(category) {
      return (CATEGORIES[category] || CATEGORIES.Utilities).icon;
    }
  }

  return AppModule;
});
