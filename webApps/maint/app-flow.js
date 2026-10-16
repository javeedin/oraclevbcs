// 'oj-sp/spectra-shell/config/config' sets up Oracle's Redwood page templates (the oj-sp pack),
// exactly as in Visual Builder's Redwood starter application.
define(['oj-sp/spectra-shell/config/config'], () => {
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
   * test locally. "Reset sample data" in the header starts again.
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

  function fmtStamp(value) {
    const d = parse(value);
    return d ? `${d.getDate()} ${MONTHS[d.getMonth()]}, ${pad(d.getHours())}:${pad(d.getMinutes())}` : '';
  }

  function fmtAed(value) {
    return `AED ${(Number(value) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
  }

  /* --------------------------------------------------------------------
   * Workflow view: the life of one request as a flow of steps
   *   raised > sent > supervisor > plant manager > HSE officer > work order > work > completed
   * Approver steps the rules don't require are shown as skipped, with the reason.
   * ------------------------------------------------------------------ */

  const FLOW_STATE_LABEL = {
    done: 'Done',
    current: 'In progress',
    pending: 'Not started',
    rejected: 'Rejected',
    skipped: 'Not needed',
    cancelled: 'Cancelled',
  };

  function skipReason(roleId, req) {
    if (roleId === 'manager') {
      return `${req.priority} priority and ${fmtAed(req.estCost)}: the plant manager only approves Critical requests or AED ${COST_THRESHOLD.toLocaleString('en-US')} and above`;
    }
    if (roleId === 'hse') {
      return `${req.type} request: the HSE officer only approves Safety requests`;
    }
    return '';
  }

  function historyAt(req, pattern) {
    const h = (req.history || []).find((x) => pattern.test(x.text));
    return h ? h.at : '';
  }

  function buildWorkflow(req) {
    const nodes = [];
    const add = (node) =>
      nodes.push(
        Object.assign({ kind: 'step', sub: '', when: '', comment: '', branch: '' }, node, {
          whenText: fmtStamp(node.when),
          stateLabel: FLOW_STATE_LABEL[node.state],
          index: nodes.length,
        }),
      );
    const isDraft = req.status === 'Draft';
    const isRejected = req.status === 'Rejected';

    add({ id: 'raised', kind: 'start', label: 'Request raised', sub: `${req.requestedBy} · ${req.type} · ${req.priority}`, when: req.requestedOn, state: 'done' });
    add({
      id: 'sent',
      label: isDraft ? 'Send for approval' : 'Sent for approval',
      sub: isDraft ? 'Still a draft: the requester has not sent it yet' : 'Route worked out from priority, type and cost',
      when: isDraft ? '' : historyAt(req, /^Sent for approval/),
      state: isDraft ? 'current' : 'done',
    });

    const steps = req.route && req.route.length ? req.route : buildRoute(req.priority, req.type, req.estCost);
    ROLES.forEach((role) => {
      const step = steps.find((s) => s.roleId === role.id);
      if (!step) {
        add({ id: role.id, kind: 'skip', label: `${role.role} approval`, sub: skipReason(role.id, req), state: 'skipped', branch: 'Rule: not required' });
        return;
      }
      let state = 'pending';
      if (step.status === 'Approved') state = 'done';
      else if (step.status === 'Rejected') state = 'rejected';
      else if (step.status === 'Waiting') state = 'current';
      else if (isRejected) state = 'cancelled';
      add({
        id: role.id,
        kind: 'approval',
        label: `${role.role} approval`,
        sub: `${step.name} · ${step.reason}`,
        when: step.decidedOn,
        state,
        comment: step.comment || '',
        branch: `Rule: ${step.reason}`,
      });
    });

    if (isRejected) {
      add({ id: 'closed', kind: 'end', label: 'Rejected and closed', sub: 'The requester can raise a new request', when: historyAt(req, /^Rejected by/), state: 'rejected' });
      return nodes;
    }

    const wo = req.workOrderId ? load().workOrders.find((w) => w.id === req.workOrderId) : null;
    add({
      id: 'workorder',
      label: 'Work order created',
      sub: wo ? `${wo.id} for ${wo.technician}, planned ${fmtDate(wo.scheduledFor)}` : 'Created automatically after the last approval',
      when: wo ? historyAt(req, /^Work order .* created/) : '',
      state: wo ? 'done' : 'pending',
    });
    let workState = 'pending';
    if (wo && wo.status === 'Completed') workState = 'done';
    else if (wo) workState = 'current';
    add({
      id: 'work',
      label: wo && wo.status === 'Scheduled' ? 'Waiting to start work' : 'Work in progress',
      sub: wo ? (wo.status === 'Scheduled' ? `${wo.technician} starts on ${fmtDate(wo.scheduledFor)}` : `${wo.technician} · ${wo.progress}% done`) : 'The technician starts and completes the work',
      when: wo ? wo.startedOn : '',
      state: workState,
    });
    add({
      id: 'completed',
      kind: 'end',
      label: 'Completed',
      sub: 'Request closed and equipment back in service',
      when: wo ? wo.completedOn : '',
      state: wo && wo.status === 'Completed' ? 'done' : 'pending',
    });
    return nodes;
  }

  /* --------------------------------------------------------------------
   * Shell bridge and desktop client
   *
   * #mxBridge is a hidden element in the shell page. The app module raises DOM events on it and
   * the shell page handles them with its own chains, so the header count, the toasts and the
   * Auto Pilot panel update whichever page changed the data:
   *   mxcounts   detail = counts()            > header "Approvals (n)", tray and taskbar badge
   *   mxtoast    detail = message(...) array  > toast
   *   mxask      detail = { prompt }          > opens Auto Pilot and asks the question
   *   mxcommand  detail = { command, flow }   > navigate | settings (tray, menu, shortcut)
   *
   * window.mxDesktop exists only inside the desktop client (desktop/preload.js). There the Claude
   * key lives in the operating system's secure storage and the desktop app calls Claude itself.
   * ------------------------------------------------------------------ */

  // The app's version: shown in the header. Keep it equal to "version" in desktop/package.json
  // (the desktop release); the Desktop app workflow checks this on every release tag.
  const APP_VERSION = '1.0.2';

  const DESKTOP = typeof window !== 'undefined' && window.mxDesktop && window.mxDesktop.isDesktop === true ? window.mxDesktop : null;
  const DESKTOP_RELEASES = 'https://github.com/javeedin/oraclevbcs/releases/latest';
  const DESKTOP_SETUP = `${DESKTOP_RELEASES}/download/Maintenance-Setup.exe`;

  function shellEvent(name, detail) {
    const el = typeof document !== 'undefined' ? document.getElementById('mxBridge') : null;
    if (!el || typeof CustomEvent !== 'function') {
      return false;
    }
    el.dispatchEvent(new CustomEvent(name, { detail }));
    return true;
  }

  /** Calls window.mxDesktop.<name>(...); undefined in a browser or when the call fails. */
  function desktopCall(name, ...args) {
    if (!DESKTOP || typeof DESKTOP[name] !== 'function') {
      return undefined;
    }
    try {
      return DESKTOP[name](...args);
    } catch {
      return undefined;
    }
  }

  // Tray, menu and global shortcut commands from the desktop client.
  if (DESKTOP && typeof DESKTOP.onCommand === 'function') {
    DESKTOP.onCommand((cmd) => {
      const c = cmd && typeof cmd === 'object' ? cmd : {};
      if (c.command === 'autopilot') {
        shellEvent('mxask', { prompt: typeof c.prompt === 'string' ? c.prompt : '' });
      } else {
        shellEvent('mxcommand', { command: String(c.command || ''), flow: String(c.flow || '') });
      }
    });
  }

  /* --------------------------------------------------------------------
   * Auto Pilot: an assistant on Claude (Claude Messages API, called from the browser)
   *
   * The API key stays in this browser: in localStorage when "Remember" is on, otherwise
   * only in memory until the page reloads. It is sent only to api.anthropic.com.
   * In the desktop client the key is kept in the operating system's secure storage instead,
   * and the desktop app makes the call (the page never sees the key).
   * For production, call Claude from a server-side proxy (ORDS, OIC or another backend)
   * so the key never reaches the browser.
   * ------------------------------------------------------------------ */

  const AP_URL = 'https://api.anthropic.com/v1/messages';
  const AP_VERSION = '2023-06-01';
  const AP_STORE_KEY = 'mx-autopilot-settings-v1';
  const AP_MAX_TOKENS = 2048;
  const AP_MAX_ROUNDS = 8;
  const AP_MAX_HISTORY = 40;
  const AP_MODELS = [
    { value: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5 (fast, recommended)' },
    { value: 'claude-opus-5-5', label: 'Claude Opus 5.5 (most capable)' },
    { value: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (fastest, lowest cost)' },
  ];
  const AP_DEFAULTS = { apiKey: '', model: 'claude-sonnet-5-5', remember: true, useData: true };
  const AP_SUGGESTIONS = [
    'What needs my attention today?',
    'Which requests are waiting for the plant manager, and for how long?',
    'Which equipment is down, and is there a request for each one?',
    'Raise a draft request: chiller CH-02 is very noisy since this morning, high priority.',
    'Explain the Procure to Pay flow in Oracle Fusion in simple steps.',
    'How do I call an Oracle Fusion REST API from Visual Builder?',
  ];
  let apSessionKey = ''; // the key, when "Remember" is off

  function apRead() {
    let saved = {};
    try {
      saved = JSON.parse(window.localStorage.getItem(AP_STORE_KEY) || '{}') || {};
    } catch {
      saved = {};
    }
    const s = Object.assign({}, AP_DEFAULTS, saved);
    if (!s.apiKey && apSessionKey) {
      s.apiKey = apSessionKey;
    }
    if (DESKTOP) {
      // The desktop client holds the key; the page never has it.
      s.apiKey = '';
      s.remember = true;
    }
    if (!AP_MODELS.some((m) => m.value === s.model)) {
      s.model = AP_DEFAULTS.model;
    }
    return s;
  }

  /** Whether a key is saved, and a hint of it: from this browser, or from the desktop client. */
  function apKeyStatus(s) {
    if (DESKTOP) {
      const st = desktopCall('keyStatus') || {};
      return { hasKey: st.hasKey === true, keyHint: String(st.keyHint || ''), store: String(st.store || 'secure storage'), secure: st.secure === true };
    }
    const k = (s || apRead()).apiKey;
    return { hasKey: !!k, keyHint: k ? `${k.slice(0, 7)}…${k.slice(-4)}` : '', store: 'this browser', secure: false };
  }

  function apWrite(s) {
    const remember = s.remember !== false;
    apSessionKey = remember ? '' : s.apiKey || '';
    const toSave = { model: s.model, remember, useData: s.useData !== false, apiKey: remember ? s.apiKey || '' : '' };
    try {
      window.localStorage.setItem(AP_STORE_KEY, JSON.stringify(toSave));
    } catch {
      // Storage blocked: the key still works until the page reloads.
      apSessionKey = s.apiKey || '';
    }
  }

  function apModelLabel(model) {
    const m = AP_MODELS.find((x) => x.value === model);
    return m ? m.label.replace(/ \(.*\)$/, '') : model;
  }

  function apSystemPrompt(useData) {
    const d = new Date();
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const lines = [
      'You are Auto Pilot, the assistant inside a maintenance management app built with Oracle Visual Builder on Oracle Redwood page templates.',
      `Today is ${days[d.getDay()]} ${isoDate(d)}. The user is "You" in the data (the person signed in).`,
      'The app covers: raising maintenance requests against equipment, sending drafts for approval, an approval route, an approval inbox, work orders, equipment health and preventive maintenance (PM).',
      `Approval rules: the maintenance supervisor approves every request; the plant manager also approves when the priority is Critical or the estimated cost is AED ${COST_THRESHOLD.toLocaleString('en-US')} or more; the HSE officer also approves Safety requests. The last approval creates a work order; completing it closes the request and puts the equipment back in service.`,
      `Approvers: ${ROLES.map((r) => `${r.role} ${r.name}`).join('; ')}. Sites: Jebel Ali plant, Dubai Industrial City, Abu Dhabi depot. Currency: AED. All data is sample data kept in the browser.`,
    ];
    if (useData) {
      lines.push(
        'Use the tools to look up the live data before answering questions about requests, equipment, approvals or work orders. Never invent IDs, names, dates or numbers.',
        'Only call create_draft_request when the user clearly asks you to raise or create a request. It saves a draft; tell the user the ID and that they still send it for approval (Requests > Send for approval).',
      );
    } else {
      lines.push('Access to the maintenance data is turned off in Settings. If asked about requests, equipment or approvals, say so and suggest turning on "Let Auto Pilot read the maintenance data".');
    }
    lines.push(
      'You are also an expert in Oracle: Fusion Cloud Applications (ERP Financials, Procurement, Supply Chain including Maintenance Management, HCM), E-Business Suite, Visual Builder and VB Studio, Redwood, APEX, ORDS, Oracle Integration (OIC), BI Publisher and OTBI, PL/SQL and Oracle Database. Answer general Oracle questions directly and practically, with navigation paths, REST resources or code when useful, and say so when a detail depends on the release.',
      'Style: concise and practical. Short paragraphs and bullet lists, **bold** for key terms, `code` for names, fenced code blocks for code, a markdown table only to compare several items.',
    );
    return lines.join('\n');
  }

  const AP_TOOLS = [
    {
      name: 'get_overview',
      description: 'The current maintenance picture: KPIs, counts, what needs attention, equipment down, approvals waiting longest, PM due and overdue. Use it first for broad questions such as "what needs my attention".',
      input_schema: { type: 'object', properties: {} },
    },
    {
      name: 'search_requests',
      description: 'Find maintenance requests, newest first. Every filter is optional. Returns a short summary per request; use get_request for the full approval route and history.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Open', ...STATUSES], description: 'Open means Pending approval, Approved or In progress.' },
          priority: { type: 'string', enum: PRIORITIES },
          type: { type: 'string', enum: TYPES },
          text: { type: 'string', description: 'Words to match in the ID, title, description, equipment, location or requester.' },
          equipment_id: { type: 'string', description: 'Equipment ID such as EQ-1005.' },
          raised_by_me: { type: 'boolean' },
          limit: { type: 'integer', minimum: 1, maximum: 40 },
        },
      },
    },
    {
      name: 'get_request',
      description: 'Everything about one request: description, cost, approval route with each step, history and work order.',
      input_schema: { type: 'object', properties: { id: { type: 'string', description: 'Request ID such as MR-24131.' } }, required: ['id'] },
    },
    {
      name: 'search_equipment',
      description: 'Find equipment (assets) with status, health, next preventive maintenance and open requests. Every filter is optional.',
      input_schema: {
        type: 'object',
        properties: {
          text: { type: 'string', description: 'Words to match in the ID, name, maker, model or location.' },
          category: { type: 'string', enum: Object.keys(CATEGORIES) },
          status: { type: 'string', enum: ['Running', 'Maintenance', 'Down'] },
          pm: { type: 'string', enum: ['overdue', 'due_in_7_days'], description: 'Preventive maintenance filter.' },
        },
      },
    },
    {
      name: 'get_equipment',
      description: 'One asset with its specs and full maintenance request history.',
      input_schema: { type: 'object', properties: { id: { type: 'string', description: 'Equipment ID such as EQ-1005.' } }, required: ['id'] },
    },
    {
      name: 'get_approval_inbox',
      description: 'Requests waiting for an approver role, most urgent first.',
      input_schema: {
        type: 'object',
        properties: { role: { type: 'string', enum: ROLES.map((r) => r.id), description: 'supervisor = Maintenance supervisor, manager = Plant manager, hse = HSE officer.' } },
        required: ['role'],
      },
    },
    {
      name: 'list_work_orders',
      description: 'Work orders with status, technician, dates and progress.',
      input_schema: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['Scheduled', 'In progress', 'Completed'] },
          text: { type: 'string', description: 'Words to match in the work order, request, equipment or technician.' },
        },
      },
    },
    {
      name: 'preview_approval_route',
      description: 'Who would have to approve a request with this priority, type and estimated cost.',
      input_schema: {
        type: 'object',
        properties: {
          priority: { type: 'string', enum: PRIORITIES },
          type: { type: 'string', enum: TYPES },
          est_cost: { type: 'number', description: 'Estimated cost in AED.' },
        },
        required: ['priority', 'type'],
      },
    },
    {
      name: 'create_draft_request',
      description: 'Save a new maintenance request as a DRAFT (it is not sent for approval). Only use it when the user explicitly asks to raise or create a request. Look up the exact equipment_id with search_equipment first.',
      input_schema: {
        type: 'object',
        properties: {
          equipment_id: { type: 'string' },
          title: { type: 'string', description: 'Short title, at most 80 characters.' },
          description: { type: 'string', description: 'What was observed.' },
          type: { type: 'string', enum: TYPES },
          priority: { type: 'string', enum: PRIORITIES },
          needed_by: { type: 'string', description: 'Date as YYYY-MM-DD, optional.' },
          est_cost: { type: 'number', description: 'Estimated cost in AED, optional.' },
        },
        required: ['equipment_id', 'title', 'description', 'type', 'priority'],
      },
    },
  ];

  function apRequestSummary(r) {
    return {
      id: r.id,
      title: r.title,
      status: r.status,
      priority: r.priority,
      type: r.type,
      equipment: `${r.equipmentName} (${r.equipmentId})`,
      location: r.location,
      raisedBy: r.requestedBy,
      raisedOn: r.requestedOn,
      neededBy: r.neededBy || undefined,
      estCostAed: r.estCost,
      waitingFor: r.waitingFor || undefined,
      workOrder: r.workOrderId || undefined,
    };
  }

  function apEquipmentSummary(e) {
    return {
      id: e.id,
      name: e.name,
      category: e.category,
      location: e.location,
      status: e.status,
      healthPct: e.health,
      criticality: e.criticality,
      nextPm: e.nextPm,
      pm: e.pmState,
      openRequests: e.openRequests,
    };
  }

  function apMatches(values, text) {
    const q = String(text || '').trim().toLowerCase();
    if (!q) {
      return true;
    }
    const hay = values.join(' ').toLowerCase();
    return q.split(/\s+/).every((w) => hay.includes(w));
  }

  // Runs one tool against the store. `app` is an AppModule instance (its methods are stateless).
  function apRunTool(app, name, input) {
    const i = input || {};
    switch (name) {
      case 'get_overview': {
        const d = app.dashboard();
        return {
          kpis: d.kpis.map((k) => ({ kpi: k.label, value: k.value, detail: k.sub })),
          needsAttention: d.attention.map((a) => `${a.badge}: ${a.title} (${a.text})`),
          equipmentDown: d.downList,
          waitingLongest: d.waitingLongest,
          pmDueNext14Days: d.upcomingPm.map((p) => `${p.name} (${p.id}) ${p.when}`),
          pmOverdue: d.overduePm.map((p) => `${p.name} (${p.id}) ${p.when}`),
          counts: app.counts(),
        };
      }
      case 'search_requests': {
        const open = ['Pending approval', 'Approved', 'In progress'];
        const found = listRequests().filter((r) => {
          if (i.status === 'Open' ? !open.includes(r.status) : i.status && r.status !== i.status) return false;
          if (i.priority && r.priority !== i.priority) return false;
          if (i.type && r.type !== i.type) return false;
          if (i.equipment_id && r.equipmentId !== String(i.equipment_id).toUpperCase()) return false;
          if (i.raised_by_me && r.requestedBy !== ME) return false;
          return apMatches([r.id, r.title, r.description, r.equipmentName, r.equipmentId, r.location, r.requestedBy], i.text);
        });
        const limit = Math.min(Math.max(Number(i.limit) || 15, 1), 40);
        return { total: found.length, shown: Math.min(limit, found.length), requests: found.slice(0, limit).map(apRequestSummary) };
      }
      case 'get_request': {
        const r = app.requestById(String(i.id || '').trim().toUpperCase());
        if (!r) {
          return { error: `There is no request ${i.id}. Use search_requests to find the right ID.` };
        }
        return Object.assign(apRequestSummary(r), {
          description: r.description,
          equipmentDown: r.downtime,
          approvalRoute: r.route.map((s) => ({
            step: s.level,
            role: s.role,
            approver: s.name,
            why: s.reason,
            status: s.status,
            decidedOn: s.decidedOn || undefined,
            comment: s.comment || undefined,
          })),
          history: r.history.map((h) => `${h.at} ${h.text}`),
        });
      }
      case 'search_equipment': {
        const found = app.equipmentList().filter((e) => {
          if (i.category && e.category !== i.category) return false;
          if (i.status && e.status !== i.status) return false;
          if (i.pm === 'overdue' && e.pmState !== 'overdue') return false;
          if (i.pm === 'due_in_7_days' && e.pmState !== 'due') return false;
          return apMatches([e.id, e.name, e.manufacturer, e.model, e.location, e.category], i.text);
        });
        return { total: found.length, equipment: found.map(apEquipmentSummary) };
      }
      case 'get_equipment': {
        const e = app.equipmentById(String(i.id || '').trim().toUpperCase());
        if (!e) {
          return { error: `There is no equipment ${i.id}. Use search_equipment to find the right ID.` };
        }
        return Object.assign(apEquipmentSummary(e), {
          manufacturer: e.manufacturer,
          model: e.model,
          serial: e.serial,
          installed: e.installed,
          lastService: e.lastService,
          meterHours: e.meterHours,
          requests: app.equipmentRequests(e.id).map((r) => `${r.id} ${r.status}: ${r.title} (${r.requestedOn.slice(0, 10)})`),
        });
      }
      case 'get_approval_inbox': {
        const role = roleById(i.role);
        if (!role) {
          return { error: 'role must be supervisor, manager or hse.' };
        }
        const items = app.inbox(role.id);
        return { role: role.role, approver: role.name, total: items.length, requests: items.map(apRequestSummary) };
      }
      case 'list_work_orders': {
        const found = app.workOrderList().filter((w) => (!i.status || w.status === i.status) && apMatches([w.id, w.requestId, w.title, w.equipmentName, w.technician, w.location], i.text));
        return {
          total: found.length,
          workOrders: found.slice(0, 30).map((w) => ({
            id: w.id,
            request: w.requestId,
            title: w.title,
            equipment: w.equipmentName,
            status: w.status,
            technician: w.technician,
            scheduledFor: w.scheduledFor,
            startedOn: w.startedOn || undefined,
            completedOn: w.completedOn || undefined,
            progressPct: w.progress,
          })),
        };
      }
      case 'preview_approval_route':
        return { steps: buildRoute(i.priority, i.type, i.est_cost).map((s) => `${s.level}. ${s.role} (${s.name}): ${s.reason}`) };
      case 'create_draft_request': {
        const eq = findEquipment(String(i.equipment_id || '').trim().toUpperCase());
        if (!eq) {
          return { error: `There is no equipment ${i.equipment_id}. Use search_equipment to find the right ID.` };
        }
        if (!String(i.title || '').trim() || !String(i.description || '').trim()) {
          return { error: 'title and description are required.' };
        }
        const neededBy = /^\d{4}-\d{2}-\d{2}$/.test(String(i.needed_by || '')) ? i.needed_by : '';
        const req = app.createRequest(
          {
            equipmentId: eq.id,
            title: String(i.title).trim().slice(0, 80),
            description: String(i.description).trim(),
            type: TYPES.includes(i.type) ? i.type : 'Corrective',
            priority: PRIORITIES.includes(i.priority) ? i.priority : 'Medium',
            neededBy,
            estCost: Number(i.est_cost) || 0,
            downtime: false,
          },
          false,
        );
        return {
          created: req.id,
          status: req.status,
          equipment: `${req.equipmentName} (${req.equipmentId})`,
          approvalRouteWhenSent: buildRoute(req.priority, req.type, req.estCost).map((s) => s.role),
          note: 'Saved as a draft. The user sends it from Requests > Send for approval.',
        };
      }
      default:
        return { error: `Unknown tool ${name}.` };
    }
  }

  function apToolSummary(name, input, out) {
    const i = input || {};
    if (!out || out.error) {
      return `${name.replace(/_/g, ' ')}: not found`;
    }
    switch (name) {
      case 'get_overview': return 'Read the overview';
      case 'search_requests': return `Searched requests (${out.total})`;
      case 'get_request': return `Opened ${String(i.id).toUpperCase()}`;
      case 'search_equipment': return `Searched equipment (${out.total})`;
      case 'get_equipment': return `Opened ${String(i.id).toUpperCase()}`;
      case 'get_approval_inbox': return `Checked the ${roleText(out.role)} inbox (${out.total})`;
      case 'list_work_orders': return `Listed work orders (${out.total})`;
      case 'preview_approval_route': return 'Worked out the approval route';
      case 'create_draft_request': return `Created draft ${out.created}`;
      default: return name;
    }
  }

  // Keeps the conversation short enough: drops the oldest turns, always restarting at a plain user question.
  function apTrim(messages) {
    const list = messages.slice();
    while (list.length > AP_MAX_HISTORY) {
      list.shift();
      while (list.length && !(list[0].role === 'user' && typeof list[0].content === 'string')) {
        list.shift();
      }
    }
    return list;
  }

  function apCheck(ok, status, data) {
    if (ok) {
      return data || {};
    }
    const detail = data && data.error && data.error.message ? data.error.message : `HTTP ${status}`;
    const hint = {
      400: 'Claude could not process the request.',
      401: 'The API key was rejected. Check it in Settings.',
      403: 'This API key is not allowed to do that.',
      404: 'That model is not available to this key. Pick another model in Settings.',
      413: 'The conversation is too long. Start a new chat.',
      429: 'Rate or spend limit reached. Wait a moment and try again.',
      529: 'Claude is busy right now. Try again in a minute.',
    }[status] || 'The Claude API returned an error.';
    throw new Error(`${hint} (${status}: ${detail})`);
  }

  /**
   * One Claude Messages API call. In the desktop client the desktop app makes it with the saved key
   * (apiKey, when given, is a typed key being tested).
   */
  async function apCall(apiKey, body) {
    if (DESKTOP) {
      const r = (await desktopCall('claude', body, apiKey || '')) || { ok: false, status: 0 };
      if (!r.status) {
        throw new Error(
          r.aborted
            ? 'Claude took more than 2 minutes to answer. Try again, or pick a faster model in Settings.'
            : 'The desktop app could not reach api.anthropic.com. Check the internet connection and any proxy or firewall.',
        );
      }
      return apCheck(r.ok === true, r.status, r.data);
    }
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 120000) : null;
    let response;
    try {
      response = await window.fetch(AP_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': AP_VERSION,
          'anthropic-dangerous-direct-browser-access': 'true',
        },
        body: JSON.stringify(body),
        signal: controller ? controller.signal : undefined,
      });
    } catch (e) {
      throw new Error(
        e && e.name === 'AbortError'
          ? 'Claude took more than 2 minutes to answer. Try again, or pick a faster model in Settings.'
          : 'Could not reach api.anthropic.com from this browser. Check the internet connection, and whether a proxy, firewall or the page security policy blocks it.',
      );
    } finally {
      if (timer) {
        clearTimeout(timer);
      }
    }
    let data = null;
    try {
      data = await response.json();
    } catch {
      data = null;
    }
    return apCheck(response.ok, response.status, data);
  }

  async function apAsk(app, history, text) {
    const settings = apRead();
    if (!apKeyStatus(settings).hasKey) {
      throw new Error('Add your Claude API key in Auto Pilot settings first.');
    }
    const messages = apTrim(Array.isArray(history) ? history : []);
    messages.push({ role: 'user', content: String(text) });
    const used = [];
    const usage = { input: 0, output: 0 };
    let changed = false;
    let answer = '';
    let note = '';

    for (let round = 1; round <= AP_MAX_ROUNDS; round++) {
      const body = { model: settings.model, max_tokens: AP_MAX_TOKENS, system: apSystemPrompt(settings.useData), messages };
      if (settings.useData) {
        body.tools = AP_TOOLS;
      }
      const data = await apCall(settings.apiKey, body);
      usage.input += (data.usage && data.usage.input_tokens) || 0;
      usage.output += (data.usage && data.usage.output_tokens) || 0;
      const content = Array.isArray(data.content) ? data.content : [];
      const text = content.filter((b) => b.type === 'text').map((b) => b.text).join('\n\n').trim();
      if (text) {
        answer = text;
      }
      if (data.stop_reason !== 'tool_use') {
        messages.push({ role: 'assistant', content });
        if (data.stop_reason === 'max_tokens') note = 'The answer was cut off at the length limit. Ask me to continue.';
        if (data.stop_reason === 'refusal') note = 'Claude declined to answer this one.';
        break;
      }
      if (round === AP_MAX_ROUNDS) {
        // Don't keep an unanswered tool call in the history: the next question would fail.
        note = 'I stopped after several lookups. Try a narrower question.';
        break;
      }
      messages.push({ role: 'assistant', content });
      const results = content
        .filter((b) => b.type === 'tool_use')
        .map((b) => {
          let out;
          try {
            out = apRunTool(app, b.name, b.input);
          } catch (e) {
            out = { error: e && e.message ? e.message : String(e) };
          }
          if (b.name === 'create_draft_request' && out && out.created) {
            changed = true;
          }
          used.push({ id: `t${used.length}`, summary: apToolSummary(b.name, b.input, out) });
          const result = { type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out) };
          if (out && out.error) {
            result.is_error = true;
          }
          return result;
        });
      messages.push({ role: 'user', content: results });
    }

    return {
      history: messages,
      text: [answer || 'No answer text came back.', note ? `*${note}*` : ''].filter(Boolean).join('\n\n'),
      tools: used,
      changed,
      model: settings.model,
      modelLabel: apModelLabel(settings.model),
      usage,
    };
  }

  /* ---------- Markdown answer > blocks the page can render safely (no innerHTML) ---------- */

  function apPlain(text) {
    return String(text || '')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)')
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*\s][^*]*)\*/g, '$1')
      .replace(/`([^`]+)`/g, '$1');
  }

  function apInline(text) {
    const source = String(text || '').replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
    const segments = [];
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\*[^*\s][^*]*\*)/g;
    let last = 0;
    let m = re.exec(source);
    while (m) {
      if (m.index > last) {
        segments.push({ id: `s${segments.length}`, text: source.slice(last, m.index), cls: '' });
      }
      const token = m[0];
      let seg;
      if (token.startsWith('**')) {
        seg = { text: token.slice(2, -2), cls: 'mx-ap-b' };
      } else if (token.startsWith('`')) {
        seg = { text: token.slice(1, -1), cls: 'mx-ap-code' };
      } else {
        seg = { text: token.slice(1, -1), cls: 'mx-ap-i' };
      }
      segments.push(Object.assign({ id: `s${segments.length}` }, seg));
      last = m.index + token.length;
      m = re.exec(source);
    }
    if (last < source.length) {
      segments.push({ id: `s${segments.length}`, text: source.slice(last), cls: '' });
    }
    return segments;
  }

  function apBlocks(markdown) {
    const lines = String(markdown || '').replace(/\r\n/g, '\n').split('\n');
    const blocks = [];
    let para = [];
    const block = (type, extra) =>
      blocks.push(Object.assign({ id: `b${blocks.length}`, type, segments: [], text: '', rows: [], marker: '', indent: false }, extra));
    const flush = () => {
      if (para.length) {
        block('p', { segments: apInline(para.join(' ')) });
        para = [];
      }
    };
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      const t = line.trim();
      if (t.startsWith('```')) {
        flush();
        const code = [];
        i += 1;
        while (i < lines.length && !lines[i].trim().startsWith('```')) {
          code.push(lines[i]);
          i += 1;
        }
        i += 1;
        block('code', { text: code.join('\n') });
        continue;
      }
      if (!t || /^(-{3,}|\*{3,}|_{3,})$/.test(t)) {
        flush();
        i += 1;
        continue;
      }
      const heading = t.match(/^#{1,6}\s+(.*)$/);
      if (heading) {
        flush();
        block('h', { segments: apInline(heading[1]) });
        i += 1;
        continue;
      }
      if (t.startsWith('|')) {
        flush();
        const rows = [];
        while (i < lines.length && lines[i].trim().startsWith('|')) {
          const r = lines[i].trim();
          if (!/^\|[\s:|-]+\|?$/.test(r)) {
            const cells = r.replace(/^\|/, '').replace(/\|$/, '').split('|');
            rows.push({ id: `r${rows.length}`, head: rows.length === 0, cells: cells.map((c, ci) => ({ id: `c${ci}`, text: apPlain(c.trim()) })) });
          }
          i += 1;
        }
        block('table', { rows });
        continue;
      }
      const bullet = t.match(/^[-*•]\s+(.*)$/);
      const numbered = t.match(/^(\d+)[.)]\s+(.*)$/);
      if (bullet || numbered) {
        flush();
        block('li', {
          marker: bullet ? '•' : `${numbered[1]}.`,
          segments: apInline(bullet ? bullet[1] : numbered[2]),
          indent: line.search(/\S/) >= 2,
        });
        i += 1;
        continue;
      }
      para.push(t.replace(/^>\s?/, ''));
      i += 1;
    }
    flush();
    return blocks;
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
      const c = {
        openRequests: s.requests.filter((r) => ['Pending approval', 'Approved', 'In progress'].includes(r.status)).length,
        drafts: s.requests.filter((r) => r.status === 'Draft').length,
        pending: pending.length,
        inboxByRole,
        workOrdersActive: s.workOrders.filter((w) => w.status !== 'Completed').length,
        equipmentDown: s.equipment.filter((e) => e.status === 'Down').length,
      };
      // Every chain calls this after it changes data: the shell header and the desktop badge follow.
      shellEvent('mxcounts', clone(c));
      desktopCall('setCounts', { pending: c.pending, drafts: c.drafts, equipmentDown: c.equipmentDown, workOrdersActive: c.workOrdersActive });
      return c;
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
      ].map((k) => Object.assign(k, { title: k.label, metric: k.value, meta: k.sub })); // title/metric/meta: oj-sp-scoreboard

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
            badge: 'Critical',
            label: r.id,
            title: r.title,
            text: `Waiting for the ${step ? roleText(step.role) : 'approver'}`,
            flow: 'inbox',
            page: '',
            requestId: '',
          });
        });
      down.forEach((e) => {
        const req = reqs.find((r) => r.equipmentId === e.id && ['Pending approval', 'Approved', 'In progress'].includes(r.status));
        attention.push({
          id: `d-${e.id}`,
          tone: 'danger',
          badge: 'Down',
          label: e.id,
          title: `${e.name} is down`,
          text: req ? `${req.id} is ${req.status.toLowerCase()}` : 'No request raised yet',
          flow: req ? 'requests' : 'equipment',
          page: '',
          requestId: req ? req.id : '',
        });
      });
      eqs
        .filter((e) => e.pmDays < 0)
        .forEach((e) => {
          attention.push({
            id: `p-${e.id}`,
            tone: 'warn',
            badge: 'PM overdue',
            label: e.id,
            title: e.name,
            text: `Preventive maintenance was due ${-e.pmDays} ${e.pmDays === -1 ? 'day' : 'days'} ago`,
            flow: 'equipment',
            page: '',
            requestId: '',
          });
        });
      const draftCount = reqs.filter((r) => r.status === 'Draft').length;
      if (draftCount) {
        attention.push({
          id: 'drafts',
          tone: 'info',
          badge: 'Drafts',
          label: 'Your requests',
          title: `${draftCount} draft ${draftCount === 1 ? 'request' : 'requests'} not sent`,
          text: 'Send them for approval',
          flow: 'requests',
          page: 'send-approval',
          requestId: '',
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

      // Extra datasets for the dashboard panels behind each KPI.
      const approverPoints = ROLES.map((role) => ({
        id: role.id,
        series: 'Waiting',
        group: role.role,
        value: pending.filter((r) => (waitingStep(r) || {}).roleId === role.id).length,
        color: '#c68a1d',
      }));

      const waitingLongest = pending
        .map((r) => {
          const step = waitingStep(r);
          return {
            id: r.id,
            title: r.title,
            priority: r.priority,
            waitingFor: step ? `${step.name} (${step.role})` : '',
            ageDays: Math.max(0, -dayDiff(r.requestedOn)),
          };
        })
        .sort((a, b) => b.ageDays - a.ageDays)
        .slice(0, 6);

      const healthPoints = health.map((h) => ({
        id: h.key,
        series: 'Average health',
        group: h.category,
        value: h.avg,
        color: h.tone === 'danger' ? '#c74634' : h.tone === 'warn' ? '#d99a3d' : '#4c825c',
      }));

      const downList = down.map((e) => {
        const req = reqs.find((r) => r.equipmentId === e.id && ['Draft', 'Pending approval', 'Approved', 'In progress'].includes(r.status));
        return {
          id: e.id,
          name: e.name,
          location: e.location,
          text: req ? `${req.id} · ${req.status}` : 'No request raised yet',
        };
      });

      const WO_COLORS = { Scheduled: '#2e7d99', 'In progress': '#4f64a8', Completed: '#4c825c' };
      const woPoints = ['Scheduled', 'In progress', 'Completed'].map((st) => ({
        id: st,
        series: st,
        group: 'Work orders',
        value: s.workOrders.filter((w) => w.status === st).length,
        color: WO_COLORS[st],
      }));
      const woActive = s.workOrders
        .filter((w) => w.status === 'In progress')
        .slice(0, 6)
        .map((w) => ({ id: w.id, title: w.title, equipmentName: w.equipmentName, technician: w.technician, progress: w.progress }));

      const overduePm = eqs
        .filter((e) => e.pmDays < 0)
        .sort((a, b) => a.pmDays - b.pmDays)
        .map((e) => ({ id: e.id, name: e.name, location: e.location, when: `due ${relDays(e.nextPm)}` }));

      return {
        kpis,
        statusPoints,
        weeklyPoints,
        totalRequests: reqs.length,
        health,
        healthPoints,
        attention: attention.slice(0, 6),
        upcomingPm,
        overduePm,
        recent,
        approverPoints,
        waitingLongest,
        downList,
        woPoints,
        woActive,
        totalWorkOrders: s.workOrders.length,
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

    /* ---------- Workflow view ---------- */

    /**
     * The flow of one request, step by step, for the workflow diagram.
     * Each node: id, kind (start|step|approval|skip|end), label, sub, whenText, state
     * (done|current|pending|rejected|skipped|cancelled), stateLabel, comment, branch.
     */
    requestWorkflow(id) {
      const req = findRequest(id);
      return req ? buildWorkflow(req) : [];
    }

    /** One line that says where the request is now. */
    workflowHeadline(nodes) {
      const list = nodes || [];
      const rejected = list.find((n) => n.state === 'rejected');
      if (rejected) {
        return `Stopped at: ${rejected.label}`;
      }
      const current = list.find((n) => n.state === 'current');
      if (current) {
        return `Now: ${current.label}`;
      }
      const last = list[list.length - 1];
      return last && last.state === 'done' ? 'Finished' : 'Not started';
    }

    /* ---------- Auto Pilot (Claude) ---------- */

    autopilotModels() {
      return clone(AP_MODELS);
    }

    autopilotSuggestions() {
      return AP_SUGGESTIONS.map((prompt, i) => ({ id: `q${i}`, prompt }));
    }

    /** What the UI may show: never the key itself, only a hint of it. */
    autopilotSettings() {
      const s = apRead();
      const k = apKeyStatus(s);
      return {
        hasKey: k.hasKey,
        keyHint: k.keyHint,
        model: s.model,
        modelLabel: apModelLabel(s.model),
        remember: s.remember !== false,
        useData: s.useData !== false,
        desktop: !!DESKTOP,
        keyStore: DESKTOP ? (k.secure ? k.store : 'memory until the app closes (this computer has no secure storage)') : 'this browser',
      };
    }

    /** Values for the settings dialog. The key field starts empty: leave it empty to keep the saved key. */
    autopilotForm() {
      const s = apRead();
      return { apiKey: '', model: s.model, remember: s.remember !== false, useData: s.useData !== false };
    }

    saveAutopilotSettings(form) {
      const current = apRead();
      const f = form || {};
      const typed = String(f.apiKey || '').trim();
      if (DESKTOP && typed) {
        desktopCall('saveKey', typed);
      }
      apWrite({
        apiKey: DESKTOP ? '' : typed || current.apiKey,
        model: AP_MODELS.some((m) => m.value === f.model) ? f.model : current.model,
        remember: DESKTOP ? true : f.remember !== false,
        useData: f.useData !== false,
      });
    }

    removeAutopilotKey() {
      const current = apRead();
      apWrite(Object.assign({}, current, { apiKey: '' }));
      apSessionKey = '';
      desktopCall('removeKey');
    }

    /** Sends a tiny request to check the key and model. Uses the typed key when there is one. */
    async testAutopilot(form) {
      const current = apRead();
      const f = form || {};
      const typed = String(f.apiKey || '').trim();
      const key = typed || current.apiKey;
      const model = AP_MODELS.some((m) => m.value === f.model) ? f.model : current.model;
      if (!key && !(DESKTOP && apKeyStatus(current).hasKey)) {
        return { ok: false, message: 'Enter your Claude API key first.' };
      }
      try {
        await apCall(key, { model, max_tokens: 16, messages: [{ role: 'user', content: 'Reply with the single word OK.' }] });
        return { ok: true, message: `Connected. ${apModelLabel(model)} answered.` };
      } catch (e) {
        return { ok: false, message: e && e.message ? e.message : String(e) };
      }
    }

    /**
     * Asks Claude. `history` is the API conversation so far (kept by the shell page).
     * Returns { history, blocks, tools, changed, modelLabel, usage }; throws with a readable message.
     */
    async askAutopilot(history, text) {
      const result = await apAsk(new AppModule(), history, text);
      return Object.assign(result, { blocks: apBlocks(result.text) });
    }

    /** Markdown text to blocks for display (also used for notes and errors). */
    autopilotBlocks(text) {
      return apBlocks(text);
    }

    /** Opens Auto Pilot from any page and, with a prompt, asks it straight away. */
    openAutopilot(prompt) {
      return shellEvent('mxask', { prompt: typeof prompt === 'string' ? prompt : '' });
    }

    /* ---------- Desktop client ---------- */

    /** { isDesktop, version, platform, source } - isDesktop is false in a browser. */
    desktopInfo() {
      if (!DESKTOP) {
        return { isDesktop: false, version: '', platform: '', source: '' };
      }
      const i = desktopCall('info') || {};
      return { isDesktop: true, version: String(i.version || ''), platform: String(i.platform || ''), source: String(i.source || '') };
    }

    /** The version badge in the header: { version, label, title }. In the desktop app, the installed version. */
    appVersion() {
      const i = DESKTOP ? desktopCall('info') || {} : {};
      const version = String((DESKTOP && i.version) || APP_VERSION);
      return {
        version,
        label: `v${version}`,
        title: DESKTOP ? `Maintenance desktop app ${version}. Help > Check for updates looks for a newer one.` : `Maintenance ${version}`,
      };
    }

    /** Where to download the desktop app: the Windows installer, or the releases page on other systems. */
    desktopDownload() {
      const nav = typeof navigator !== 'undefined' ? navigator : {};
      const platform = String((nav.userAgentData && nav.userAgentData.platform) || nav.platform || nav.userAgent || '');
      const isWindows = /win/i.test(platform);
      return { isWindows, url: isWindows ? DESKTOP_SETUP : DESKTOP_RELEASES, file: 'Maintenance-Setup.exe', releases: DESKTOP_RELEASES };
    }

    /** A desktop notification, shown only while the desktop app is in the background. No-op in a browser. */
    notifyDesktop(title, markdown, command) {
      if (!DESKTOP) {
        return false;
      }
      const text = String(markdown || '')
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/^\s*#{1,6}\s+/gm, '')
        .replace(/^\s*[-*•]\s+/gm, '')
        .replace(/^\s*\|.*\|\s*$/gm, ' ');
      const body = apPlain(text).replace(/\s+/g, ' ').trim();
      desktopCall('notify', {
        title: String(title || 'Maintenance'),
        body: body.length > 160 ? `${body.slice(0, 157)}…` : body,
        command: command || null,
        onlyWhenUnfocused: true,
      });
      return true;
    }

    /* ---------- Messages (shell toasts) ---------- */

    /** A toast. Chains assign it to $application.variables.messages; the shell also gets it through #mxBridge. */
    message(severity, summary, detail, timeoutMs) {
      const toast = [
        {
          severity: severity || 'confirmation',
          summary: summary || '',
          detail: detail || '',
          autoTimeout: timeoutMs || 5000,
          closeAffordance: 'defaults',
        },
      ];
      shellEvent('mxtoast', clone(toast));
      return toast;
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

    /** Redwood badge classes (JET oj-badge) for a request, work order or approval step status. */
    badgeClass(status) {
      const variant = {
        'Pending approval': 'warning',
        Waiting: 'warning',
        Approved: 'info',
        Scheduled: 'info',
        'In progress': 'info',
        Completed: 'success',
        Rejected: 'danger',
      }[status];
      return `oj-badge oj-badge-subtle${variant ? ` oj-badge-${variant}` : ''}`;
    }

    /** Redwood badge classes for a priority: only High and Critical stand out. */
    priorityBadgeClass(priority) {
      const variant = { Critical: 'danger', High: 'warning' }[priority];
      return `oj-badge${variant ? ` oj-badge-${variant}` : ' oj-badge-subtle'}`;
    }

    /** Redwood badge classes for an equipment status. */
    equipmentBadgeClass(status) {
      const variant = { Running: 'success', Maintenance: 'warning', Down: 'danger' }[status];
      return `oj-badge oj-badge-subtle${variant ? ` oj-badge-${variant}` : ''}`;
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
