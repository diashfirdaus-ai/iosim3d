const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function loadSensorsContext() {
    const context = {
        window: {},
        document: {
            addEventListener: () => {},
            querySelectorAll: () => []
        }
    };
    context.window.document = context.document;
    vm.runInNewContext(fs.readFileSync('public/sensors.js', 'utf8'), context);
    return context.window;
}

function makePin(pinId, pinName, isBoard = false) {
    return {
        getAttribute(attr) {
            if (attr === 'data-pin-id') return pinId;
            if (attr === 'data-pin-name') return pinName;
            return null;
        },
        closest(selector) {
            if (isBoard && selector.includes('esp32')) return {};
            return null;
        }
    };
}

function makeSensorComponent(type, uid, initialValue) {
    const attrs = {
        'data-type': type,
        'data-uid': String(uid),
        'data-value': String(initialValue)
    };
    const classes = new Set(['component']);
    const visEl = { innerHTML: '' };
    const readoutEl = { textContent: '' };
    const unitEl = { textContent: '' };
    const sliderEl = { value: String(initialValue) };
    const toggleBtnEl = {
        textContent: '',
        classes: new Set(),
        classList: {
            toggle(c, force) {
                if (force) toggleBtnEl.classes.add(c);
                else toggleBtnEl.classes.delete(c);
            }
        }
    };
    const dhtReadoutEl = { textContent: '' };
    const dhtTempInputEl = { value: '28', previousElementSibling: { lastElementChild: { textContent: '' } } };
    const dhtHumInputEl = { value: '65', previousElementSibling: { lastElementChild: { textContent: '' } } };
    const dhtBodyEl = {
        dataset: { upgradedDht: 'true' },
        innerHTML: '',
        querySelector(sel) {
            if (sel === '[data-dht-readout]') return dhtReadoutEl;
            if (sel === '[data-dht-temp]') return dhtTempInputEl;
            if (sel === '[data-dht-hum]') return dhtHumInputEl;
            return null;
        }
    };

    return {
        attrs,
        classes,
        visEl,
        readoutEl,
        unitEl,
        sliderEl,
        toggleBtnEl,
        dhtReadoutEl,
        dhtTempInputEl,
        dhtHumInputEl,
        dhtBodyEl,
        getAttribute(k) { return attrs[k] ?? null; },
        setAttribute(k, v) { attrs[k] = String(v); },
        classList: {
            add(c) { classes.add(c); },
            remove(c) { classes.delete(c); },
            toggle(c, force) {
                if (force) classes.add(c);
                else classes.delete(c);
            },
            contains(c) { return classes.has(c); }
        },
        querySelector(sel) {
            if (sel === '[data-sensor-vis]') return visEl;
            if (sel === '[data-sensor-readout]') return readoutEl;
            if (sel === '[data-sensor-unit]') return unitEl;
            if (sel === 'input[type="range"]') return sliderEl;
            if (sel === '.lab-sensor-toggle') return toggleBtnEl;
            if (sel === '.dht-body') return dhtBodyEl;
            return null;
        }
    };
}

function makePoweredCircuit(type, uid, initialValue, extraWires = []) {
    const comp = makeSensorComponent(type, uid, initialValue);
    const vccBoard = makePin('esp_3v3', '3v3', true);
    const gndBoard = makePin('esp_gnd_1', 'gnd', true);
    const vccComp = makePin(`${type}_vcc_${uid}`, 'vcc', false);
    const gndComp = makePin(`${type}_gnd_${uid}`, 'gnd', false);

    const state = {
        isSimulating: true,
        wires: [
            { pin1: vccComp, pin2: vccBoard },
            { pin1: gndComp, pin2: gndBoard },
            ...extraWires
        ],
        hw: {
            pins: { '3v3': 1, '5v': 1, gnd: 0 },
            digitalInput: {},
            analog: {},
            pinModes: {}
        }
    };
    const doc = {
        querySelectorAll(sel) {
            if (sel === `.component[data-type="${type}"]` || sel === '.component') return [comp];
            return [];
        }
    };
    return { comp, state, doc };
}

