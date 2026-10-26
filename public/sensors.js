/* Comprehensive IoT Sensor & Actuator Suite for ESP32, Arduino Uno, Raspberry Pi 4, and Jetson Nano */
(() => {
  'use strict';

  const safe = v => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Catalog of all sensors & actuators (including upgraded DHT22 plus 12 additional sensors/actuators)
  const CATALOG = {
    ultrasonic: {
      type: 'ultrasonic',
      title: 'HC-SR04 Ultrasonik',
      icon: 'fa-wave-square',
      color: '#38bdf8',
      headerBg: '#0c4a6e',
      defaultVal: '120',
      min: 2, max: 400, step: 1,
      unit: 'cm',
      label: 'Jarak Objek',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'trig', label: 'TRIG', cls: 'text-yellow-300' },
        { id: 'echo', label: 'ECHO', cls: 'text-cyan-300' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: () => `<div class="ultrasonic-eyes"><div class="ultrasonic-eye"></div><div class="ultrasonic-eye"></div></div><span class="lab-sensor-badge">HC-SR04</span>`,
      formatReadout: val => {
        const cm = Number(val) || 0;
        return `${cm} cm (${Math.round(cm * 58)} µs)`;
      },
      // Returns analog (0-4095), digital (0/1), and pulseUs for pulseIn()
      compute: val => {
        const cm = Math.max(2, Math.min(400, Number(val) || 120));
        return {
          distanceCm: cm,
          pulseUs: Math.round(cm * 58),
          analog: Math.round((cm / 400) * 4095),
          digital: cm < 50 ? 1 : 0
        };
      }
    },

    pir: {
      type: 'pir',
      title: 'PIR HC-SR501 Gerak',
      icon: 'fa-running',
      color: '#f97316',
      headerBg: '#7c2d12',
      defaultVal: '0',
      isToggle: true,
      toggleLabelOff: 'Tidak Ada Gerakan (LOW)',
      toggleLabelOn: 'Gerakan Terdeteksi! (HIGH)',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'out', label: 'OUT', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => `<div class="pir-dome ${Number(val) ? 'motion' : ''}"></div><span class="lab-sensor-badge">PIR</span>`,
      formatReadout: val => (Number(val) ? 'GERAKAN: HIGH (1)' : 'AMAN: LOW (0)'),
      compute: val => {
        const active = Number(val) ? 1 : 0;
        return { digital: active, analog: active ? 4095 : 0 };
      }
    },

    soil: {
      type: 'soil',
      title: 'Kelembaban Tanah',
      icon: 'fa-seedling',
      color: '#eab308',
      headerBg: '#713f12',
      defaultVal: '65',
      min: 0, max: 100, step: 1,
      unit: '%',
      label: 'Kelembaban',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'ao', label: 'AO', cls: 'text-blue-300' },
        { id: 'do', label: 'DO', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: () => `<div class="soil-probes"><div class="soil-prong"></div><div class="soil-prong"></div></div><span class="lab-sensor-badge">YL-69</span>`,
      formatReadout: val => {
        const pct = Number(val) || 0;
        return `${pct}% (${pct < 40 ? 'Kering' : 'Lembab'})`;
      },
      compute: val => {
        const pct = Math.max(0, Math.min(100, Number(val) || 0));
        return {
          moisture: pct,
          analog: Math.round((pct / 100) * 4095),
          digital: pct < 40 ? 1 : 0
        };
      }
    },

    mq2: {
      type: 'mq2',
      title: 'Sensor Gas & Asap MQ-2',
      icon: 'fa-smog',
      color: '#a855f7',
      headerBg: '#4c1d95',
      defaultVal: '250',
      min: 50, max: 2000, step: 10,
      unit: 'ppm',
      label: 'Kadar Gas',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'ao', label: 'AO', cls: 'text-blue-300' },
        { id: 'do', label: 'DO', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => `<div class="mq2-mesh ${Number(val) >= 600 ? 'alert' : ''}"></div><span class="lab-sensor-badge">MQ-2</span>`,
      formatReadout: val => {
        const ppm = Number(val) || 250;
        return `${ppm} ppm ${ppm >= 600 ? '⚠️ BAHAYA' : '(Normal)'}`;
      },
      compute: val => {
        const ppm = Math.max(50, Math.min(2000, Number(val) || 250));
        return {
          ppm,
          analog: Math.round(((ppm - 50) / 1950) * 4095),
          digital: ppm >= 600 ? 1 : 0
        };
      }
    },

    flame: {
      type: 'flame',
      title: 'Sensor Api KY-026',
      icon: 'fa-fire-flame-curved',
      color: '#ef4444',
      headerBg: '#7f1d1d',
      defaultVal: '20',
      min: 0, max: 100, step: 1,
      unit: '%',
      label: 'Intensitas Api',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'ao', label: 'AO', cls: 'text-blue-300' },
        { id: 'do', label: 'DO', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => `<i class="fas fa-fire text-4xl ${Number(val) >= 50 ? 'text-orange-500 animate-pulse' : 'text-slate-600'}"></i><span class="lab-sensor-badge">IR 760nm</span>`,
      formatReadout: val => {
        const v = Number(val) || 0;
        return `Api: ${v}% ${v >= 50 ? '🔥 TERDETEKSI' : '(Aman)'}`;
      },
      compute: val => {
        const v = Math.max(0, Math.min(100, Number(val) || 0));
        return {
          flame: v,
          analog: Math.round((v / 100) * 4095),
          digital: v >= 50 ? 1 : 0
        };
      }
    },

    rain: {
      type: 'rain',
      title: 'Sensor Hujan & Air',
      icon: 'fa-cloud-showers-heavy',
      color: '#3b82f6',
      headerBg: '#1e3a8a',
      defaultVal: '15',
      min: 0, max: 100, step: 1,
      unit: '%',
      label: 'Curah Air',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'ao', label: 'AO', cls: 'text-blue-300' },
        { id: 'do', label: 'DO', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => `<i class="fas fa-cloud-rain text-4xl ${Number(val) >= 50 ? 'text-sky-400' : 'text-slate-500'}"></i><span class="lab-sensor-badge">FC-37</span>`,
      formatReadout: val => {
        const v = Number(val) || 0;
        return `Air: ${v}% (${v >= 50 ? 'Hujan/Basah' : 'Kering'})`;
      },
      compute: val => {
        const v = Math.max(0, Math.min(100, Number(val) || 0));
        return {
          rain: v,
          analog: Math.round((v / 100) * 4095),
          digital: v >= 50 ? 1 : 0
        };
      }
    },

    sound: {
      type: 'sound',
      title: 'Sensor Suara KY-038',
      icon: 'fa-microphone-lines',
      color: '#ec4899',
      headerBg: '#831843',
      defaultVal: '45',
      min: 30, max: 120, step: 1,
      unit: 'dB',
      label: 'Level Suara',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'ao', label: 'AO', cls: 'text-blue-300' },
        { id: 'do', label: 'DO', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => `<i class="fas fa-microphone text-3xl ${Number(val) >= 75 ? 'text-pink-400' : 'text-slate-400'}"></i><span class="lab-sensor-badge">MIC</span>`,
      formatReadout: val => {
        const db = Number(val) || 45;
        return `${db} dB ${db >= 75 ? '(Bising/Tepuk)' : '(Tenang)'}`;
      },
      compute: val => {
        const db = Math.max(30, Math.min(120, Number(val) || 45));
        return {
          db,
          analog: Math.round(((db - 30) / 90) * 4095),
          digital: db >= 75 ? 1 : 0
        };
      }
    },

    ir_obstacle: {
      type: 'ir_obstacle',
      title: 'Sensor IR Halangan',
      icon: 'fa-satellite-dish',
      color: '#14b8a6',
      headerBg: '#134e4a',
      defaultVal: '0',
      isToggle: true,
      toggleLabelOff: 'Jalur Kosong (LOW)',
      toggleLabelOn: 'Objek Menghalangi! (HIGH)',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'out', label: 'OUT', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => `<div class="flex gap-3 items-center"><i class="fas fa-circle text-xl text-sky-300"></i><i class="fas fa-circle text-xl ${Number(val) ? 'text-red-500' : 'text-slate-700'}"></i></div><span class="lab-sensor-badge">FC-51</span>`,
      formatReadout: val => (Number(val) ? 'HALANGAN: HIGH (1)' : 'KOSONG: LOW (0)'),
      compute: val => {
        const active = Number(val) ? 1 : 0;
        return { digital: active, analog: active ? 4095 : 0 };
      }
    },

    ds18b20: {
      type: 'ds18b20',
      title: 'Suhu Air DS18B20',
      icon: 'fa-thermometer-half',
      color: '#06b6d4',
      headerBg: '#164e63',
      defaultVal: '28.5',
      min: -10, max: 125, step: 0.5,
      unit: '°C',
      label: 'Suhu Probe',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'dq', label: 'DQ', cls: 'text-yellow-300' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: () => `<i class="fas fa-temperature-low text-3xl text-cyan-400"></i><span class="lab-sensor-badge">1-Wire</span>`,
      formatReadout: val => `${Number(val).toFixed(1)} °C`,
      compute: val => {
        const temp = Math.max(-10, Math.min(125, Number(val) || 28.5));
        return {
          temperature: temp,
          analog: Math.round(((temp + 10) / 135) * 4095),
          digital: temp >= 35 ? 1 : 0
        };
      }
    },

    bmp280: {
      type: 'bmp280',
      title: 'Tekanan & Suhu BMP280',
      icon: 'fa-gauge-high',
      color: '#8b5cf6',
      headerBg: '#3b0764',
      defaultVal: '1013',
      min: 950, max: 1050, step: 1,
      unit: 'hPa',
      label: 'Tekanan Udara',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' },
        { id: 'sda', label: 'SDA', cls: 'text-blue-300' },
        { id: 'scl', label: 'SCL', cls: 'text-yellow-300' }
      ],
      visual: () => `<i class="fas fa-compass text-3xl text-purple-400"></i><span class="lab-sensor-badge">I2C 0x76</span>`,
      formatReadout: val => {
        const p = Number(val) || 1013;
        const alt = Math.round(44330 * (1 - Math.pow(p / 1013.25, 0.1903)));
        return `${p} hPa (~${alt} mdpl)`;
      },
      compute: val => {
        const p = Math.max(950, Math.min(1050, Number(val) || 1013));
        const altitude = Math.round(44330 * (1 - Math.pow(p / 1013.25, 0.1903)));
        return {
          pressure: p,
          altitude,
          temperature: 26.5,
          analog: Math.round(((p - 950) / 100) * 4095),
          digital: 1
        };
      }
    },

    servo: {
      type: 'servo',
      title: 'Motor Servo SG90',
      icon: 'fa-cogs',
      color: '#3b82f6',
      headerBg: '#1e3a8a',
      defaultVal: '90',
      min: 0, max: 180, step: 1,
      unit: '°',
      label: 'Sudut Servo',
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'pwm', label: 'PWM', cls: 'text-orange-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => {
        const deg = Number(val) || 90;
        return `<div class="servo-body-3d"><div class="servo-horn" style="transform:rotate(${deg - 90}deg)"></div></div><span class="lab-sensor-badge">SG90</span>`;
      },
      formatReadout: val => `Sudut: ${Math.round(Number(val) || 0)}°`,
      compute: val => {
        const angle = Math.max(0, Math.min(180, Number(val) || 0));
        return { angle, analog: Math.round((angle / 180) * 4095), digital: angle > 0 ? 1 : 0 };
      }
    },

    relay: {
      type: 'relay',
      title: 'Modul Relay 1-Ch',
      icon: 'fa-bolt',
      color: '#22c55e',
      headerBg: '#14532d',
      defaultVal: '0',
      isActuatorOnly: true,
      pins: [
        { id: 'vcc', label: 'VCC', cls: 'text-red-400' },
        { id: 'in', label: 'IN', cls: 'text-green-400' },
        { id: 'gnd', label: 'GND', cls: 'text-gray-400' }
      ],
      visual: val => `<div class="relay-box ${Number(val) ? 'on' : ''}"><span>RELAY 5V</span><div class="relay-led"></div></div><span class="lab-sensor-badge">10A 250V</span>`,
      formatReadout: val => (Number(val) ? 'KONTAK: TERTUTUP (ON)' : 'KONTAK: TERBUKA (OFF)'),
      compute: val => ({ state: Number(val) ? 1 : 0, digital: Number(val) ? 1 : 0, analog: Number(val) ? 4095 : 0 })
    }
  };

  function template(type, uid) {
    const id = safe(uid);
    const item = CATALOG[type];
    if (!item) return '';

    const val = item.defaultVal;
    const pinsHtml = item.pins.map(p => `
      <div class="lab-sensor-pin-col">
        <span class="pin-label ${p.cls}">${p.label}</span>
        <div class="pin" data-pin-id="${type}_${p.id}_${id}" data-pin-name="${p.id}"></div>
      </div>`).join('');

    let controlHtml = '';
    if (item.isToggle) {
      controlHtml = `<button type="button" class="lab-sensor-toggle ignore-drag" data-sensor-toggle="${id}">${item.toggleLabelOff}</button>`;
    } else if (!item.isActuatorOnly) {
      controlHtml = `
        <div class="lab-sensor-controls">
          <label><span>${item.label}</span><span data-sensor-unit="${id}">${val} ${item.unit}</span></label>
          <input type="range" class="slider-control ignore-drag" data-sensor-slider="${id}" min="${item.min}" max="${item.max}" step="${item.step}" value="${val}">
        </div>`;
    }

    return `
      <div class="btn-delete-comp"><i class="fas fa-times"></i></div>
      <div class="component-header" style="background:${item.headerBg};border-bottom:1px solid ${item.color};">
        <i class="fas ${item.icon}" style="color:${item.color}"></i> ${item.title}
      </div>
      <div class="lab-sensor-card" data-sensor-card="${id}">
        <div class="lab-sensor-visual" data-sensor-vis="${id}">${item.visual(val)}</div>
        <div class="lab-sensor-readout" data-sensor-readout="${id}">${item.formatReadout(val)}</div>
        ${controlHtml}
        <div class="lab-sensor-pins">${pinsHtml}</div>
      </div>`;
  }

  function configure(component, rawValue) {
    if (!component) return;
    const type = component.getAttribute('data-type');
    // Upgraded dual-parameter DHT22 (Temperature °C & Humidity %)
    if (type === 'dht22') {
      configureDHT22(component, rawValue);
      return;
    }
    const item = CATALOG[type];
    if (!item) return;

    const val = (rawValue !== null && rawValue !== undefined && rawValue !== '') ? String(rawValue) : item.defaultVal;
    component.setAttribute('data-value', val);

    const vis = component.querySelector('[data-sensor-vis]');
    if (vis) vis.innerHTML = item.visual(val);

    const readout = component.querySelector('[data-sensor-readout]');
    if (readout) readout.textContent = item.formatReadout(val);

    const unitSpan = component.querySelector('[data-sensor-unit]');
    if (unitSpan) unitSpan.textContent = `${val} ${item.unit || ''}`;

    const slider = component.querySelector('input[type="range"]');
    if (slider && slider.value !== val) slider.value = val;

    const toggle = component.querySelector('.lab-sensor-toggle');
    if (toggle) {
      const on = Number(val) === 1;
      toggle.classList.toggle('active', on);
      toggle.textContent = on ? item.toggleLabelOn : item.toggleLabelOff;
    }
  }

  function parseDHT22(rawValue) {
    if (typeof rawValue === 'string' && rawValue.includes(':')) {
      const [t, h] = rawValue.split(':').map(Number);
      return {
        temp: Number.isFinite(t) ? t : 28,
        hum: Number.isFinite(h) ? h : 65
      };
    }
    const num = Number(rawValue);
    if (Number.isFinite(num) && rawValue !== null && rawValue !== '') {
      return { temp: 28, hum: Math.max(0, Math.min(100, num)) };
    }
    return { temp: 28, hum: 65 };
  }

  function configureDHT22(component, rawValue) {
    const { temp, hum } = parseDHT22(rawValue ?? component.getAttribute('data-value'));
    const encoded = `${temp}:${hum}`;
    component.setAttribute('data-value', encoded);

    const body = component.querySelector('.dht-body');
    if (body && !body.dataset.upgradedDht) {
      body.dataset.upgradedDht = 'true';
      body.innerHTML = `
        <div style="font:700 10px monospace;margin-bottom:4px;" data-dht-readout>${temp.toFixed(1)}°C · ${hum}% RH</div>
        <label style="display:flex;justify-content:space-between;font-size:9px;"><span>Suhu</span><span>${temp}°C</span></label>
        <input type="range" class="slider-control ignore-drag" data-dht-temp min="-10" max="60" step="0.5" value="${temp}">
        <label style="display:flex;justify-content:space-between;font-size:9px;margin-top:3px;"><span>Lembab</span><span>${hum}%</span></label>
        <input type="range" class="slider-control ignore-drag" data-dht-hum min="0" max="100" step="1" value="${hum}">
      `;
    } else if (body) {
      const r = body.querySelector('[data-dht-readout]');
      if (r) r.textContent = `${temp.toFixed(1)}°C · ${hum}% RH`;
      const tInput = body.querySelector('[data-dht-temp]');
      const hInput = body.querySelector('[data-dht-hum]');
      if (tInput) {
        tInput.value = temp;
        if (tInput.previousElementSibling?.lastElementChild) tInput.previousElementSibling.lastElementChild.textContent = `${temp}°C`;
      }
      if (hInput) {
        hInput.value = hum;
        if (hInput.previousElementSibling?.lastElementChild) hInput.previousElementSibling.lastElementChild.textContent = `${hum}%`;
      }
    }
  }

  // Evaluate all connected sensors & actuators on the workspace and populate state.hw
  function evaluate(state, rootDoc) {
    const doc = rootDoc || (typeof document !== 'undefined' ? document : null);
    if (!state || !state.hw) return;
    if (!state.hw.pins) state.hw.pins = {};
    if (!state.hw.digitalInput) state.hw.digitalInput = {};
    if (!state.hw.analog) state.hw.analog = {};
    if (!state.hw.sensors) state.hw.sensors = {};
    if (!state.hw.pulseIn) state.hw.pulseIn = {};
    if (!state.hw.dht) state.hw.dht = { temperature: 28, humidity: 65 };
    if (!state.hw.i2c) state.hw.i2c = { temperature: 26.5, pressure: 1013, altitude: 0 };
    if (!state.hw.servos) state.hw.servos = {};

    if (!doc || typeof doc.querySelectorAll !== 'function') return;

    const wires = state.wires || [];

    // Helper: find all MCU pin names connected to a given component pin id
    function connectedMcuPins(compPinId) {
      const result = [];
      for (const w of wires) {
        if (!w.pin1 || !w.pin2) continue;
        const id1 = w.pin1.getAttribute('data-pin-id');
        const id2 = w.pin2.getAttribute('data-pin-id');
        if (id1 === compPinId) {
          const name = w.pin2.getAttribute('data-pin-name');
          if (name) result.push(name);
        } else if (id2 === compPinId) {
          const name = w.pin1.getAttribute('data-pin-name');
          if (name) result.push(name);
        }
      }
      return result;
    }

    function setDigitalInputPin(pin, val) {
      state.hw.digitalInput[pin] = val;
      if (state.hw.pinModes?.[pin] !== 1) {
        state.hw.pins[pin] = val;
      }
    }

    // 1. Evaluate DHT22
    doc.querySelectorAll('.component[data-type="dht22"]').forEach(comp => {
      const uid = comp.getAttribute('data-uid');
      const { temp, hum } = parseDHT22(comp.getAttribute('data-value'));
      configureDHT22(comp, `${temp}:${hum}`);
      state.hw.dht = { temperature: temp, humidity: hum };
      const datPins = connectedMcuPins(`dht_dat_${uid}`);
      for (const pin of datPins) {
        state.hw.analog[pin] = Math.round((hum / 100) * 4095);
        setDigitalInputPin(pin, hum >= 50 ? 1 : 0);
        state.hw.sensors[pin] = { type: 'dht22', temperature: temp, humidity: hum };
      }
    });

    // 2. Evaluate all catalog sensors & actuators
    for (const type of Object.keys(CATALOG)) {
      const item = CATALOG[type];
      doc.querySelectorAll(`.component[data-type="${type}"]`).forEach(comp => {
        const uid = comp.getAttribute('data-uid');
        const rawVal = comp.getAttribute('data-value') ?? item.defaultVal;
        const data = item.compute(rawVal);

        if (type === 'ultrasonic') {
          configure(comp, rawVal);
          const echoPins = connectedMcuPins(`ultrasonic_echo_${uid}`);
          const trigPins = connectedMcuPins(`ultrasonic_trig_${uid}`);
          for (const p of [...echoPins, ...trigPins]) {
            state.hw.pulseIn[p] = data.pulseUs;
            state.hw.analog[p] = data.analog;
            setDigitalInputPin(p, data.digital);
            state.hw.sensors[p] = { type, ...data };
          }
        } else if (type === 'bmp280') {
          configure(comp, rawVal);
          state.hw.i2c = { temperature: data.temperature, pressure: data.pressure, altitude: data.altitude };
          const sdaPins = connectedMcuPins(`bmp280_sda_${uid}`);
          for (const p of sdaPins) {
            state.hw.analog[p] = data.analog;
            state.hw.sensors[p] = { type, ...data };
          }
        } else if (type === 'servo') {
          const pwmPins = connectedMcuPins(`servo_pwm_${uid}`);
          let updated = false;
          for (const p of pwmPins) {
            if (state.hw.servos[p] !== undefined) {
              configure(comp, state.hw.servos[p]);
              updated = true;
            } else if (state.hw.pins[p] !== undefined) {
              const deg = state.hw.pins[p] === 1 ? 180 : 0;
              configure(comp, deg);
              updated = true;
            }
          }
          if (!updated) configure(comp, rawVal);
        } else if (type === 'relay') {
          const inPins = connectedMcuPins(`relay_in_${uid}`);
          const vccPins = connectedMcuPins(`relay_vcc_${uid}`);
          const gndPins = connectedMcuPins(`relay_gnd_${uid}`);
          const hasVcc = vccPins.length === 0 || vccPins.some(p => state.hw.pins[p] === 1);
          const hasGnd = gndPins.length === 0 || gndPins.some(p => state.hw.pins[p] === 0);
          const active = hasVcc && hasGnd && inPins.some(p => state.hw.pins[p] === 1);
          configure(comp, active ? '1' : '0');
        } else {
          // Standard AO / DO / OUT / DQ sensors (PIR, Soil, MQ-2, Flame, Rain, Sound, IR, DS18B20)
          configure(comp, rawVal);
          for (const pinDef of item.pins) {
            if (pinDef.id === 'vcc' || pinDef.id === 'gnd') continue;
            const mcuPins = connectedMcuPins(`${type}_${pinDef.id}_${uid}`);
            for (const p of mcuPins) {
              state.hw.analog[p] = data.analog;
              setDigitalInputPin(p, data.digital);
              state.hw.sensors[p] = { type, ...data };
            }
          }
        }
      });
    }
  }

  // Install runtime helper APIs onto window for Arduino C++ and Raspberry Pi / Jetson Python
  function installRuntimeAPIs(win, getState, triggerEvaluate) {
    win.sys_pulseIn = function (pin) {
      const st = getState();
      const key = String(pin);
      if (st?.hw?.pulseIn?.[key] !== undefined) return st.hw.pulseIn[key];
      const anyPulse = Object.values(st?.hw?.pulseIn || {})[0];
      return anyPulse !== undefined ? anyPulse : 0;
    };

    win.sys_readUltrasonicCm = function (trigPin, echoPin) {
      const st = getState();
      const us = win.sys_pulseIn(echoPin !== undefined ? echoPin : trigPin);
      if (us > 0) return Math.round(us / 58);
      return st?.hw?.sensors?.[String(echoPin || trigPin)]?.distanceCm ?? 120;
    };

    win.sys_dht_readTemperature = function (pin) {
      const st = getState();
      if (pin !== undefined && st?.hw?.sensors?.[String(pin)]?.temperature !== undefined) {
        return st.hw.sensors[String(pin)].temperature;
      }
      return st?.hw?.dht?.temperature ?? 28.0;
    };

    win.sys_dht_readHumidity = function (pin) {
      const st = getState();
      if (pin !== undefined && st?.hw?.sensors?.[String(pin)]?.humidity !== undefined) {
        return st.hw.sensors[String(pin)].humidity;
      }
      return st?.hw?.dht?.humidity ?? 65.0;
    };

    win.sys_ds18b20_readTempC = function (pin) {
      const st = getState();
      if (pin !== undefined && st?.hw?.sensors?.[String(pin)]?.temperature !== undefined) {
        return st.hw.sensors[String(pin)].temperature;
      }
      const ds = Object.values(st?.hw?.sensors || {}).find(s => s.type === 'ds18b20');
      return ds ? ds.temperature : 28.5;
    };

    win.sys_bmp280_readTemperature = function () {
      const st = getState();
      return st?.hw?.i2c?.temperature ?? 26.5;
    };

    win.sys_bmp280_readPressure = function () {
      const st = getState();
      return st?.hw?.i2c?.pressure ?? 1013;
    };

    win.sys_bmp280_readAltitude = function () {
      const st = getState();
      return st?.hw?.i2c?.altitude ?? 0;
    };

    win.sys_servo_attach = function (pin) {
      const st = getState();
      if (!st.hw.servos) st.hw.servos = {};
      st.hw.servos._attachedPin = String(pin);
    };

    win.sys_servo_write = function (pinOrAngle, maybeAngle) {
      const st = getState();
      if (!st.hw.servos) st.hw.servos = {};
      const angle = maybeAngle !== undefined ? Number(maybeAngle) : Number(pinOrAngle);
      const pin = maybeAngle !== undefined ? String(pinOrAngle) : (st.hw.servos._attachedPin || 'default');
      const clamped = Math.max(0, Math.min(180, Number.isFinite(angle) ? angle : 90));
      st.hw.servos[pin] = clamped;
      if (typeof document !== 'undefined') {
        document.querySelectorAll('.component[data-type="servo"]').forEach(comp => configure(comp, clamped));
      }
      if (triggerEvaluate) triggerEvaluate();
    };
  }

  // Transpile additional Arduino C++ sensor calls (pulseIn, DHT, Servo, BMP280, DS18B20)
  function transpileArduinoSensors(js) {
    let out = js;
    // Strip sensor library declarations
    out = out.replace(/#\s*include\s*[<"].*?[>"]/g, '');
    out = out.replace(/\bDHT\s+(\w+)\s*\((.*?),\s*(.*?)\)\s*;/g, 'const $1_pin = $2;');
    out = out.replace(/\bServo\s+(\w+)\s*;/g, 'const $1 = {};');
    out = out.replace(/\bAdafruit_BMP280\s+(\w+)\s*;/g, 'const $1 = {};');
    out = out.replace(/\b(?:OneWire|DallasTemperature)\s+\w+\s*\(.*?\)\s*;/g, '');

    // Method calls
    out = out.replace(/\bpulseIn\s*\(\s*(.*?)\s*,\s*(.*?)(?:\s*,\s*.*?)?\)/g, 'window.sys_pulseIn($1)');
    out = out.replace(/\b(\w+)\.readTemperature\s*\(\s*\)/g, 'window.sys_dht_readTemperature()');
    out = out.replace(/\b(\w+)\.readHumidity\s*\(\s*\)/g, 'window.sys_dht_readHumidity()');
    out = out.replace(/\b(\w+)\.readPressure\s*\(\s*\)/g, 'window.sys_bmp280_readPressure()');
    out = out.replace(/\b(\w+)\.readAltitude\s*\(.*?\)/g, 'window.sys_bmp280_readAltitude()');
    out = out.replace(/\b(\w+)\.getTempCByIndex\s*\(.*?\)/g, 'window.sys_ds18b20_readTempC()');
    out = out.replace(/\b(\w+)\.requestTemperatures\s*\(\s*\)\s*;/g, '');
    out = out.replace(/\b(\w+)\.begin\s*\(.*?\)\s*;/g, '');
    out = out.replace(/\b(\w+)\.attach\s*\(\s*(.*?)\s*\)\s*;/g, 'window.sys_servo_attach($2);');
    out = out.replace(/\b(\w+)\.write\s*\(\s*(.*?)\s*\)\s*;/g, 'window.sys_servo_write($2);');
    return out;
  }

  // Transpile Python sensor helper calls for Raspberry Pi & Jetson Nano
  function transpilePythonSensors(jsLine) {
    let line = jsLine;
    line = line.replace(/sensors\.ultrasonic\(\s*(.*?)\s*(?:,\s*(.*?))?\)/g, 'window.sys_readUltrasonicCm($1, $2)');
    line = line.replace(/sensors\.dht_temp\(\s*(.*?)\s*\)/g, 'window.sys_dht_readTemperature($1)');
    line = line.replace(/sensors\.dht_humidity\(\s*(.*?)\s*\)/g, 'window.sys_dht_readHumidity($1)');
    line = line.replace(/sensors\.ds18b20\(\s*(.*?)\s*\)/g, 'window.sys_ds18b20_readTempC($1)');
    line = line.replace(/sensors\.bmp280_pressure\(\s*\)/g, 'window.sys_bmp280_readPressure()');
    line = line.replace(/sensors\.bmp280_altitude\(\s*\)/g, 'window.sys_bmp280_readAltitude()');
    line = line.replace(/sensors\.analog\(\s*(.*?)\s*\)/g, 'window.sys_analogRead($1)');
    line = line.replace(/sensors\.servo\(\s*(.*?)\s*,\s*(.*?)\s*\)/g, 'window.sys_servo_write($1, $2)');
    return line;
  }

  function injectSidebarPalette(sidebar) {
    if (!sidebar || sidebar.querySelector('[data-sensors-injected]')) return;
    const header = document.createElement('h2');
    header.setAttribute('data-sensors-injected', 'true');
    header.className = 'text-gray-400 font-bold mt-4 mb-2 uppercase text-xs tracking-wider';
    header.textContent = 'Sensor & Aktuator Lengkap';
    sidebar.appendChild(header);

    Object.values(CATALOG).forEach(item => {
      const div = document.createElement('div');
      div.className = 'sidebar-item bg-[#2a2a40] p-3 rounded border border-[#4a4a6a] cursor-grab hover:bg-[#3a3a50] transition flex items-center gap-3';
      div.setAttribute('draggable', 'true');
      div.setAttribute('data-type', item.type);
      div.innerHTML = `<i class="fas ${item.icon} text-xl w-6 text-center" style="color:${item.color}"></i> <span class="font-medium text-sm">${item.title}</span>`;
      div.addEventListener('dragstart', e => e.dataTransfer.setData('type', item.type));
      div.addEventListener('click', () => window.spawnComponent?.(item.type, 320, 180));
      sidebar.appendChild(div);
    });
  }

  // Interactive DOM listeners for sliders and toggle buttons
  if (typeof document !== 'undefined') {
    document.addEventListener('input', e => {
      const comp = e.target.closest?.('.component');
      if (!comp) return;
      const type = comp.getAttribute('data-type');
      if (type === 'dht22' && (e.target.hasAttribute('data-dht-temp') || e.target.hasAttribute('data-dht-hum'))) {
        const t = comp.querySelector('[data-dht-temp]')?.value ?? 28;
        const h = comp.querySelector('[data-dht-hum]')?.value ?? 65;
        configureDHT22(comp, `${t}:${h}`);
        window.iotEngine?.evaluateCircuit?.();
      } else if (CATALOG[type]) {
        configure(comp, e.target.value);
        window.iotEngine?.evaluateCircuit?.();
      }
    });

    document.addEventListener('click', e => {
      const toggle = e.target.closest?.('.lab-sensor-toggle');
      if (!toggle) return;
      const comp = toggle.closest('.component');
      if (!comp) return;
      const nextVal = comp.getAttribute('data-value') === '1' ? '0' : '1';
      configure(comp, nextVal);
      window.iotEngine?.evaluateCircuit?.();
    });
  }

  function registerTemplates(targetTemplates) {
    if (!targetTemplates) return;
    Object.keys(CATALOG).forEach(type => {
      targetTemplates[type] = uid => template(type, uid);
    });
  }

  window.LabSensors = {
    CATALOG,
    template,
    createTemplate: template,
    registerTemplates,
    configure,
    evaluate,
    installRuntimeAPIs,
    transpileArduinoSensors,
    transpilePythonSensors,
    injectSidebarPalette
  };
})();
