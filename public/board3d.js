/* Dependency-free, interactive 3D hardware inspection view for ESP32, Arduino Uno, Raspberry Pi 4, and Jetson Nano. */
(() => {
  'use strict';
  const pagePath = location.pathname.toLowerCase();
  let defaultBoard = 'esp32';
  if (pagePath.includes('raspi')) defaultBoard = 'raspi';
  else if (pagePath.includes('jetson')) defaultBoard = 'jetson';

  const launch = document.createElement('button');
  launch.textContent = '◈ Model 3D';
  launch.className = 'lab-dashboard-link';
  launch.type = 'button';
  launch.title = 'Eksplorasi bentuk 3D asli ESP32, Arduino Uno, Raspberry Pi 4, dan Jetson Nano';
  document.querySelector('#toolbar > div')?.append(launch);

  const dialog = document.createElement('dialog');
  dialog.className = 'board3d';
  dialog.innerHTML = `
    <header>
      <div>
        <small>EKSPLORASI PERANGKAT 3D INTERAKTIF</small>
        <h2 data-title>ESP32 DevKit V1 <span>3D</span></h2>
      </div>
      <div class="board3d-tabs" role="tablist" aria-label="Pilih Perangkat 3D">
        <button type="button" data-board="esp32" aria-selected="true">ESP32</button>
        <button type="button" data-board="arduino" aria-selected="false">Arduino Uno</button>
        <button type="button" data-board="raspi" aria-selected="false">Raspberry Pi 4</button>
        <button type="button" data-board="jetson" aria-selected="false">Jetson Nano</button>
      </div>
      <button data-action="close" aria-label="Tutup tampilan 3D">✕</button>
    </header>
    <div class="board3d-stage">
      <canvas aria-label="Model 3D Perangkat IoT. Seret untuk memutar dan gunakan tombol plus atau minus untuk zoom."></canvas>
      <div class="board3d-info">
        <b>KENALI PAPANNYA</b>
        <p>Seret untuk memutar 360° · Gulir untuk zoom · Klik ganda untuk reset</p>
        <p data-detail>ESP-WROOM-32 · Dual-Core 240MHz · Wi-Fi + Bluetooth BLE · 30 GPIO Pin</p>
      </div>
    </div>
    <footer>
      <button data-action="reset">↺ Reset Sudut</button>
      <button data-action="top">◫ Tampak Atas</button>
      <button data-action="iso">◈ Isometrik 3D</button>
      <button data-action="spin" aria-pressed="false">⟳ Putar Otomatis</button>
      <button data-action="out" aria-label="Perkecil">−</button>
      <button data-action="in" aria-label="Perbesar">+</button>
      <button data-action="labels" aria-pressed="true">Label Bagian</button>
      <span data-footer-tag>ESP32 DEVKIT V1 / 30-PIN</span>
    </footer>`;
  document.body.append(dialog);

  const canvas = dialog.querySelector('canvas'), ctx = canvas.getContext('2d');
  const titleEl = dialog.querySelector('[data-title]');
  const detailEl = dialog.querySelector('[data-detail]');
  const footerTagEl = dialog.querySelector('[data-footer-tag]');
  const tabBtns = dialog.querySelectorAll('[data-board]');

  let currentBoard = defaultBoard;
  let yaw = -0.62, tilt = 0.88, zoom = 1.05, labels = true, autoSpin = false, drag = null, frame, spinFrame;
  let width = 1, height = 1, scale = 1;
  let faces = [], tags = [], silkscreenFn = null;

  const palette = {
    gold: '#d4af37',
    copper: '#b8860b',
    metal: '#d8dee4',
    metalDark: '#7a8490',
    chip: '#232730',
    black: '#181c24',
    red: '#dc2626',
    blue: '#2563eb',
    green: '#16a34a'
  };

  function box(x, y, z, w, d, h, color) {
    const v = [
      [x, y, z], [x + w, y, z], [x + w, y + d, z], [x, y + d, z],
      [x, y, z + h], [x + w, y, z + h], [x + w, y + d, z + h], [x, y + d, z + h]
    ];
    [[0, 3, 2, 1], [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7], [4, 5, 6, 7]].forEach((ids, i) =>
      faces.push({ v: ids.map(k => v[k]), color, light: [0.52, 0.70, 0.82, 0.66, 0.88, 1.14][i] })
    );
  }

  function cylinder(x, y, z, r, h, color, n = 14) {
    const top = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, b = ((i + 1) / n) * Math.PI * 2;
      const p = [x + Math.cos(a) * r, y + Math.sin(a) * r], q = [x + Math.cos(b) * r, y + Math.sin(b) * r];
      top.push([...p, z + h]);
      faces.push({ v: [[...p, z], [...q, z], [...q, z + h], [...p, z + h]], color, light: 0.75 + Math.cos(a) * 0.16 });
    }
    faces.push({ v: top, color, light: 1.15 });
  }

  function mountingHole(x, y, r = 2.2) {
    cylinder(x, y, 1.8, r, 0.25, palette.gold, 12);
    cylinder(x, y, 2.06, r * 0.55, 0.12, '#0d1117', 12);
  }

  // 1. BUILD ARDUINO UNO R3 3D MODEL
  function buildArduino() {
    faces = [];
    // Teal PCB Base
    box(-35, -26, 0, 70, 52, 1.9, '#006d70');
    [[-30, -22], [29, -22], [-30, 22], [29, 22]].forEach(([x, y]) => mountingHole(x, y, 2.4));
    // Copper PCB traces
    for (let i = 0; i < 11; i++) {
      box(-20 + i * 3.2, -16, 1.92, 0.25, 32, 0.08, '#00979c');
      box(-24, -12 + i * 2.3, 1.92, 46, 0.2, 0.08, '#00888c');
    }
    // USB Type-B Connector (Silver Metallic Cube)
    box(-38, -17, 1.9, 16, 12, 11.5, palette.metal);
    box(-38.2, -15, 3.8, 0.25, 8, 7.5, '#333942');
    box(-38.3, -13, 5.8, 0.25, 4, 3.2, palette.gold);
    // DC Power Barrel Jack
    box(-37, 8, 1.9, 15, 10, 10.5, palette.black);
    cylinder(-30, 13, 12.4, 3.2, 0.3, '#0b0e14');
    // Reset Button (Top-Left Corner)
    box(-32, -24, 1.9, 5.5, 5.5, 2.2, palette.metal);
    cylinder(-29.2, -21.2, 4.1, 1.8, 1.8, '#ef4444');
    // Female Pin Header Banks (Digital & Power/Analog)
    function femaleHeader(x, y, count) {
      box(x, y, 1.9, count * 2.54, 3.8, 8.2, palette.black);
      for (let i = 0; i < count; i++) {
        box(x + i * 2.54 + 0.6, y + 0.9, 10.15, 1.3, 1.5, 0.14, palette.gold);
        box(x + i * 2.54 + 0.85, y + 1.15, 10.3, 0.8, 1.0, 0.14, '#090c12');
      }
    }
    femaleHeader(-11, -24.5, 8);
    femaleHeader(11, -24.5, 8);
    femaleHeader(-9, 20.5, 6);
    femaleHeader(8.5, 20.5, 6);
    // ATmega328P 28-pin DIP IC Socket & Chip
    box(-3, 4.5, 1.9, 28, 8, 2.2, '#161920');
    box(-2, 5.2, 4.1, 26, 6.6, 3.2, palette.chip);
    for (let i = 0; i < 14; i++) {
      box(-1 + i * 1.85, 3.8, 2.0, 0.75, 1.5, 2.2, palette.metal);
      box(-1 + i * 1.85, 11.7, 2.0, 0.75, 1.5, 2.2, palette.metal);
    }
    cylinder(0.2, 8.5, 7.35, 0.8, 0.12, '#88929b');
    // 16MHz Crystal Oscillator & ATmega16U2
    box(-16, -6, 1.9, 7, 7, 2.2, palette.chip);
    box(-7, -8.5, 1.9, 8.5, 3.8, 2.6, palette.metal);
    // Dual Electrolytic Capacitors
    [-18, -10.5].forEach(x => {
      cylinder(x, 12, 1.9, 2.9, 6.2, '#94a3b8');
      cylinder(x, 12, 8.1, 2.4, 0.18, '#e2e8f0');
    });
    // ICSP 6-Pin Male Gold Header
    for (let x = 0; x < 3; x++) for (let y = 0; y < 2; y++) {
      box(26 + x * 2.4, -3 + y * 2.4, 1.9, 1.0, 1.0, 6.5, palette.gold);
    }
    // Status LEDs (ON Green, L Yellow)
    box(15, -12, 1.9, 2.2, 1.2, 1.1, '#22c55e');
    box(19, -12, 1.9, 2.2, 1.2, 1.1, '#eab308');

    tags = [
      ['PORT USB-B', [-31, -11, 14]],
      ['JACK DAYA 7-12V', [-30, 13, 13]],
      ['PIN DIGITAL (0-13)', [18, -22, 12]],
      ['ATMEGA328P-PU', [11, 8.5, 9]],
      ['PIN ANALOG (A0-A5)', [17, 22, 12]]
    ];
    silkscreenFn = () => {
      const p = project([0, -6, 2.1]), px = project([1, -6, 2.1]), py = project([0, -5, 2.1]);
      ctx.save();
      ctx.transform(px[0] - p[0], px[1] - p[1], py[0] - p[0], py[1] - p[1], p[0], p[1]);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 4.2px monospace';
      ctx.fillText('ARDUINO UNO', 0, 0);
      ctx.font = '2.4px monospace';
      ctx.fillText('REV3 · ∞ ITENAS', 0, 3.2);
      ctx.restore();
    };
  }

  // 2. BUILD ESP32 DEVKIT V1 30-PIN 3D MODEL
  function buildEsp32() {
    faces = [];
    // Matte Dark Black/Anthracite PCB
    box(-32, -18, 0, 64, 36, 1.8, '#1a2028');
    // Under-board 30-pin Gold Male Header Pins + Top Black Plastic Rails
    box(-26, -16.8, 1.8, 52, 3.0, 2.4, palette.black);
    box(-26, 13.8, 1.8, 52, 3.0, 2.4, palette.black);
    for (let i = 0; i < 15; i++) {
      const px = -24.5 + i * 3.5;
      // Top gold pin tips & bottom long breadboard pins
      box(px, -15.8, 4.2, 1.0, 1.0, 2.2, palette.gold);
      box(px, -15.8, -6.5, 0.9, 0.9, 6.5, palette.gold);
      box(px, 14.8, 4.2, 1.0, 1.0, 2.2, palette.gold);
      box(px, 14.8, -6.5, 0.9, 0.9, 6.5, palette.gold);
    }
    [[-29, -14.5], [29, -14.5], [-29, 14.5], [29, 14.5]].forEach(([x, y]) => mountingHole(x, y, 1.8));

    // PCB Antenna Extension on Right Edge (+X) with Gold Meander Trace
    box(18, -10.5, 1.8, 13.5, 21, 0.8, '#11151a');
    for (let i = 0; i < 4; i++) {
      box(21 + i * 2.4, -7.5, 2.65, 1.1, 15, 0.15, palette.gold);
    }
    // ESP-WROOM-32 Module Green/Dark Substrate & Brushed Metal RF Shield Can
    box(-4, -10.5, 1.8, 22, 21, 1.0, '#2b343b');
    box(-3, -9.5, 2.8, 20, 19, 3.8, palette.metal);
    // Castellated Gold Pads along ESP-WROOM-32 edges
    for (let i = 0; i < 9; i++) {
      box(-2.5 + i * 2.2, -10.8, 2.0, 1.1, 0.8, 0.9, palette.gold);
      box(-2.5 + i * 2.2, 10.0, 2.0, 1.1, 0.8, 0.9, palette.gold);
    }

    // CP2102 USB-to-UART Bridge QFN Chip (Center-Left)
    box(-16, -4, 1.8, 7.5, 7.5, 1.8, palette.chip);
    // AMS1117 3.3V Voltage Regulator
    box(-15, 5.5, 1.8, 6.5, 4.5, 2.1, palette.chip);
    box(-13.5, 9.8, 1.8, 3.5, 1.2, 1.8, palette.metal);

    // Micro-USB Port Overhanging Left Edge (-X)
    box(-34.5, -4.5, 1.8, 8.5, 9.0, 4.2, palette.metal);
    box(-34.7, -3.2, 2.5, 0.4, 6.4, 2.4, '#11161d');
    box(-34.8, -2.2, 3.3, 0.4, 4.4, 0.7, palette.gold);

    // Tactile Buttons: EN (Reset) and BOOT (IO0)
    box(-27, -11.5, 1.8, 4.8, 3.8, 2.0, palette.metal);
    cylinder(-24.6, -9.6, 3.8, 1.3, 1.2, palette.black);
    box(-27, 7.7, 1.8, 4.8, 3.8, 2.0, palette.metal);
    cylinder(-24.6, 9.6, 3.8, 1.3, 1.2, palette.black);

    // Onboard PWR (Red) & D2 (Blue) LEDs
    box(-21, -8, 1.8, 2.0, 1.2, 0.9, '#ef4444');
    box(-21, 6.8, 1.8, 2.0, 1.2, 0.9, '#3b82f6');

    tags = [
      ['ESP-WROOM-32 (Wi-Fi/BLE)', [7, 0, 8]],
      ['ANTENA PCB 2.4GHz', [26, 0, 5]],
      ['PORT MICRO-USB', [-32, 0, 7.5]],
      ['CHIP CP2102 UART', [-12, -1, 5]],
      ['TOMBOL EN & BOOT', [-25, 9.6, 6.5]],
      ['30 PIN GPIO HEADER', [0, 15.5, 6.5]]
    ];
    silkscreenFn = () => {
      const p = project([1, -5, 6.7]), px = project([2, -5, 6.7]), py = project([1, -4, 6.7]);
      ctx.save();
      ctx.transform(px[0] - p[0], px[1] - p[1], py[0] - p[0], py[1] - p[1], p[0], p[1]);
      ctx.fillStyle = '#334155';
      ctx.font = 'bold 2.8px monospace';
      ctx.fillText('ESPRESSIF', 0, 0);
      ctx.font = 'bold 2.3px monospace';
      ctx.fillText('ESP-WROOM-32', 0, 3.2);
      ctx.restore();
    };
  }

  // 3. BUILD RASPBERRY PI 4 MODEL B 3D MODEL
  function buildRaspi() {
    faces = [];
    // Signature Emerald Green PCB
    box(-40, -27, 0, 80, 54, 1.9, '#197444');
    [[-35, -22.5], [22, -22.5], [-35, 22.5], [22, 22.5]].forEach(([x, y]) => mountingHole(x, y, 2.4));

    // 40-Pin GPIO Header (2x20 Dual Row Gold Pins along Top Edge)
    box(-31, -24.5, 1.9, 51, 5.2, 3.2, palette.black);
    for (let i = 0; i < 20; i++) {
      const px = -29.5 + i * 2.5;
      box(px, -23.4, 5.1, 0.9, 0.9, 5.2, palette.gold);
      box(px, -21.0, 5.1, 0.9, 0.9, 5.2, palette.gold);
    }

    // Broadcom BCM2711 Quad-Core SoC (Silver Heatspreader)
    box(-14, -6, 1.9, 13, 13, 2.6, palette.metal);
    // 4GB LPDDR4 RAM Chip (Black Package next to SoC)
    box(2, -5.5, 1.9, 9.5, 12, 2.2, palette.chip);
    // Cypress Wi-Fi / Bluetooth Metal Shield Can (Top-Left)
    box(-34, -14, 1.9, 12, 13, 2.8, '#cbd5e1');

    // Right Edge (+X): Gigabit Ethernet + 2x USB 3.0 + 2x USB 2.0 Metallic Towers
    // Gigabit Ethernet RJ45 (Top-Right)
    box(25, -24, 1.9, 17, 14.5, 13.5, palette.metal);
    box(41.8, -21.5, 3.8, 0.5, 9.5, 9.2, '#0f172a');
    // USB 3.0 Dual Stack (Middle-Right with Blue Accents)
    box(27, -6.5, 1.9, 15, 13, 14.5, palette.metal);
    box(41.8, -4.8, 4.2, 0.5, 9.5, 4.2, '#2563eb');
    box(41.8, -4.8, 10.2, 0.5, 9.5, 4.2, '#2563eb');
    // USB 2.0 Dual Stack (Bottom-Right with Black Accents)
    box(27, 9.5, 1.9, 15, 13, 14.5, palette.metal);
    box(41.8, 11.2, 4.2, 0.5, 9.5, 4.2, '#0f172a');
    box(41.8, 11.2, 10.2, 0.5, 9.5, 4.2, '#0f172a');

    // Bottom Edge (+Y): USB-C Power, 2x Micro-HDMI, 3.5mm Audio/AV Jack
    box(-31, 21.5, 1.9, 8.5, 7, 3.6, palette.metal); // USB-C
    box(-18, 21.5, 1.9, 6.8, 7, 3.6, palette.metal); // Micro-HDMI 0
    box(-7, 21.5, 1.9, 6.8, 7, 3.6, palette.metal);  // Micro-HDMI 1
    box(11, 19.5, 1.9, 6.5, 9, 6.2, palette.black);  // 3.5mm Audio Jack

    // CSI Camera & DSI Display Ribbon Connectors
    box(-37, 2, 1.9, 3.2, 16, 4.5, '#e2e8f0');
    box(5, 10, 1.9, 3.2, 14, 4.5, '#e2e8f0');

    tags = [
      ['GPIO 40-PIN HEADER', [-5, -22, 11.5]],
      ['BROADCOM BCM2711 SoC', [-7.5, 0.5, 6]],
      ['RAM LPDDR4 4GB', [7, 0.5, 5.5]],
      ['GIGABIT ETHERNET', [34, -17, 16.5]],
      ['PORT USB 3.0 & 2.0', [35, 2, 17.5]],
      ['USB-C & DUAL MICRO-HDMI', [-15, 25, 7]]
    ];
    silkscreenFn = () => {
      const p = project([-12, -2, 4.6]), px = project([-11, -2, 4.6]), py = project([-12, -1, 4.6]);
      ctx.save();
      ctx.transform(px[0] - p[0], px[1] - p[1], py[0] - p[0], py[1] - p[1], p[0], p[1]);
      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 2.2px monospace';
      ctx.fillText('BCM2711', 0, 0);
      ctx.fillText('RPi 4B', 0, 2.8);
      ctx.restore();
    };
  }

  // 4. BUILD NVIDIA JETSON NANO DEVELOPER KIT 4GB 3D MODEL
  function buildJetson() {
    faces = [];
    // Dark Matte Forest Green Carrier Board
    box(-44, -29, 0, 88, 58, 2.0, '#143625');
    [[-39, -24.5], [39, -24.5], [-39, 24.5], [39, 24.5]].forEach(([x, y]) => mountingHole(x, y, 2.4));

    // 40-Pin GPIO Expansion Header (J41 along Top Edge)
    box(-28, -26.5, 2.0, 51, 5.2, 3.2, palette.black);
    for (let i = 0; i < 20; i++) {
      const px = -26.5 + i * 2.5;
      box(px, -25.4, 5.2, 0.9, 0.9, 5.2, palette.gold);
      box(px, -23.0, 5.2, 0.9, 0.9, 5.2, palette.gold);
    }

    // Jetson Nano SOM Daughterboard + Massive Extruded 3D Black Anodized Heatsink
    box(-18, -14, 2.0, 42, 32, 2.2, '#2d6a4f'); // SOM PCB
    box(-16, -12, 4.2, 38, 28, 3.0, '#161d24'); // Heatsink Base Block
    // 14 Tall Extruded 3D Cooling Fins
    for (let i = 0; i < 14; i++) {
      box(-15 + i * 2.65, -12, 7.2, 1.5, 28, 9.5, i % 2 === 0 ? '#222b35' : '#1a222b');
    }
    // Nameplate Badge on Heatsink Center
    box(-10, -4, 16.8, 26, 8, 0.4, '#111827');

    // Dual MIPI CSI-2 Camera Ribbon Slots (Left Side)
    box(-38, -10, 2.0, 3.5, 18, 5.5, palette.black);
    box(-32, -10, 2.0, 3.5, 18, 5.5, palette.black);

    // Right Edge (+X): 2x Dual USB 3.0 Towers + Gigabit Ethernet RJ45
    box(28, -16, 2.0, 17, 11.5, 14.5, palette.metal); // USB 3.0 Stack 1
    box(44.8, -14.2, 4.5, 0.5, 8, 4, '#2563eb');
    box(44.8, -14.2, 10.5, 0.5, 8, 4, '#2563eb');

    box(28, -2, 2.0, 17, 11.5, 14.5, palette.metal);  // USB 3.0 Stack 2
    box(44.8, -0.2, 4.5, 0.5, 8, 4, '#2563eb');
    box(44.8, -0.2, 10.5, 0.5, 8, 4, '#2563eb');

    box(28, 12, 2.0, 17, 13.5, 13.5, palette.metal); // Gigabit Ethernet
    box(44.8, 14.2, 3.8, 0.5, 9, 9, '#0f172a');

    // Bottom Edge (+Y): 5V DC Barrel Jack, HDMI + DisplayPort Stacked Cage, Micro-USB
    box(-31, 20, 2.0, 10, 10, 9.5, palette.black);   // 5V DC Barrel Jack
    box(-14, 20.5, 2.0, 13, 9.5, 11, palette.metal); // HDMI / DP Stack
    box(4, 22, 2.0, 7.5, 8, 4.2, palette.metal);     // Micro-USB

    tags = [
      ['HEATSINK & GPU MAXWELL', [3, 0, 18]],
      ['GPIO 40-PIN (J41)', [-2, -24, 11.5]],
      ['DUAL SLOT KAMERA CSI', [-35, -1, 9]],
      ['4x PORT USB 3.0', [37, -9, 17.5]],
      ['GIGABIT ETHERNET', [37, 19, 16.5]],
      ['HDMI / DP & DAYA 5V', [-14, 25, 13.5]]
    ];
    silkscreenFn = () => {
      const p = project([-7.5, -0.5, 17.3]), px = project([-6.5, -0.5, 17.3]), py = project([-7.5, 0.5, 17.3]);
      ctx.save();
      ctx.transform(px[0] - p[0], px[1] - p[1], py[0] - p[0], py[1] - p[1], p[0], p[1]);
      ctx.fillStyle = '#a3e635';
      ctx.font = 'bold 2.8px monospace';
      ctx.fillText('JETSON NANO', 0, 0);
      ctx.restore();
    };
  }

  const boardConfigs = {
    esp32: {
      title: 'ESP32 DevKit V1 <span>3D</span>',
      detail: 'ESP-WROOM-32 · Dual-Core 240MHz · Wi-Fi + Bluetooth BLE · 30 GPIO Pin',
      footer: 'ESP32 DEVKIT V1 / 30-PIN',
      build: buildEsp32
    },
    arduino: {
      title: 'Arduino Uno R3 <span>3D</span>',
      detail: 'ATmega328P-PU · 14 Pin Digital (6 PWM) · 6 Input Analog · 16 MHz',
      footer: 'ARDUINO UNO / REV3',
      build: buildArduino
    },
    raspi: {
      title: 'Raspberry Pi 4 Model B <span>3D</span>',
      detail: 'Broadcom BCM2711 Cortex-A72 · 4GB LPDDR4 · 40-Pin GPIO · Dual HDMI + Gigabit Eth',
      footer: 'RASPBERRY PI 4 MODEL B / 4GB',
      build: buildRaspi
    },
    jetson: {
      title: 'NVIDIA Jetson Nano <span>3D</span>',
      detail: '128-Core Maxwell GPU · Quad-Core ARM A57 · 4GB LPDDR4 · 40-Pin GPIO + CSI Camera',
      footer: 'NVIDIA JETSON NANO DEVELOPER KIT',
      build: buildJetson
    }
  };

  function selectBoard(boardKey) {
    if (!boardConfigs[boardKey]) return;
    currentBoard = boardKey;
    const cfg = boardConfigs[boardKey];
    titleEl.innerHTML = cfg.title;
    detailEl.textContent = cfg.detail;
    footerTagEl.textContent = cfg.footer;
    tabBtns.forEach(btn => btn.setAttribute('aria-selected', String(btn.dataset.board === boardKey)));
    cfg.build();
    draw();
  }

  function project([x, y, z]) {
    const a = x * Math.cos(yaw) - y * Math.sin(yaw);
    const b = x * Math.sin(yaw) + y * Math.cos(yaw);
    return [
      width / 2 + a * scale,
      height * 0.52 + (b * Math.cos(tilt) - z * Math.sin(tilt)) * scale,
      b * Math.sin(tilt) + z * Math.cos(tilt)
    ];
  }

  function shade(hex, f) {
    return '#' + hex.slice(1).match(/../g).map(c =>
      Math.min(255, Math.round(parseInt(c, 16) * f)).toString(16).padStart(2, '0')
    ).join('');
  }

  function line(points, color) {
    ctx.beginPath();
    points.forEach((v, i) => {
      const p = project(v);
      i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  function draw() {
    scale = Math.min(width / 118, height / 92) * zoom;
    ctx.clearRect(0, 0, width, height);
    for (let i = -140; i <= 140; i += 10) {
      line([[-140, i, -4], [140, i, -4]], '#dfcfb440');
      line([[i, -140, -4], [i, 140, -4]], '#dfcfb440');
    }
    ctx.save();
    const shadow = project([0, 0, -4]);
    ctx.translate(shadow[0] + 8, shadow[1] + 16);
    ctx.scale(1, 0.52);
    ctx.filter = 'blur(15px)';
    ctx.fillStyle = '#42362638';
    ctx.beginPath();
    ctx.ellipse(0, 0, 38 * scale, 26 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    faces
      .map(f => ({ ...f, p: f.v.map(project) }))
      .sort((a, b) => a.p.reduce((s, v) => s + v[2], 0) / a.p.length - b.p.reduce((s, v) => s + v[2], 0) / b.p.length)
      .forEach(f => {
        ctx.beginPath();
        f.p.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
        ctx.closePath();
        ctx.fillStyle = shade(f.color, f.light);
        ctx.fill();
        ctx.strokeStyle = '#18203088';
        ctx.lineWidth = 0.6;
        ctx.stroke();
      });

    if (silkscreenFn) silkscreenFn();

    if (labels) {
      tags.forEach(([text, v]) => {
        const p = project(v);
        ctx.font = 'bold 10px monospace';
        const w = ctx.measureText(text).width + 18;
        ctx.fillStyle = '#f9f4e9f2';
        ctx.strokeStyle = '#cbbda5';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.roundRect(p[0] + 12, p[1] - 11, w, 23, 5);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#1e293b';
        ctx.fillText(text, p[0] + 21, p[1] + 4);
        ctx.fillStyle = '#e4fbf4';
        ctx.strokeStyle = '#0d9488';
        ctx.lineWidth = 2.8;
        ctx.beginPath();
        ctx.arc(p[0], p[1], 4.8, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      });
    }
  }

  function stepSpin() {
    if (!autoSpin || !dialog.open) return;
    yaw += 0.008;
    draw();
    spinFrame = requestAnimationFrame(stepSpin);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    width = r.width;
    height = r.height;
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  selectBoard(defaultBoard);

  launch.addEventListener('click', () => {
    dialog.showModal();
    requestAnimationFrame(resize);
  });

  dialog.addEventListener('click', e => {
    const boardBtn = e.target.closest('[data-board]');
    if (boardBtn) {
      selectBoard(boardBtn.dataset.board);
      return;
    }
    const a = e.target.closest('[data-action]')?.dataset.action;
    if (!a) return;
    if (a === 'close') {
      autoSpin = false;
      cancelAnimationFrame(spinFrame);
      dialog.close();
      return;
    }
    if (a === 'reset') { yaw = -0.62; tilt = 0.88; zoom = 1.05; }
    if (a === 'top') { yaw = 0; tilt = 1.48; zoom = 1.15; }
    if (a === 'iso') { yaw = -0.62; tilt = 0.85; zoom = 1.05; }
    if (a === 'spin') {
      autoSpin = !autoSpin;
      e.target.setAttribute('aria-pressed', String(autoSpin));
      if (autoSpin) stepSpin();
      else cancelAnimationFrame(spinFrame);
    }
    if (a === 'in') zoom = Math.min(2.2, zoom + 0.15);
    if (a === 'out') zoom = Math.max(0.45, zoom - 0.15);
    if (a === 'labels') {
      labels = !labels;
      e.target.setAttribute('aria-pressed', String(labels));
    }
    draw();
  });

  canvas.addEventListener('dblclick', () => {
    yaw = -0.62; tilt = 0.88; zoom = 1.05;
    draw();
  });

  canvas.addEventListener('pointerdown', e => {
    drag = [e.clientX, e.clientY];
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (!drag) return;
    yaw += (e.clientX - drag[0]) * 0.009;
    tilt = Math.max(0.15, Math.min(1.52, tilt + (e.clientY - drag[1]) * 0.007));
    drag = [e.clientX, e.clientY];
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(draw);
  });

  for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) {
    canvas.addEventListener(event, () => (drag = null));
  }

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    zoom = Math.max(0.45, Math.min(2.2, zoom * Math.exp(-e.deltaY * 0.001)));
    draw();
  }, { passive: false });

  new ResizeObserver(() => {
    if (dialog.open) resize();
  }).observe(canvas);
})();