test('Catalog exposes all 12 new sensors/actuators plus upgraded DHT22', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const expectedTypes = [
        'ultrasonic', 'pir', 'soil', 'mq2', 'flame', 'rain',
        'sound', 'ir_obstacle', 'ds18b20', 'bmp280', 'servo', 'relay'
    ];
    for (const type of expectedTypes) {
        assert.ok(LabSensors.CATALOG[type], `Missing catalog entry for ${type}`);
        const html = LabSensors.template(type, '99');
        assert.ok(html.includes('component-header'), `Template for ${type} missing header`);
        for (const pinDef of LabSensors.CATALOG[type].pins) {
            assert.ok(
                html.includes(`data-pin-id="${type}_${pinDef.id}_99"`),
                `Template for ${type} missing pin ${pinDef.id}`
            );
        }
    }

    const templates = {};
    LabSensors.registerTemplates(templates);
    for (const type of expectedTypes) {
        assert.equal(typeof templates[type], 'function');
    }
});

test('1. Ultrasonic HC-SR04 sensor: distance cm, pulseIn microseconds, analog & digital trigger', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const trigBoard = makePin('esp_5', '5', true);
    const echoBoard = makePin('esp_18', '18', true);
    const trigPin = makePin('ultrasonic_trig_1', 'trig', false);
    const echoPin = makePin('ultrasonic_echo_1', 'echo', false);

    const { comp, state, doc } = makePoweredCircuit('ultrasonic', 1, 35, [
        { pin1: trigPin, pin2: trigBoard },
        { pin1: echoPin, pin2: echoBoard }
    ]);

    LabSensors.installRuntimeAPIs(win, () => state, () => LabSensors.evaluate(state, doc));
    LabSensors.evaluate(state, doc);

    assert.equal(comp.readoutEl.textContent, '35 cm (2030 µs)');
    assert.equal(state.hw.pulseIn['18'], 2030);
    assert.equal(win.sys_pulseIn(18), 2030);
    assert.equal(win.sys_readUltrasonicCm(5, 18), 35);
    assert.equal(state.hw.digitalInput['18'], 1);
    assert.equal(state.hw.pins['18'], 1);

    comp.setAttribute('data-value', '150');
    LabSensors.evaluate(state, doc);
    assert.equal(win.sys_pulseIn(18), 150 * 58);
    assert.equal(state.hw.digitalInput['18'], 0);
    assert.equal(state.hw.pins['18'], 0);
});

test('2. PIR HC-SR501 motion sensor: LOW when idle, HIGH when motion detected', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const outBoard = makePin('esp_19', '19', true);
    const outPin = makePin('pir_out_2', 'out', false);

    const { comp, state, doc } = makePoweredCircuit('pir', 2, 0, [
        { pin1: outPin, pin2: outBoard }
    ]);

    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['19'], 0);
    assert.equal(state.hw.digitalInput['19'], 0);
    assert.equal(state.hw.analog['19'], 0);
    assert.equal(comp.readoutEl.textContent, 'AMAN: LOW (0)');

    comp.setAttribute('data-value', '1');
    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['19'], 1);
    assert.equal(state.hw.digitalInput['19'], 1);
    assert.equal(state.hw.analog['19'], 4095);
    assert.equal(comp.readoutEl.textContent, 'GERAKAN: HIGH (1)');
});

test('3. Soil Moisture YL-69 sensor: analog moisture scaling & dry threshold DO trigger', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const aoBoard = makePin('esp_34', '34', true);
    const doBoard = makePin('esp_25', '25', true);
    const aoPin = makePin('soil_ao_3', 'ao', false);
    const doPin = makePin('soil_do_3', 'do', false);

    const { comp, state, doc } = makePoweredCircuit('soil', 3, 25, [
        { pin1: aoPin, pin2: aoBoard },
        { pin1: doPin, pin2: doBoard }
    ]);

    LabSensors.evaluate(state, doc);
    assert.equal(comp.readoutEl.textContent, '25% (Kering)');
    assert.equal(state.hw.analog['34'], Math.round((25 / 100) * 4095));
    assert.equal(state.hw.pins['25'], 1); // Dry (< 40%) sets DO HIGH

    comp.setAttribute('data-value', '75');
    LabSensors.evaluate(state, doc);
    assert.equal(comp.readoutEl.textContent, '75% (Lembab)');
    assert.equal(state.hw.analog['34'], Math.round((75 / 100) * 4095));
    assert.equal(state.hw.pins['25'], 0); // Wet (>= 40%) sets DO LOW
});

