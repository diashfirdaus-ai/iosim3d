(() => {
  const VALID_BCM_PINS = new Set([
    0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13,
    14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27
  ]);

  const BOARD_TO_BCM = {
    3: 2, 5: 3, 7: 4, 8: 14, 10: 15, 11: 17, 12: 18, 13: 27,
    15: 22, 16: 23, 18: 24, 19: 10, 21: 9, 22: 25, 23: 11, 24: 8,
    26: 7, 27: 0, 28: 1, 29: 5, 31: 6, 32: 12, 33: 13, 35: 19,
    36: 16, 37: 26, 38: 20, 40: 21
  };

  const PYTHON_KEYWORDS = new Set([
    'True', 'False', 'None', 'and', 'or', 'not',
    'if', 'elif', 'else', 'while', 'for', 'in',
    'def', 'return', 'import', 'from', 'as',
    'pass', 'break', 'continue', 'class', 'try', 'except', 'finally', 'with', 'lambda', 'global'
  ]);

  const RESERVED_NAMES = new Set([
    ...PYTHON_KEYWORDS,
    'GPIO', 'time', 'sensors', 'ITENAS', 'print', 'range'
  ]);

  const GPIO_CONSTANTS = new Set([
    'GPIO.HIGH', 'GPIO.LOW',
    'GPIO.BCM', 'GPIO.BOARD',
    'GPIO.OUT', 'GPIO.IN',
    'GPIO.PUD_UP', 'GPIO.PUD_DOWN'
  ]);

  const SENSOR_METHODS = {
    ultrasonic: [1, 2],
    dht_temp: [1, 1],
    dht_humidity: [1, 1],
    ds18b20: [1, 1],
    bmp280_pressure: [0, 0],
    bmp280_altitude: [0, 0],
    analog: [1, 1],
    servo: [2, 2]
  };

  const BUILTIN_FUNCS = {
    print: [0, Infinity],
    int: [1, 2],
    float: [1, 1],
    str: [0, 1],
    bool: [0, 1],
    abs: [1, 1],
    round: [1, 2],
    min: [1, Infinity],
    max: [1, Infinity],
    len: [1, 1]
  };

  function error(line, message) {
    const e = new SyntaxError(`Baris ${line}: ${message}`);
    e.lineNumber = line;
    return e;
  }

  function cleanLine(rawLine, lineNum) {
    const expanded = rawLine.replace(/\t/g, '    ');
    const firstNonSpace = expanded.search(/\S/);
    if (firstNonSpace === -1) {
      return { indent: 0, text: '' };
    }
    const afterIndent = expanded.slice(firstNonSpace);
    if (afterIndent.startsWith('#')) {
      return { indent: firstNonSpace, text: '' };
    }

    let quote = null;
    let codePart = '';
    const brackets = [];

    for (let i = 0; i < afterIndent.length; i++) {
      const c = afterIndent[i];
      const next = afterIndent[i + 1];

      if (quote) {
        codePart += c;
        if (c === '\\') {
          if (i + 1 >= afterIndent.length) {
            throw error(lineNum, 'Teks belum ditutup dengan tanda kutip.');
          }
          codePart += afterIndent[++i];
          continue;
        }
        if (c === quote) {
          quote = null;
        }
        continue;
      }

      if (c === '#') {
        break;
      }
      if ((c === '/' && next === '/') || (c === '/' && next === '*') || (c === '*' && next === '/')) {
        throw error(lineNum, "Komentar di Python menggunakan tanda '#', bukan '//' atau '/*'.");
      }
      if (c === ';') {
        throw error(lineNum, "Python tidak menggunakan tanda ';' di akhir pernyataan.");
      }
      if (c === '{' || c === '}') {
        throw error(lineNum, "Python menggunakan titik dua ':' dan indentasi, bukan kurung kurawal '{' atau '}'.");
      }
      if ((c === '&' && next === '&') || (c === '|' && next === '|')) {
        throw error(lineNum, "Gunakan operator logika Python 'and' atau 'or', bukan '&&' atau '||'.");
      }
      if (c === '!' && next !== '=') {
        throw error(lineNum, "Gunakan operator 'not' di Python, bukan '!'.");
      }
      if (c === '"' || c === "'") {
        quote = c;
        codePart += c;
        continue;
      }
      if (c === '(' || c === '[') {
        brackets.push(c);
      } else if (c === ')' || c === ']') {
        const expected = c === ')' ? '(' : '[';
        if (brackets.pop() !== expected) {
          throw error(lineNum, 'Tanda kurung penutup tidak sesuai.');
        }
      }
      codePart += c;
    }

    if (quote) {
      throw error(lineNum, 'Teks belum ditutup dengan tanda kutip.');
    }
    if (brackets.length > 0) {
      throw error(lineNum, 'Tanda kurung belum ditutup.');
    }

    return { indent: firstNonSpace, text: codePart.trim() };
  }

  function splitTopLevelArgs(argsText, lineNum) {
    const trimmed = argsText.trim();
    if (!trimmed) return [];

    const args = [];
    let current = '';
    let quote = null;
    let depth = 0;

    for (let i = 0; i < trimmed.length; i++) {
      const c = trimmed[i];
      if (quote) {
        current += c;
        if (c === '\\' && i + 1 < trimmed.length) {
          current += trimmed[++i];
          continue;
        }
        if (c === quote) quote = null;
        continue;
      }
      if (c === '"' || c === "'") {
        quote = c;
        current += c;
        continue;
      }
      if (c === '(' || c === '[') depth++;
      else if (c === ')' || c === ']') depth--;

      if (c === ',' && depth === 0) {
        if (!current.trim()) {
          throw error(lineNum, "Argumen fungsi tidak lengkap pada tanda koma ','.");
        }
        args.push(current.trim());
        current = '';
        continue;
      }
      current += c;
    }

    if (!current.trim()) {
      throw error(lineNum, "Argumen fungsi tidak lengkap setelah tanda koma ','.");
    }
    args.push(current.trim());
    return args;
  }

  function tokenizeExpression(expr, lineNum) {
    const tokens = [];
    let i = 0;
    while (i < expr.length) {
      const c = expr[i];
      if (/\s/.test(c)) {
        i++;
        continue;
      }

      // Optional f-string prefix
      if ((c === 'f' || c === 'F') && (expr[i + 1] === '"' || expr[i + 1] === "'")) {
        const quote = expr[i + 1];
        let str = c + quote;
        i += 2;
        while (i < expr.length && expr[i] !== quote) {
          if (expr[i] === '\\') {
            str += expr[i++];
          }
          str += expr[i++];
        }
        str += expr[i++];
        tokens.push({ type: 'STRING', value: str });
        continue;
      }

      if (c === '"' || c === "'") {
        const quote = c;
        let str = c;
        i++;
        while (i < expr.length && expr[i] !== quote) {
          if (expr[i] === '\\') {
            str += expr[i++];
          }
          str += expr[i++];
        }
        str += expr[i++];
        tokens.push({ type: 'STRING', value: str });
        continue;
      }

      if (/\d/.test(c)) {
        let num = '';
        if (c === '0' && (expr[i + 1] === 'x' || expr[i + 1] === 'X')) {
          num = expr.slice(i, i + 2);
          i += 2;
          while (i < expr.length && /[0-9a-fA-F]/.test(expr[i])) {
            num += expr[i++];
          }
        } else {
          let dots = 0;
          while (i < expr.length && (/\d/.test(expr[i]) || expr[i] === '.')) {
            if (expr[i] === '.') dots++;
            if (dots > 1) throw error(lineNum, 'Format angka desimal tidak valid.');
            num += expr[i++];
          }
        }
        if (i < expr.length && /[A-Za-z_]/.test(expr[i])) {
          throw error(lineNum, ` Penulisan identifier atau angka '${num + expr[i]}' tidak valid.`);
        }
        tokens.push({ type: 'NUMBER', value: num });
        continue;
      }

      const twoChar = expr.slice(i, i + 2);
      if (twoChar === '++' || twoChar === '--') {
        throw error(lineNum, "Operator '++' dan '--' tidak tersedia di Python. Gunakan '+= 1' atau '-= 1'.");
      }
      if (['==', '!=', '<=', '>=', '//', '**'].includes(twoChar)) {
        tokens.push({ type: 'OP', value: twoChar });
        i += 2;
        continue;
      }

      if (c === '=') {
        throw error(lineNum, "Operator '=' tidak valid di dalam ekspresi. Gunakan '==' untuk perbandingan.");
      }

      if (['+', '-', '*', '/', '%', '<', '>'].includes(c)) {
        tokens.push({ type: 'OP', value: c });
        i++;
        continue;
      }

      if (c === '(') { tokens.push({ type: 'LPAREN', value: '(' }); i++; continue; }
      if (c === ')') { tokens.push({ type: 'RPAREN', value: ')' }); i++; continue; }
      if (c === '[') { tokens.push({ type: 'LBRACKET', value: '[' }); i++; continue; }
      if (c === ']') { tokens.push({ type: 'RBRACKET', value: ']' }); i++; continue; }
      if (c === ',') { tokens.push({ type: 'COMMA', value: ',' }); i++; continue; }

      if (/[A-Za-z_]/.test(c)) {
        let ident = '';
        while (i < expr.length && /[A-Za-z0-9_.]/.test(expr[i])) {
          ident += expr[i++];
        }
        if (ident.startsWith('.') || ident.endsWith('.') || ident.includes('..')) {
          throw error(lineNum, `Sintaks atribut '${ident}' tidak valid.`);
        }
        if (ident === 'and' || ident === 'or') {
          tokens.push({ type: 'OP', value: ident });
        } else if (ident === 'not') {
          tokens.push({ type: 'UNARY_OP', value: 'not' });
        } else {
          tokens.push({ type: 'IDENT', value: ident });
        }
        continue;
      }

      throw error(lineNum, `Karakter '${c}' tidak valid di dalam ekspresi.`);
    }
    return tokens;
  }

  function resolvePin(pinExpr, lineNum, state) {
    const trimmed = pinExpr.trim();
    let numericPin = null;
    if (/^\d+$/.test(trimmed)) {
      numericPin = Number(trimmed);
    } else if (state.varValues.has(trimmed)) {
      numericPin = state.varValues.get(trimmed);
    }

    if (numericPin !== null) {
      if (state.gpioMode === 'BOARD') {
        if (!Object.prototype.hasOwnProperty.call(BOARD_TO_BCM, numericPin)) {
          throw error(lineNum, `Nomor pin BOARD '${numericPin}' tidak valid pada header GPIO.`);
        }
        return BOARD_TO_BCM[numericPin];
      }
      if (!VALID_BCM_PINS.has(numericPin)) {
        throw error(lineNum, `Nomor pin GPIO BCM '${numericPin}' tidak valid (gunakan GPIO 0–27).`);
      }
      return numericPin;
    }
    return null;
  }

  function validateCall(callee, argsInput, lineNum, state) {
    const args = Array.isArray(argsInput) ? argsInput : splitTopLevelArgs(argsInput, lineNum);

    if (callee === 'print') {
      for (const arg of args) {
        validateExpression(arg, lineNum, state);
      }
      return;
    }

    if (callee === 'time.sleep' || callee === 'sleep') {
      if (callee === 'time.sleep' && !state.imports.time) {
        throw error(lineNum, "Modul 'time' belum di-import. Tambahkan 'import time' di bagian atas.");
      }
      if (callee === 'sleep' && !state.imports.sleep) {
        throw error(lineNum, "Fungsi 'sleep' belum di-import. Gunakan 'time.sleep()' atau 'from time import sleep'.");
      }
      if (args.length !== 1) {
        throw error(lineNum, `${callee}() membutuhkan tepat 1 argumen durasi detik. Contoh: ${callee}(1)`);
      }
      validateExpression(args[0], lineNum, state);
      return;
    }

    if (callee.startsWith('time.')) {
      const method = callee.slice(5);
      throw error(lineNum, `Fungsi 'time.${method}()' tidak dikenali. Gunakan 'time.sleep(detik)'.`);
    }

    if (callee.startsWith('GPIO.')) {
      if (!state.imports.GPIO) {
        throw error(lineNum, "Modul 'GPIO' belum di-import. Tambahkan 'import RPi.GPIO as GPIO' di bagian atas.");
      }
      const method = callee.slice(5);

      if (method === 'setmode') {
        if (args.length !== 1 || (args[0] !== 'GPIO.BCM' && args[0] !== 'GPIO.BOARD')) {
          throw error(lineNum, 'GPIO.setmode() membutuhkan argumen GPIO.BCM atau GPIO.BOARD.');
        }
        state.gpioMode = args[0] === 'GPIO.BOARD' ? 'BOARD' : 'BCM';
        return;
      }

      if (method === 'setwarnings') {
        if (args.length !== 1) {
          throw error(lineNum, 'GPIO.setwarnings() membutuhkan 1 argumen (True atau False).');
        }
        validateExpression(args[0], lineNum, state);
        return;
      }

      if (method === 'setup') {
        if (!state.gpioMode && !state.insideCallback) {
          throw error(lineNum, "Mode pin belum diatur. Panggil 'GPIO.setmode(GPIO.BCM)' atau 'GPIO.setmode(GPIO.BOARD)' terlebih dahulu.");
        }
        if (args.length < 2 || args.length > 3) {
          throw error(lineNum, 'GPIO.setup() membutuhkan 2 argumen: (pin, GPIO.OUT atau GPIO.IN).');
        }
        validateExpression(args[0], lineNum, state);
        const resolved = resolvePin(args[0], lineNum, state);
        const modeArg = args[1].trim();
        if (modeArg !== 'GPIO.OUT' && modeArg !== 'GPIO.IN') {
          throw error(lineNum, `Argumen ke-2 GPIO.setup() harus berupa GPIO.OUT atau GPIO.IN, bukan '${modeArg}'.`);
        }
        const dir = modeArg === 'GPIO.OUT' ? 'OUT' : 'IN';
        if (resolved !== null) state.pinModes.set(resolved, dir);
        state.pinModes.set(args[0].trim(), dir);
        return;
      }

      if (method === 'output') {
        if (!state.gpioMode && !state.insideCallback) {
          throw error(lineNum, "Mode pin belum diatur. Panggil 'GPIO.setmode(GPIO.BCM)' terlebih dahulu.");
        }
        if (args.length !== 2) {
          throw error(lineNum, 'GPIO.output() membutuhkan 2 argumen: (pin, nilai). Contoh: GPIO.output(led_pin, GPIO.HIGH)');
        }
        validateExpression(args[0], lineNum, state);
        validateExpression(args[1], lineNum, state);
        const resolved = resolvePin(args[0], lineNum, state);
        if (!state.insideCallback) {
          const pinDir = (resolved !== null && state.pinModes.get(resolved)) || state.pinModes.get(args[0].trim());
          if (!pinDir) {
            throw error(lineNum, `Pin '${args[0].trim()}' belum dikonfigurasi. Tambahkan 'GPIO.setup(${args[0].trim()}, GPIO.OUT)' sebelum GPIO.output().`);
          }
          if (pinDir !== 'OUT') {
            throw error(lineNum, `Pin '${args[0].trim()}' dikonfigurasi sebagai GPIO.IN, tidak dapat digunakan pada GPIO.output().`);
          }
        }
        return;
      }

      if (method === 'input') {
        if (!state.gpioMode && !state.insideCallback) {
          throw error(lineNum, "Mode pin belum diatur. Panggil 'GPIO.setmode(GPIO.BCM)' terlebih dahulu.");
        }
        if (args.length !== 1) {
          throw error(lineNum, 'GPIO.input() membutuhkan 1 argumen: (pin).');
        }
        validateExpression(args[0], lineNum, state);
        resolvePin(args[0], lineNum, state);
        return;
      }

      if (method === 'cleanup') {
        if (args.length > 1) {
          throw error(lineNum, 'GPIO.cleanup() maksimal menerima 1 argumen.');
        }
        if (args.length === 1) validateExpression(args[0], lineNum, state);
        return;
      }

      throw error(lineNum, `Fungsi 'GPIO.${method}()' tidak dikenali pada RPi.GPIO.`);
    }

    if (callee.startsWith('sensors.')) {
      const method = callee.slice(8);
      const spec = SENSOR_METHODS[method];
      if (!spec) {
        throw error(lineNum, `Fungsi '${callee}()' tidak dikenali pada modul sensors.`);
      }
      if (args.length < spec[0] || args.length > spec[1]) {
        throw error(lineNum, `Jumlah argumen '${callee}()' tidak sesuai.`);
      }
      for (const arg of args) {
        validateExpression(arg, lineNum, state);
      }
      return;
    }

    if (callee === 'ITENAS.virtualWrite') {
      if (args.length !== 2) {
        throw error(lineNum, 'ITENAS.virtualWrite() membutuhkan 2 argumen: ("V0", nilai).');
      }
      validateExpression(args[0], lineNum, state);
      validateExpression(args[1], lineNum, state);
      return;
    }

    if (callee.startsWith('ITENAS.')) {
      throw error(lineNum, `Fungsi '${callee}()' tidak dikenali. Gunakan 'ITENAS.virtualWrite("V1", nilai)'.`);
    }

    if (Object.prototype.hasOwnProperty.call(BUILTIN_FUNCS, callee)) {
      const [minArgs, maxArgs] = BUILTIN_FUNCS[callee];
      if (args.length < minArgs || args.length > maxArgs) {
        throw error(lineNum, `Jumlah argumen fungsi '${callee}()' tidak sesuai.`);
      }
      for (const arg of args) {
        validateExpression(arg, lineNum, state);
      }
      return;
    }

    if (state.definedFuncs.has(callee)) {
      const paramCount = state.definedFuncs.get(callee);
      if (args.length !== paramCount) {
        throw error(lineNum, `Fungsi '${callee}()' membutuhkan ${paramCount} argumen, tetapi diberikan ${args.length}.`);
      }
      for (const arg of args) {
        validateExpression(arg, lineNum, state);
      }
      return;
    }

    throw error(lineNum, `Fungsi atau perintah '${callee}()' tidak dikenali.`);
  }

  function validateIdentifierValue(ident, lineNum, state) {
    if (ident === 'True' || ident === 'False' || ident === 'None') return;

    if (ident === 'true' || ident === 'false') {
      throw error(lineNum, `Di Python gunakan '${ident === 'true' ? 'True' : 'False'}' (huruf kapital di awal), bukan '${ident}'.`);
    }
    if (ident === 'null' || ident === 'undefined') {
      throw error(lineNum, `Di Python gunakan 'None', bukan '${ident}'.`);
    }
    if (['HIGH', 'LOW', 'BCM', 'BOARD', 'OUT', 'IN'].includes(ident)) {
      throw error(lineNum, `'${ident}' tidak dikenali. Gunakan 'GPIO.${ident}'.`);
    }
    if (ident === 'OUTPUT') {
      throw error(lineNum, "'OUTPUT' adalah sintaks Arduino. Di Python gunakan 'GPIO.OUT'.");
    }
    if (ident === 'INPUT' || ident === 'INPUT_PULLUP') {
      throw error(lineNum, `'${ident}' adalah sintaks Arduino. Di Python gunakan 'GPIO.IN'.`);
    }
    if (PYTHON_KEYWORDS.has(ident)) {
      throw error(lineNum, `Kata kunci '${ident}' tidak dapat digunakan sebagai nilai atau variabel.`);
    }

    if (ident.includes('.')) {
      if (ident.startsWith('GPIO.')) {
        if (!state.imports.GPIO) {
          throw error(lineNum, "Modul 'GPIO' belum di-import. Tambahkan 'import RPi.GPIO as GPIO' di bagian atas.");
        }
        if (GPIO_CONSTANTS.has(ident)) return;
        const member = ident.slice(5);
        if (['setmode', 'setwarnings', 'setup', 'output', 'input', 'cleanup'].includes(member)) {
          throw error(lineNum, `Pemanggilan '${ident}' wajib menggunakan tanda kurung '()'.`);
        }
        throw error(lineNum, `Atribut '${ident}' tidak dikenali pada RPi.GPIO. Gunakan GPIO.HIGH, GPIO.LOW, GPIO.OUT, GPIO.IN, GPIO.BCM, atau GPIO.BOARD.`);
      }
      throw error(lineNum, `Atribut atau perintah '${ident}' tidak dikenali.`);
    }

    if (['print', 'sleep', 'range', 'GPIO', 'time', 'sensors', 'ITENAS'].includes(ident) || state.definedFuncs.has(ident)) {
      throw error(lineNum, `'${ident}' adalah fungsi/modul dan tidak dapat digunakan langsung tanpa tanda kurung '()'.`);
    }

    if (!state.definedVars.has(ident)) {
      throw error(lineNum, `Variabel '${ident}' belum didefinisikan.`);
    }
  }

  function validateExpression(expr, lineNum, state) {
    const trimmed = expr.trim();
    if (!trimmed) {
      throw error(lineNum, 'Ekspresi tidak boleh kosong.');
    }

    const tokens = tokenizeExpression(trimmed, lineNum);
    if (tokens.length === 0) {
      throw error(lineNum, 'Ekspresi tidak boleh kosong.');
    }

    function parseSubTokens(subTokens) {
      let expectOperand = true;
      let idx = 0;

      while (idx < subTokens.length) {
        const tok = subTokens[idx];

        if (expectOperand) {
          if (tok.type === 'UNARY_OP' || (tok.type === 'OP' && (tok.value === '+' || tok.value === '-'))) {
            idx++;
            continue;
          }

          if (tok.type === 'LPAREN') {
            let depth = 1;
            let j = idx + 1;
            while (j < subTokens.length && depth > 0) {
              if (subTokens[j].type === 'LPAREN') depth++;
              else if (subTokens[j].type === 'RPAREN') depth--;
              j++;
            }
            const inner = subTokens.slice(idx + 1, j - 1);
            if (inner.length === 0) {
              throw error(lineNum, "Tanda kurung '()' kosong tidak valid di dalam ekspresi.");
            }
            parseSubTokens(inner);
            idx = j;
            expectOperand = false;
            continue;
          }

          if (tok.type === 'NUMBER' || tok.type === 'STRING') {
            idx++;
            expectOperand = false;
            continue;
          }

          if (tok.type === 'IDENT') {
            if (idx + 1 < subTokens.length && subTokens[idx + 1].type === 'LPAREN') {
              // Function call inside expression: reconstruct balanced (...) text
              let depth = 1;
              let j = idx + 2;
              while (j < subTokens.length && depth > 0) {
                if (subTokens[j].type === 'LPAREN') depth++;
                else if (subTokens[j].type === 'RPAREN') depth--;
                j++;
              }
              // Extract raw args from expression using a helper on the subTokens
              const innerTokens = subTokens.slice(idx + 2, j - 1);
              validateCallFromTokens(tok.value, innerTokens, lineNum, state);
              idx = j;
              expectOperand = false;
              continue;
            }
            validateIdentifierValue(tok.value, lineNum, state);
            idx++;
            expectOperand = false;
            continue;
          }

          throw error(lineNum, `Sintaks ekspresi tidak valid pada '${tok.value}'.`);
        } else {
          if (tok.type === 'OP') {
            idx++;
            expectOperand = true;
            continue;
          }
          throw error(lineNum, `Sintaks ekspresi tidak valid: kurang operator atau tanda koma sebelum '${tok.value}'.`);
        }
      }

      if (expectOperand) {
        throw error(lineNum, 'Ekspresi belum selesai (kurang nilai setelah operator).');
      }
    }

    parseSubTokens(tokens);
  }

  function validateCallFromTokens(callee, innerTokens, lineNum, state) {
    if (innerTokens.length === 0) {
      validateCall(callee, '', lineNum, state);
      return;
    }
    // Split innerTokens by top-level COMMA and reconstruct each argument string
    const argStrings = [];
    let current = [];
    let depth = 0;
    for (const t of innerTokens) {
      if (t.type === 'LPAREN' || t.type === 'LBRACKET') depth++;
      else if (t.type === 'RPAREN' || t.type === 'RBRACKET') depth--;
      if (t.type === 'COMMA' && depth === 0) {
        if (current.length === 0) {
          throw error(lineNum, "Argumen fungsi tidak lengkap pada tanda koma ','.");
        }
        argStrings.push( current.map(x => x.value).join(' ') );
        current = [];
      } else {
        current.push(t);
      }
    }
    if (current.length === 0) {
      throw error(lineNum, "Argumen fungsi tidak lengkap setelah tanda koma ','.");
    }
    argStrings.push(current.map(x => x.value).join(' '));
    validateCall(callee, argStrings, lineNum, state);
  }

  function check(source) {
    const rawLines = source.split(/\r?\n/);
    const state = {
      imports: { GPIO: false, time: false, sleep: false, sensors: false, ITENAS: false },
      gpioMode: null,
      pinModes: new Map(),
      definedVars: new Set(),
      varValues: new Map(),
      definedFuncs: new Map(),
      insideCallback: false
    };

    const indentStack = [0];
    const blockStack = [];
    const activeIfByIndent = new Map();
    let expectIndent = false;
    let expectIndentLine = 1;
    let hasStatements = false;

    for (let i = 0; i < rawLines.length; i++) {
      const lineNum = i + 1;
      const { indent, text } = cleanLine(rawLines[i], lineNum);
      if (!text) continue;

      hasStatements = true;

      if (expectIndent) {
        if (indent <= indentStack[indentStack.length - 1]) {
          throw error(lineNum, "Baris di dalam blok (setelah ':') wajib menjorok ke dalam (indentasi).");
        }
        indentStack.push(indent);
        expectIndent = false;
      } else {
        if (indent > indentStack[indentStack.length - 1]) {
          throw error(lineNum, 'Indentasi tidak sesuai (baris sebelumnya tidak membuka blok baru).');
        }
        while (indent < indentStack[indentStack.length - 1]) {
          const popped = indentStack.pop();
          activeIfByIndent.delete(popped);
          while (blockStack.length > 0 && blockStack[blockStack.length - 1].indent >= indent) {
            const removedBlock = blockStack.pop();
            if (removedBlock.type === 'def') {
              state.insideCallback = blockStack.some(b => b.type === 'def');
            }
          }
        }
        if (indent !== indentStack[indentStack.length - 1]) {
          throw error(lineNum, 'Tingkat indentasi tidak sejajar dengan blok mana pun.');
        }
      }

      const isElif = /^elif(?:\s|:|$)/.test(text);
      const isElse = /^else(?:\s|:|$)/.test(text);
      if (!isElif && !isElse) {
        activeIfByIndent.delete(indent);
      }

      // 1. Check imports
      if (/^(?:import|from)\b/.test(text)) {
        if (/^import\s+(?:RPi|Jetson)\.GPIO\s+as\s+GPIO$/.test(text) || /^from\s+(?:RPi|Jetson)\s+import\s+GPIO$/.test(text)) {
          state.imports.GPIO = true;
          continue;
        }
        if (/^import\s+time$/.test(text)) {
          state.imports.time = true;
          continue;
        }
        if (/^from\s+time\s+import\s+sleep$/.test(text)) {
          state.imports.sleep = true;
          continue;
        }
        if (/^import\s+sensors$/.test(text)) {
          state.imports.sensors = true;
          continue;
        }
        if (/^import\s+ITENAS$/.test(text)) {
          state.imports.ITENAS = true;
          continue;
        }
        throw error(lineNum, "Modul atau sintaks import tidak valid. Gunakan 'import RPi.GPIO as GPIO' atau 'import time'.");
      }

      // Catch common import typos like "imprt ..." or "impot ..."
      if (/^(?:imprt|impot|impor|fromm)\b/.test(text)) {
        throw error(lineNum, "Salah ketik kata kunci 'import' atau 'from'.");
      }

      // Catch C/Arduino/JS type declarations
      if (/^(?:int|float|double|long|bool|boolean|char|String|void|let|const|var)\s+[A-Za-z_]\w*/.test(text)) {
        throw error(lineNum, 'Python tidak menggunakan deklarasi tipe data seperti int, float, void, let, atau const.');
      }

      // Catch "else if" or "elseif"
      if (/^(?:else\s+if|elseif)\b/.test(text)) {
        throw error(lineNum, "Di Python gunakan 'elif', bukan 'else if' atau 'elseif'.");
      }

      // Catch block keywords missing ':'
      if (/^(?:if|elif|else|while|for|def)\b/.test(text) && !text.endsWith(':')) {
        throw error(lineNum, "Pernyataan blok wajib diakhiri dengan tanda titik dua ':'.");
      }

      // 2. Check block headers ending with ':'
      if (text.endsWith(':')) {
        const header = text.slice(0, -1).trim();
        if (!header || header.endsWith(':')) {
          throw error(lineNum, "Sintaks titik dua ':' tidak valid.");
        }

        if (/^if\b/.test(header)) {
          const cond = header.slice(2).trim();
          if (!cond) throw error(lineNum, "Pernyataan 'if' membutuhkan kondisi sebelum ':'.");
          validateExpression(cond, lineNum, state);
          activeIfByIndent.set(indent, true);
          blockStack.push({ type: 'if', indent, line: lineNum });
          expectIndent = true;
          expectIndentLine = lineNum;
          continue;
        }

        if (/^elif\b/.test(header)) {
          if (!activeIfByIndent.get(indent)) {
            throw error(lineNum, "'elif' harus berada setelah blok 'if'.");
          }
          const cond = header.slice(4).trim();
          if (!cond) throw error(lineNum, "Pernyataan 'elif' membutuhkan kondisi sebelum ':'.");
          validateExpression(cond, lineNum, state);
          activeIfByIndent.set(indent, true);
          blockStack.push({ type: 'elif', indent, line: lineNum });
          expectIndent = true;
          expectIndentLine = lineNum;
          continue;
        }

        if (/^else\b/.test(header)) {
          if (header !== 'else') {
            throw error(lineNum, "'else' tidak boleh memiliki kondisi. Gunakan 'elif' atau 'else:'.");
          }
          if (!activeIfByIndent.get(indent)) {
            throw error(lineNum, "'else' harus berada setelah blok 'if' atau 'elif'.");
          }
          activeIfByIndent.delete(indent);
          blockStack.push({ type: 'else', indent, line: lineNum });
          expectIndent = true;
          expectIndentLine = lineNum;
          continue;
        }

        if (/^while\b/.test(header)) {
          const cond = header.slice(5).trim();
          if (!cond) throw error(lineNum, "Pernyataan 'while' membutuhkan kondisi sebelum ':'.");
          validateExpression(cond, lineNum, state);
          blockStack.push({ type: 'while', indent, line: lineNum });
          expectIndent = true;
          expectIndentLine = lineNum;
          continue;
        }

        if (/^for\b/.test(header)) {
          const m = header.match(/^for\s+([A-Za-z_]\w*)\s+in\s+range\s*\(([\s\S]*)\)$/);
          if (!m) {
            throw error(lineNum, "Format perulangan 'for' tidak valid. Gunakan: for i in range(n):");
          }
          const loopVar = m[1];
          if (RESERVED_NAMES.has(loopVar)) {
            throw error(lineNum, `Nama variabel perulangan '${loopVar}' tidak boleh menggunakan kata kunci Python.`);
          }
          const rangeArgs = splitTopLevelArgs(m[2], lineNum);
          if (rangeArgs.length < 1 || rangeArgs.length > 3) {
            throw error(lineNum, 'Fungsi range() membutuhkan 1 sampai 3 argumen.');
          }
          for (const arg of rangeArgs) {
            validateExpression(arg, lineNum, state);
          }
          state.definedVars.add(loopVar);
          blockStack.push({ type: 'for', indent, line: lineNum });
          expectIndent = true;
          expectIndentLine = lineNum;
          continue;
        }

        if (/^def\b/.test(header)) {
          const m = header.match(/^def\s+([A-Za-z_]\w*)\s*\(([\s\S]*)\)$/);
          if (!m) {
            throw error(lineNum, 'Format deklarasi fungsi tidak valid. Gunakan: def nama_fungsi(parameter):');
          }
          const funcName = m[1];
          if (PYTHON_KEYWORDS.has(funcName)) {
            throw error(lineNum, `Nama fungsi '${funcName}' tidak boleh menggunakan kata kunci Python.`);
          }
          const paramsRaw = m[2].trim();
          const params = paramsRaw ? paramsRaw.split(',').map(p => p.trim()) : [];
          for (const p of params) {
            if (!/^[A-Za-z_]\w*$/.test(p) || PYTHON_KEYWORDS.has(p)) {
              throw error(lineNum, `Nama parameter '${p}' pada fungsi '${funcName}' tidak valid.`);
            }
            state.definedVars.add(p);
          }
          state.definedFuncs.set(funcName, params.length);
          if (/^ITENAS_WRITE_V\d+$/.test(funcName)) {
            state.insideCallback = true;
          }
          blockStack.push({ type: 'def', indent, line: lineNum });
          expectIndent = true;
          expectIndentLine = lineNum;
          continue;
        }

        throw error(lineNum, `Pernyataan blok '${header}:' tidak dikenali.`);
      }

      // 3. Simple control statements
      if (text === 'pass') continue;

      if (text === 'break' || text === 'continue') {
        const inLoop = blockStack.some(b => b.type === 'while' || b.type === 'for');
        if (!inLoop) {
          throw error(lineNum, `'${text}' hanya dapat digunakan di dalam perulangan 'while' atau 'for'.`);
        }
        continue;
      }

      if (text === 'return' || /^return\s+/.test(text)) {
        const inDef = blockStack.some(b => b.type === 'def');
        if (!inDef) {
          throw error(lineNum, "'return' hanya dapat digunakan di dalam fungsi 'def'.");
        }
        const retExpr = text.slice(6).trim();
        if (retExpr) validateExpression(retExpr, lineNum, state);
        continue;
      }

      // 4. Variable assignment (excluding ==, !=, <=, >=)
      const assignMatch = text.match(/^([A-Za-z_]\w*)\s*(\+=|-=|\*=|\/=|=(?!=))\s*([\s\S]*)$/);
      if (assignMatch) {
        const varName = assignMatch[1];
        const op = assignMatch[2];
        const rhs = assignMatch[3].trim();

        if (RESERVED_NAMES.has(varName)) {
          throw error(lineNum, `Nama '${varName}' adalah kata kunci/modul bawaan dan tidak dapat diubah nilainya.`);
        }
        if (!rhs) {
          throw error(lineNum, `Nilai untuk variabel '${varName}' tidak boleh kosong.`);
        }
        if (op !== '=' && !state.definedVars.has(varName)) {
          throw error(lineNum, `Variabel '${varName}' belum didefinisikan sebelum menggunakan '${op}'.`);
        }

        validateExpression(rhs, lineNum, state);
        state.definedVars.add(varName);

        if (op === '=' && /^\d+$/.test(rhs)) {
          state.varValues.set(varName, Number(rhs));
        } else {
          state.varValues.delete(varName);
        }
        continue;
      }

      // Check invalid left-hand side assignment (e.g. "GPIO.HIGH = 1" or "18 = led_pin" or "a + b = 1")
      if (/(?<![=!<>])=(?!=)/.test(text.replace(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'/g, ''))) {
        throw error(lineNum, 'Target assignment (sebelah kiri tanda "=") harus berupa nama variabel yang valid.');
      }

      // 5. Standalone function / method call
      const callMatch = text.match(/^([A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*)\s*\(([\s\S]*)\)$/);
      if (callMatch) {
        const callee = callMatch[1];
        const inner = callMatch[2];
        // Ensure the opening '(' actually matches the final ')' at the end of the line
        let quote = null;
        let depth = 0;
        let closedEarly = false;
        for (let k = 0; k < inner.length; k++) {
          const ch = inner[k];
          if (quote) {
            if (ch === '\\') { k++; continue; }
            if (ch === quote) quote = null;
            continue;
          }
          if (ch === '"' || ch === "'") { quote = ch; continue; }
          if (ch === '(') depth++;
          else if (ch === ')') {
            depth--;
            if (depth < 0) { closedEarly = true; break; }
          }
        }
        if (!closedEarly) {
          validateCall(callee, inner, lineNum, state);
          continue;
        }
      }

      // Check Python 2 style print without parens
      if (/^print\s+/.test(text)) {
        throw error(lineNum, "Gunakan tanda kurung pada 'print(...)' di Python 3.");
      }

      throw error(lineNum, `Pernyataan '${text}' tidak valid atau perintah tidak dikenali.`);
    }

    if (!hasStatements) {
      throw error(1, 'Kode program masih kosong.');
    }

    if (expectIndent) {
      throw error(expectIndentLine, "Blok setelah ':' tidak boleh kosong.");
    }

    return true;
  }

  window.PythonSyntax = { check };
})();
