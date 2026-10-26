(() => {
  const values = {220:['220 Ω','#ef4444','#ef4444','#92400e'],330:['330 Ω','#fb923c','#fb923c','#92400e'],1000:['1 kΩ','#92400e','#171717','#ef4444'],4700:['4,7 kΩ','#eab308','#a855f7','#ef4444'],10000:['10 kΩ','#92400e','#171717','#fb923c']};
  const safe = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function template(uid) {
    const id=safe(uid);
    return `<div class="btn-delete-comp"><i class="fas fa-times"></i></div><div class="component-header">Resistor <span class="resistor-value">220 Ω</span></div><div class="resistor-content"><div class="resistor-drawing"><div class="pin resistor-terminal" data-pin-id="res_a_${id}" data-pin-name="res_a" title="Terminal A"></div><span class="resistor-lead"></span><div class="resistor-body" role="img" aria-label="Resistor 220 ohm, toleransi 5 persen"><i></i><i></i><i></i><i class="tolerance"></i></div><span class="resistor-lead"></span><div class="pin resistor-terminal" data-pin-id="res_b_${id}" data-pin-name="res_b" title="Terminal B"></div></div><label>Nilai <select class="resistor-select ignore-drag" aria-label="Nilai resistor">${Object.entries(values).map(([v,data])=>`<option value="${v}">${data[0]}</option>`).join('')}</select></label><small>GPIO → resistor → anoda LED<br>Katode LED → GND · tanpa polaritas<br>Simulasi logika; arus belum dihitung.</small></div>`;
  }
  function configure(component, value) {
    const number=Number(value);
    const chosen=Object.hasOwn(values,number)?number:220;
    component.setAttribute('data-value',chosen);
    component.querySelector('.resistor-select').value=String(chosen);
    component.querySelector('.resistor-value').textContent=values[chosen][0];
    const bands=component.querySelectorAll('.resistor-body i');
    values[chosen].slice(1).forEach((color,i)=>bands[i].style.backgroundColor=color);
    component.querySelector('.resistor-body').setAttribute('aria-label',`Resistor ${values[chosen][0]}, toleransi 5 persen`);
  }
  // Logical connectivity through passive resistors. Not an analog current solver.
  function network(wires, resistors, levels) {
    const links=new Map(), pins=new Map();
    function add(a,b){if(!a||!b)return;const x=a.getAttribute('data-pin-id'),y=b.getAttribute('data-pin-id');if(!x||!y)return;pins.set(x,a);pins.set(y,b);if(!links.has(x))links.set(x,new Set());if(!links.has(y))links.set(y,new Set());links.get(x).add(y);links.get(y).add(x);}
    for(const wire of wires)add(wire.pin1,wire.pin2);
    for(const r of resistors){const value=Number(r.getAttribute('data-value'));if(!Number.isFinite(value)||value<=0)continue;const endpoints=r.querySelectorAll('.resistor-terminal');add(endpoints[0],endpoints[1]);}
    return {hasLevel(id,level){const seen=new Set(),queue=[id];for(let i=0;i<queue.length;i++){const current=queue[i];if(seen.has(current))continue;seen.add(current);const pin=pins.get(current);if(pin?.closest('.component[data-type="esp32"],.component[data-type="arduino"],.component[data-type="raspi"],.component[data-type="jetson"]')&&levels[pin.getAttribute('data-pin-name')]===level)return true;for(const next of links.get(current)||[])if(!seen.has(next))queue.push(next);}return false;}};
  }
  window.LabResistor={template,configure,network};
  if(typeof document!=='undefined')document.addEventListener('change',event=>{
    if(!event.target.matches('.resistor-select'))return;
    configure(event.target.closest('.component'),event.target.value);
    window.iotEngine?.evaluateCircuit?.();
  });
})();