test('4. Gas & Smoke MQ-2 sensor: ppm readout, analog output & hazard threshold (>=600 ppm)', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const aoBoard = makePin('esp_35', '35', true);
    const doBoard = makePin('esp_26', '26', true);
    const aoPin = makePin('mq2_ao_4', 'ao', false);
    const doPin = makePin('mq2_do_4', 'do', false);

    const { comp, state, doc } = makePoweredCircuit('mq2', 4, 250, [
        { pin1: aoPin, pin2: aoBoard },
        { pin1: doPin, pin2: doBoard }
    ]);

    LabSensors.evaluate(state, doc);
    assert.equal(comp.readoutEl.textContent, '250 ppm (Normal)');
    assert.equal(state.hw.pins['26'], 0);

    comp.setAttribute('data-value', '850');
    LabSensors.evaluate(state, doc);
    assert.ok(comp.readoutEl.textContent.includes('850 ppm'));
    assert.equal(state.hw.pins['26'], 1);
    assert.ok(state.hw.analog['35'] > 1500);
});

test('5. Flame Sensor KY-026: fire intensity %, analog level & fire alert DO pin', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const aoBoard = makePin('esp_32', '32', true);
    const doBoard = makePin('esp_27', '27', true);
    const aoPin = makePin('flame_ao_5', 'ao', false);
    const doPin = makePin('flame_do_5', 'do', false);

    const { comp, state, doc } = makePoweredCircuit('flame', 5, 10, [
        { pin1: aoPin, pin2: aoBoard },
        { pin1: doPin, pin2: doBoard }
    ]);

    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['27'], 0);

    comp.setAttribute('data-value', '80');
    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['27'], 1);
    assert.equal(state.hw.analog['32'], Math.round((80 / 100) * 4095));
});

test('6. Rain Sensor FC-37: water droplet %, analog level & wet threshold DO pin', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const aoBoard = makePin('esp_33', '33', true);
    const doBoard = makePin('esp_14', '14', true);
    const aoPin = makePin('rain_ao_6', 'ao', false);
    const doPin = makePin('rain_do_6', 'do', false);

    const { comp, state, doc } = makePoweredCircuit('rain', 6, 20, [
        { pin1: aoPin, pin2: aoBoard },
        { pin1: doPin, pin2: doBoard }
    ]);

    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['14'], 0);

    comp.setAttribute('data-value', '65');
    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['14'], 1);
    assert.equal(state.hw.analog['33'], Math.round((65 / 100) * 4095));
});

test('7. Sound Sensor KY-038: decibel dB level, analog mapping & loud threshold (>=75 dB)', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const aoBoard = makePin('esp_34', '34', true);
    const doBoard = makePin('esp_12', '12', true);
    const aoPin = makePin('sound_ao_7', 'ao', false);
    const doPin = makePin('sound_do_7', 'do', false);

    const { comp, state, doc } = makePoweredCircuit('sound', 7, 45, [
        { pin1: aoPin, pin2: aoBoard },
        { pin1: doPin, pin2: doBoard }
    ]);

    LabSensors.evaluate(state, doc);
    assert.equal(comp.readoutEl.textContent, '45 dB (Tenang)');
    assert.equal(state.hw.pins['12'], 0);

    comp.setAttribute('data-value', '90');
    LabSensors.evaluate(state, doc);
    assert.equal(comp.readoutEl.textContent, '90 dB (Bising/Tepuk)');
    assert.equal(state.hw.pins['12'], 1);
    assert.equal(state.hw.analog['34'], Math.round(((90 - 30) / 90) * 4095));
});

test('8. IR Obstacle Sensor FC-51: digital obstacle detection toggle', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const outBoard = makePin('esp_13', '13', true);
    const outPin = makePin('ir_obstacle_out_8', 'out', false);

    const { comp, state, doc } = makePoweredCircuit('ir_obstacle', 8, 0, [
        { pin1: outPin, pin2: outBoard }
    ]);

    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['13'], 0);
    assert.equal(comp.readoutEl.textContent, 'KOSONG: LOW (0)');

    comp.setAttribute('data-value', '1');
    LabSensors.evaluate(state, doc);
    assert.equal(state.hw.pins['13'], 1);
    assert.equal(comp.readoutEl.textContent, 'HALANGAN: HIGH (1)');
});

