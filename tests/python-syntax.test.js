const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function checker() {
  const c = { window: {} };
  vm.runInNewContext(fs.readFileSync('public/python-syntax.js', 'utf8'), c);
  return c.window.PythonSyntax.check;
}

function raspiExample() {
  const html = fs.readFileSync('pages/raspi.html', 'utf8');
  const code = html.match(/<textarea id="code-editor"[^>]*>([\s\S]*?)<\/textarea>/)[1];
  return { html, code };
}

test('default Raspberry Pi and Jetson Nano Python programs pass validation', () => {
  const check = checker();
  const { html, code } = raspiExample();
  const jetsonHtml = fs.readFileSync('pages/jetson.html', 'utf8');
  const jetsonCode = jetsonHtml.match(/<textarea id="code-editor"[^>]*>([\s\S]*?)<\/textarea>/)[1];

  assert.equal(check(code), true);
  assert.equal(check(jetsonCode), true);
  assert.ok(html.includes('/python-syntax.js'));
  assert.ok(
    html.indexOf('window.PythonSyntax.check(codeEditor.value)') <
    html.indexOf('const jsCode = transpilePythonToJS(codeEditor.value)')
  );
});

test('corrupting any executable line in the default Raspberry Pi script fails before simulation', () => {
  const check = checker();
  const { code } = raspiExample();
  const lines = code.split(/\r?\n/);

  const lineMutations = [
    ['import RPi.GPIO as GPIO', 'import RPi.GPIO_SALAH as GPIO'],
    ['import time', 'import time_salah'],
    ['led_pin = 18', 'led_pin ='],
    ['GPIO.setmode(GPIO.BCM)', 'GPIO.setmode(BCM)'],
    ['GPIO.setup(led_pin, GPIO.OUT)', 'GPIO.setup(led_pin, OUTPUT)'],
    ['print("Sistem Raspberry Pi Dimulai!")', 'prin("Sistem Raspberry Pi Dimulai!")'],
    ['while True:', 'while True'],
    ['    GPIO.output(led_pin, GPIO.HIGH)', '    GPIO.output(led_pin, HIGH)'],
    ['    print("Lampu Nyala")', '    print("Lampu Nyala)'],
    ['    time.sleep(1)', '    time.slepp(1)'],
    ['    GPIO.output(led_pin, GPIO.LOW)', '    GPIO.out(led_pin, GPIO.LOW)'],
    ['    print("Lampu Mati")', '    print "Lampu Mati"']
  ];

  for (const [original, broken] of lineMutations) {
    const idx = lines.findIndex(l => l === original);
    assert.ok(idx !== -1, `Expected to find line: ${original}`);
    const mutated = [...lines];
    mutated[idx] = broken;
    assert.throws(
      () => check(mutated.join('\n')),
      err => err.lineNumber === idx + 1,
      `Expected line ${idx + 1} (${broken}) to fail validation`
    );
  }
});

test('rejects missing imports, missing GPIO.setmode, and unconfigured GPIO pins', () => {
  const check = checker();
  const { code } = raspiExample();

  // Missing import RPi.GPIO as GPIO
  assert.throws(
    () => check(code.replace('import RPi.GPIO as GPIO', '')),
    err => err.message.includes("Modul 'GPIO' belum di-import")
  );

  // Missing import time
  assert.throws(
    () => check(code.replace('import time', '')),
    err => err.message.includes("Modul 'time' belum di-import")
  );

  // Missing GPIO.setmode
  assert.throws(
    () => check(code.replace('GPIO.setmode(GPIO.BCM)', '')),
    err => err.message.includes('Mode pin belum diatur')
  );

  // Missing GPIO.setup before GPIO.output
  assert.throws(
    () => check(code.replace('GPIO.setup(led_pin, GPIO.OUT)', '')),
    err => err.message.includes('belum dikonfigurasi')
  );

  // Pin configured as GPIO.IN but used in GPIO.output
  assert.throws(
    () => check(code.replace('GPIO.setup(led_pin, GPIO.OUT)', 'GPIO.setup(led_pin, GPIO.IN)')),
    err => err.message.includes('GPIO.IN')
  );

  // Invalid BCM GPIO pin number
  assert.throws(
    () => check(code.replace('led_pin = 18', 'led_pin = 99')),
    err => err.message.includes("Nomor pin GPIO BCM '99' tidak valid")
  );
});

test('rejects bad indentation, undeclared variables, and C/Arduino/JS syntax', () => {
  const check = checker();
  const base = [
    'import RPi.GPIO as GPIO',
    'import time',
    'GPIO.setmode(GPIO.BCM)',
    'GPIO.setup(18, GPIO.OUT)'
  ].join('\n');

  // Unexpected indent
  assert.throws(
    () => check(`${base}\n    print("salah indent")`),
    err => err.lineNumber === 5 && err.message.includes('Indentasi')
  );

  // Missing indent after ':'
  assert.throws(
    () => check(`${base}\nwhile True:\nprint("tidak menjorok")`),
    err => err.lineNumber === 6 && err.message.includes('menjorok ke dalam')
  );

  // Undeclared variable
  assert.throws(
    () => check(`${base}\nGPIO.output(pin_belum_ada, GPIO.HIGH)`),
    err => err.lineNumber === 5 && err.message.includes("Variabel 'pin_belum_ada' belum didefinisikan")
  );

  // Semicolon, // comment, int declaration, lowercase true
  assert.throws(
    () => check(`${base}\nprint("halo");`),
    err => err.lineNumber === 5 && err.message.includes("';'")
  );
  assert.throws(
    () => check(`${base}\n// komentar c`),
    err => err.lineNumber === 5 && err.message.includes("'#'")
  );
  assert.throws(
    () => check(`${base}\nint x = 5`),
    err => err.lineNumber === 5 && err.message.includes('deklarasi tipe data')
  );
  assert.throws(
    () => check(`${base}\nwhile true:\n    pass`),
    err => err.lineNumber === 5 && err.message.includes("'True'")
  );
});