test('9. DS18B20 Waterproof Temperature Sensor: 1-Wire temperature reading & analog value', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const dqBoard = makePin('esp_4', '4', true);
    const dqPin = makePin('ds18b20_dq_9', 'dq', false);

    const { comp, state, doc } = makePoweredCircuit('ds18b20', 9, 42.5, [
        { pin1: dqPin, pin2: dqBoard }
    ]);

    LabSensors.installRuntimeAPIs(win, () => state, () => LabSensors.evaluate(state, doc));
    LabSensors.evaluate(state, doc);

    assert.equal(comp.readoutEl.textContent, '42.5 °C');
    assert.equal(win.sys_ds18b20_readTempC(4), 42.5);
    assert.equal(state.hw.pins['4'], 1); // >= 35°C sets digital alert HIGH
});

test('10. BMP280 Barometric Pressure & Altitude Sensor (I2C): pressure hPa & altitude m', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const sdaBoard = makePin('esp_21', '21', true);
    const sclBoard = makePin('esp_22', '22', true);
    const sdaPin = makePin('bmp280_sda_10', 'sda', false);
    const sclPin = makePin('bmp280_scl_10', 'scl', false);

    const { comp, state, doc } = makePoweredCircuit('bmp280', 10, 1000, [
        { pin1: sdaPin, pin2: sdaBoard },
        { pin1: sclPin, pin2: sclBoard }
    ]);

    LabSensors.installRuntimeAPIs(win, () => state, () => LabSensors.evaluate(state, doc));
    LabSensors.evaluate(state, doc);

    assert.ok(comp.readoutEl.textContent.includes('1000 hPa'));
    assert.equal(win.sys_bmp280_readPressure(), 1000);
    const altitude = win.sys_bmp280_readAltitude();
    assert.ok(altitude > 100 && altitude < 120, `Expected ~111m altitude at 1000 hPa, got ${altitude}`);
});

test('11. Servo Motor SG90: angle rotation from sys_servo_write and digital actuation', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const pwmBoard = makePin('esp_15', '15', true);
    const pwmPin = makePin('servo_pwm_11', 'pwm', false);

    const { comp, state, doc } = makePoweredCircuit('servo', 11, 90, [
        { pin1: pwmPin, pin2: pwmBoard }
    ]);

    LabSensors.installRuntimeAPIs(win, () => state, () => LabSensors.evaluate(state, doc));
    win.sys_servo_write(15, 135);

    assert.equal(comp.getAttribute('data-value'), '135');
    assert.equal(comp.readoutEl.textContent, 'Sudut: 135°');
    assert.ok(comp.visEl.innerHTML.includes('rotate(45deg)'));
});

test('12. Relay 1-Channel Module: switches contact ON/OFF from MCU output pin', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const inBoard = makePin('esp_2', '2', true);
    const inPin = makePin('relay_in_12', 'in', false);

    const { comp, state, doc } = makePoweredCircuit('relay', 12, 0, [
        { pin1: inPin, pin2: inBoard }
    ]);

    state.hw.pins['2'] = 0;
    LabSensors.evaluate(state, doc);
    assert.equal(comp.readoutEl.textContent, 'KONTAK: TERBUKA (OFF)');
    assert.ok(!comp.visEl.innerHTML.includes('relay-box on'));

    state.hw.pins['2'] = 1;
    LabSensors.evaluate(state, doc);
    assert.equal(comp.readoutEl.textContent, 'KONTAK: TERTUTUP (ON)');
    assert.ok(comp.visEl.innerHTML.includes('relay-box on'));
});

test('13. Upgraded DHT22 dual temperature & humidity sensor: independent sliders and APIs', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;
    const datBoard = makePin('esp_4', '4', true);
    const vccBoard = makePin('esp_3v3', '3v3', true);
    const gndBoard = makePin('esp_gnd_1', 'gnd', true);
    const datPin = makePin('dht_dat_13', 'dat', false);
    const vccPin = makePin('dht_vcc_13', 'vcc', false);
    const gndPin = makePin('dht_gnd_13', 'gnd', false);

    const comp = makeSensorComponent('dht22', 13, '31.5:78');
    LabSensors.configure(comp, '31.5:78');
    assert.equal(comp.dhtReadoutEl.textContent, '31.5°C · 78% RH');

    const state = {
        isSimulating: true,
        wires: [
            { pin1: vccPin, pin2: vccBoard },
            { pin1: gndPin, pin2: gndBoard },
            { pin1: datPin, pin2: datBoard }
        ],
        hw: { pins: { '3v3': 1, gnd: 0 }, digitalInput: {}, analog: {}, pinModes: {} }
    };
    const doc = { querySelectorAll: (s) => (s.includes('dht22') ? [comp] : []) };

    LabSensors.installRuntimeAPIs(win, () => state, () => LabSensors.evaluate(state, doc));
    LabSensors.evaluate(state, doc);

    assert.equal(win.sys_dht_readTemperature(4), 31.5);
    assert.equal(win.sys_dht_readHumidity(4), 78);
});

test('Arduino C++ & Python sensor code transpilation works for all sensor libraries', () => {
    const win = loadSensorsContext();
    const { LabSensors } = win;

    const arduinoCode = [
        '#include <DHT.h>',
        '#include <Servo.h>',
        'DHT dht(4, DHT22);',
        'Servo myServo;',
        'Adafruit_BMP280 bmp;',
        'DallasTemperature sensors(&oneWire);',
        'void setup() {',
        '  dht.begin();',
        '  bmp.begin(0x76);',
        '  sensors.begin();',
        '  myServo.attach(15);',
        '}',
        'void loop() {',
        '  float t = dht.readTemperature();',
        '  float h = dht.readHumidity();',
        '  long dur = pulseIn(18, HIGH);',
        '  float p = bmp.readPressure();',
        '  float alt = bmp.readAltitude(1013.25);',
        '  float w = sensors.getTempCByIndex(0);',
        '  myServo.write(120);',
        '}'
    ].join('\n');

    const jsFromCpp = LabSensors.transpileArduinoSensors(arduinoCode);
    assert.ok(jsFromCpp.includes('window.sys_dht_readTemperature()'));
    assert.ok(jsFromCpp.includes('window.sys_dht_readHumidity()'));
    assert.ok(jsFromCpp.includes('window.sys_pulseIn(18)'));
    assert.ok(jsFromCpp.includes('window.sys_bmp280_readPressure()'));
    assert.ok(jsFromCpp.includes('window.sys_bmp280_readAltitude()'));
    assert.ok(jsFromCpp.includes('window.sys_ds18b20_readTempC()'));
    assert.ok(jsFromCpp.includes('window.sys_servo_attach(15);'));
    assert.ok(jsFromCpp.includes('window.sys_servo_write(120);'));

    const pyLine = 'dist = sensors.ultrasonic(23, 24); temp = sensors.dht_temp(4); hum = sensors.dht_humidity(4); pres = sensors.bmp280_pressure(); sensors.servo(18, 90)';
    const jsFromPy = LabSensors.transpilePythonSensors(pyLine);
    assert.ok(jsFromPy.includes('window.sys_readUltrasonicCm(23, 24)'));
    assert.ok(jsFromPy.includes('window.sys_dht_readTemperature(4)'));
    assert.ok(jsFromPy.includes('window.sys_dht_readHumidity(4)'));
    assert.ok(jsFromPy.includes('window.sys_bmp280_readPressure()'));
    assert.ok(jsFromPy.includes('window.sys_servo_write(18, 90)'));
});

test('All simulators (esp, raspi, jetson) include sensors.js, sensors.css, and 3D board assets', () => {
    for (const page of ['esp', 'raspi', 'jetson']) {
        const html = fs.readFileSync(`pages/${page}.html`, 'utf8');
        assert.ok(html.includes('/sensors.css'), `${page}.html missing /sensors.css`);
        assert.ok(html.includes('/sensors.js'), `${page}.html missing /sensors.js`);
        assert.ok(html.includes('window.LabSensors.registerTemplates'), `${page}.html missing registerTemplates`);
        assert.ok(html.includes('window.LabSensors.configure'), `${page}.html missing LabSensors.configure`);
        assert.ok(/window\.LabSensors\??\.evaluate/.test(html), `${page}.html missing LabSensors.evaluate`);
        assert.ok(html.includes('/board3d.js'), `${page}.html missing /board3d.js`);
    }

    for (const svg of ['esp32-real.svg', 'arduino-real.svg', 'raspi-real.svg', 'jetson-real.svg']) {
        assert.ok(fs.existsSync(`public/${svg}`), `Missing 3D board SVG public/${svg}`);
    }
});
