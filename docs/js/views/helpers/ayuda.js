/**
 * Ayuda — Guías y normativas modales
 * Extraído de app.js para modularización (Fase 3)
 * Contiene: _mostrarAyudaMedicamentos, _mostrarAyudaCrotales, _mostrarGuiaNormativas
 */
window.Ayuda = {
  mostrarMedicamentos() {
    if (document.getElementById('ayuda-med-overlay')) return;

    const MEDICAMENTOS = [
      { cat:'Antiparasitarios', principio:'Ivermectina', carne:'11–28 días', leche:'NO USAR', lecheCls:'danger' },
      { cat:'Antiparasitarios', principio:'Moxidectina', carne:'14 días', leche:'14 días', lecheCls:'warn' },
      { cat:'Antiparasitarios', principio:'Albendazol', carne:'7–9 días', leche:'7 días', lecheCls:'warn' },
      { cat:'Antiparasitarios', principio:'Fenbendazol', carne:'6 días', leche:'0–4 días', lecheCls:'safe' },
      { cat:'Antiparasitarios', principio:'Deltametrina', carne:'1–3 días', leche:'0 días', lecheCls:'safe' },
      { cat:'Antiparasitarios', principio:'Closantel', carne:'21–30 días', leche:'NO USAR', lecheCls:'danger' },
      { cat:'Antiparasitarios', principio:'Praziquantel', carne:'3–7 días', leche:'24 h', lecheCls:'safe' },
      { cat:'Antiparasitarios', principio:'Levamisol', carne:'5–7 días', leche:'3–5 días', lecheCls:'warn' },
      { cat:'Antibióticos', principio:'Oxitetraciclina LA', carne:'21–28 días', leche:'6–8 días', lecheCls:'warn' },
      { cat:'Antibióticos', principio:'Penicilina Benzatínica', carne:'9–14 días', leche:'3–6 días', lecheCls:'warn' },
      { cat:'Antibióticos', principio:'Tulatromicina', carne:'28–35 días', leche:'NO USAR', lecheCls:'danger' },
      { cat:'Antibióticos', principio:'Amoxicilina LA', carne:'28 días', leche:'7 días', lecheCls:'warn' },
      { cat:'Antibióticos', principio:'Tilosina', carne:'10–14 días', leche:'4–6 días', lecheCls:'warn' },
      { cat:'Antibióticos', principio:'Florfenicol', carne:'28–35 días', leche:'NO USAR', lecheCls:'danger' },
      { cat:'Antibióticos', principio:'Danofloxacino', carne:'10–12 días', leche:'5–7 días', lecheCls:'warn' },
      { cat:'Antibióticos', principio:'Ceftiofur', carne:'3–5 días', leche:'2–3 días', lecheCls:'safe' },
      { cat:'Antibióticos', principio:'Sulfadiazina-Trimetoprim', carne:'7–10 días', leche:'4–6 días', lecheCls:'warn' },
      { cat:'Antiinflamatorios', principio:'Meloxicam', carne:'5–15 días', leche:'2–5 días', lecheCls:'warn' },
      { cat:'Antiinflamatorios', principio:'Flunixino Meglumina', carne:'10–14 días', leche:'3–5 días', lecheCls:'warn' },
      { cat:'Antiinflamatorios', principio:'Dexametasona', carne:'7–14 días', leche:'3–5 días', lecheCls:'warn' },
      { cat:'Antiinflamatorios', principio:'Prednisolona', carne:'5–7 días', leche:'2–3 días', lecheCls:'safe' },
      { cat:'Anestésicos/Sedantes', principio:'Xilacina', carne:'3–5 días', leche:'2–3 días', lecheCls:'safe' },
      { cat:'Anestésicos/Sedantes', principio:'Ketamina', carne:'3 días', leche:'1 día', lecheCls:'safe' },
      { cat:'Anestésicos/Sedantes', principio:'Lidocaína', carne:'3 días', leche:'1 día', lecheCls:'safe' },
      { cat:'Suplementos', principio:'Vit. A, D3, E', carne:'0 días', leche:'0 días', lecheCls:'safe' },
      { cat:'Suplementos', principio:'Propilenglicol', carne:'0 días', leche:'0 días', lecheCls:'safe' },
      { cat:'Suplementos', principio:'Selenio + Vit. E', carne:'0 días', leche:'0 días', lecheCls:'safe' },
      { cat:'Biológicos', principio:'Vacuna Clostridial', carne:'0–21 días', leche:'0 días', lecheCls:'safe' },
      { cat:'Biológicos', principio:'Vacuna Abortos (Clamidia/Toxo)', carne:'0 días', leche:'0 días', lecheCls:'safe' },
      { cat:'Antimicóticos', principio:'Nistatina', carne:'0 días', leche:'0 días', lecheCls:'safe' },
      { cat:'Antimicóticos', principio:'Natamicina', carne:'0 días', leche:'0 días', lecheCls:'safe' },
    ];

    const lecheClsColor = { safe: 'var(--c-success)', warn: 'var(--c-warning)', danger: 'var(--c-danger)' };

    const overlay = document.createElement("div");
    overlay.id = "ayuda-med-overlay";
    overlay.className = "wizard-full-screen";
    overlay.style.zIndex = "6000";
    overlay.innerHTML = `
      <div class="wizard-header-fixed flex justify-between items-center border-top-5-danger">
        <h2 class="m-0 font-black text-white uppercase tracking-wide" style="font-size: 1.3rem;">Guía Farmacológica</h2>
        <button id="med-close-btn" class="btn-overlay-close font-bold text-red"></button>
      </div>
      <div class="wizard-content-scrollable flex flex-col wizard-body-text">

        <div class="rounded-sm nota-box nota-box-red mb-20">
          <strong>Nota importante:</strong> Los tiempos de retiro varían según vía de administración, dosis y marca comercial.
          Usa siempre estos valores como referencia general y <strong class="text-white">verifica la etiqueta del fabricante</strong>.
        </div>

        <!-- Buscador -->
        <div class="mb-12">
          <input type="text" id="med-search-input" placeholder="Buscar por principio activo o categoría…"
            class="w-full bg-darker border-muted rounded-10 text-white p-12" style="font-size:0.9rem; outline:none; box-sizing:border-box;">
        </div>

        <!-- Filtros rápidos -->
        <div id="med-filtros" class="flex gap-8 flex-wrap mb-15">
          ${['Todas','Antiparasitarios','Antibióticos','Antiinflamatorios','Anestésicos/Sedantes','Suplementos','Biológicos','Antimicóticos']
            .map((c,i) => `<span data-cat="${c}" class="med-chip text-xs text-ccc bg-darker" style="cursor:pointer; padding:4px 14px; border:1px solid ${i===0?'var(--c-danger)':'#333'}; border-radius:20px; transition:0.15s;">${c}</span>`).join('')}
        </div>

        <h3 class="text-red mt-0 mb-10">Tiempos de Retiro Promedio <span id="med-count" class="font-normal text-xs text-gray">— ${MEDICAMENTOS.length} fármacos</span></h3>
        <div class="mb-25 scroll-shadow-container" style="overflow-x: auto; flex-shrink:0;">
          <table class="ayuda-table" style="min-width: 500px;">
            <thead>
              <tr style="background: #18181b; border-bottom: 2px solid var(--c-danger); position:sticky; top:0;">
                <th class="p-10">Categoría</th>
                <th class="p-10">Principio Activo</th>
                <th class="p-10">Retiro (Carne)</th>
                <th class="p-10">Retiro (Leche)</th>
              </tr>
            </thead>
            <tbody id="med-tbody"></tbody>
          </table>
        </div>

        <!-- Calculadora dosificación -->
        <div class="sec-divider-top mb-25">
          <h3 class="text-green mt-0 mb-15">Calculadora de Dosificación</h3>
          <div class="grid grid-cols-2 gap-12 bg-darker p-12 rounded-10">
            <div>
              <label class="text-gray text-75 mb-4 block">Peso Vivo (kg)</label>
              <input type="number" id="calc-peso" value="50" min="1" step="0.1" class="w-full p-10 rounded-sm bg-card border-muted text-white"
                style="font-size:1rem; box-sizing:border-box;">
            </div>
            <div>
              <label class="text-gray text-75 mb-4 block">Dosis (mg/kg)</label>
              <input type="number" id="calc-dosis" value="10" min="0.1" step="0.1" class="w-full p-10 rounded-sm bg-card border-muted text-white"
                style="font-size:1rem; box-sizing:border-box;">
            </div>
            <div>
              <label class="text-gray text-75 mb-4 block">Concentración (mg/ml)</label>
              <input type="number" id="calc-conc" value="100" min="0.1" step="1" class="w-full p-10 rounded-sm bg-card border-muted text-white"
                style="font-size:1rem; box-sizing:border-box;">
            </div>
            <div class="flex-col-end">
              <button id="calc-btn" class="btn btn-success w-full p-12 rounded-sm font-bold text-white">Calcular Volumen</button>
            </div>
          </div>
          <div id="calc-result" class="text-center" style="padding:15px 0;">
            <span class="text-green" style="font-size:1.8rem; font-weight:900;">5.00 ml</span>
            <div class="text-75 text-gray mt-4">Volumen a administrar</div>
          </div>
        </div>

        <!-- Consejos -->
        <div class="grid grid-cols-2 gap-15 mb-20">
          <div class="bg-darker rounded-10 p-15">
            <h4 class="text-amber mt-0 mb-8 text-85">Consejos</h4>
            <ul class="text-aaa text-82 ul-list">
              <li><strong>Dosifica por el más pesado</strong> — evita subdosificar calculando promedios.</li>
              <li><strong>% → mg/ml:</strong> multiplica el % por 10 (ej: 5% = 50 mg/ml).</li>
              <li><strong>Efecto acumulativo:</strong> repetir dosis extiende el retiro.</li>
              <li><strong>Uso extra-etiqueta:</strong> medicamento de bovino en ovino → retiro carne mínimo 28 días.</li>
            </ul>
          </div>
          <div class="bg-darker rounded-10 p-15">
            <h4 class="text-blue mt-0 mb-8 text-85">Buenas Prácticas</h4>
            <ul class="text-aaa text-82 ul-list">
              <li><strong>Registra cada tratamiento</strong> — fecha, producto, lote y tiempo de espera.</li>
              <li><strong>Identifica los animales</strong> tratados con crotal o marca visible.</li>
              <li><strong>No mezcles</strong> leche de animales en retiro con la leche apta.</li>
              <li><strong>Calibración:</strong> prueba el dosificador con agua destilada antes.</li>
            </ul>
          </div>
        </div>

        <div class="text-center mb-10 nota-box nota-box-blue" style="font-size:0.8rem; color:#93c5fd;">
          <strong>Ovino:</strong> los tiempos de retiro pueden diferir de bovino o caprino.
          Verifica siempre con tu veterinario ADSG y la etiqueta del laboratorio.
        </div>

      </div>
    `;
    document.body.appendChild(overlay);

    // === Event listeners (evitan closure scope issues con inline handlers) ===

    // Cerrar
    overlay.querySelector('#med-close-btn').addEventListener('click', () => overlay.remove());

    // Buscador en vivo
    const searchInput = overlay.querySelector('#med-search-input');
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase();
      const rows = MEDICAMENTOS.filter(m => !q || m.principio.toLowerCase().includes(q) || m.cat.toLowerCase().includes(q));
      const tbody = overlay.querySelector('#med-tbody');
      tbody.innerHTML = rows.map(m => `
        <tr>
          <td class="p-10 text-gray nowrap">${m.cat}</td>
          <td class="p-10 font-bold">${m.principio}</td>
          <td class="p-10 text-amber">${m.carne}</td>
          <td class="p-10" style="color:${lecheClsColor[m.lecheCls] || '#ccc'}; ${m.lecheCls === 'danger' ? 'font-weight:bold; background:rgba(239,68,68,0.15);' : ''}">${m.leche}</td>
        </tr>`).join('');
      const count = overlay.querySelector('#med-count');
      count.textContent = rows.length < MEDICAMENTOS.length ? `— ${rows.length} de ${MEDICAMENTOS.length}` : `— ${MEDICAMENTOS.length} fármacos`;
    });

    // Filtros rápidos por categoría
    overlay.querySelectorAll('#med-filtros .med-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        overlay.querySelectorAll('.med-chip').forEach(c => { c.style.borderColor = '#333'; });
        chip.style.borderColor = 'var(--c-danger)';
        const cat = chip.dataset.cat;
        searchInput.value = cat === 'Todas' ? '' : cat;
        searchInput.dispatchEvent(new Event('input'));
      });
    });

    // Calculadora de dosificación
    const calcPeso = overlay.querySelector('#calc-peso');
    const calcDosis = overlay.querySelector('#calc-dosis');
    const calcConc = overlay.querySelector('#calc-conc');
    const calcResult = overlay.querySelector('#calc-result');
    const calcular = () => {
      const p = parseFloat(calcPeso.value) || 0;
      const d = parseFloat(calcDosis.value) || 0;
      const c = parseFloat(calcConc.value) || 1;
      const v = ((p * d) / c).toFixed(2);
      calcResult.innerHTML = v > 0
        ? `<span class="text-green" style="font-size:1.8rem; font-weight:900;">${v} ml</span><div class="text-75 text-gray mt-4">Volumen a administrar</div>`
        : '<span class="text-red">Introduce valores válidos</span>';
    };
    overlay.querySelector('#calc-btn').addEventListener('click', calcular);
    [calcPeso, calcDosis, calcConc].forEach(el => el.addEventListener('input', calcular));
    calcular(); // ejecutar ejemplo inicial
    searchInput.dispatchEvent(new Event('input')); // renderizar tabla inicial
  },

  mostrarCrotales() {
    if (document.getElementById('ayuda-crotales-overlay')) return;
    const overlay = document.createElement("div");
    overlay.id = "ayuda-crotales-overlay";
    overlay.className = "wizard-full-screen";
    overlay.style.zIndex = "6000";
    overlay.innerHTML = `
      <div class="wizard-header-fixed flex justify-between items-center border-top-5-success">
        <h2 class="mt-0 uppercase font-black text-white" style="font-size: 1.3rem; letter-spacing: 1px;">${Icons.libro()} Normativa Crotales</h2>
        <button onclick="this.closest('.wizard-full-screen').remove()" class="btn-overlay-close font-bold text-green"></button>
      </div>
      <div class="wizard-content-scrollable wizard-body-text">

        <div class="rounded-sm mb-20 nota-box nota-box-green">
            <strong>Marco Legal:</strong> El sistema de identificación para ganado ovino y caprino se rige por el Real Decreto 787/2023 y modificaciones, estableciendo trazabilidad individual obligatoria.
        </div>

        <h3 class="text-green mb-10" class="section-underline">Doble Identificación Obligatoria</h3>
        <div class="grid grid-cols-2 gap-10 mb-20">
            <div class="rounded-sm bg-card p-15 border-muted">
                <h4 class="mt-0 mb-10 text-gold">Oreja Derecha</h4>
                <p class="mt-0 text-sm text-ccc"><strong>Crotal Visual:</strong> De tipo bandera o botón, en color amarillo (RAL 1016). Muestra el código de identificación visible a distancia.</p>
            </div>
            <div class="rounded-sm bg-card p-15 border-muted">
                <h4 class="mt-0 mb-10 text-blue">Oreja Izquierda</h4>
                <p class="mt-0 text-sm text-ccc"><strong>Crotal Electrónico:</strong> Dispositivo RFID (botón) que contiene el código único del animal, permitiendo lecturas automatizadas (SIA/PIGGAN).</p>
        </div>

        <h3 class="text-gold mb-10" class="section-underline">Estructura del Código Oficial</h3>
        <div class="rounded-sm border-muted text-center mb-25 bg-card p-15" style="font-family:monospace; font-size:1.5rem; letter-spacing:2px;">
            <span class="text-red">ES</span> <span class="text-green">01</span> <span class="text-white">1234567890</span>
        </div>
        <ul class="text-sm mb-25 pl-20 text-ccc">
            <li><strong class="text-red">ES:</strong> Código de país (España).</li>
            <li><strong class="text-green">01/10:</strong> Código de Comunidad Autónoma (01 = Andalucía, 10 = Extremadura).</li>
            <li><strong class="text-white">1234567890:</strong> Numeración individual correlativa (10 dígitos).</li>
        </ul>

        <h3 class="text-blue mb-10" class="section-underline">Plazos de Identificación</h3>
        <div class="mb-25 scroll-shadow-container" style="overflow-x: auto;">
        <table class="ayuda-table" style="min-width: 400px;">
            <thead>
                <tr style="background: #18181b; border-bottom: 2px solid var(--c-info);">
                    <th class="p-10">Sistema de Cría</th>
                    <th class="p-10">Plazo Máximo Legal</th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="p-10 text-ccc">Intensivo / Semi-extensivo</td>
                    <td class="p-10 font-bold text-amber">6 meses de vida</td>
                </tr>
                <tr>
                    <td class="p-10 text-ccc">Extensivo (Pasto libre)</td>
                    <td class="p-10 font-bold text-green">9 meses de vida</td>
                </tr>
                <tr>
                    <td class="p-10 text-ccc">Venta / Traslado</td>
                    <td class="p-10 font-bold text-red">Antes de abandonar la explotación</td>
                </tr>
            </tbody>
        </table>
        </div>

        <div class="rounded-sm p-15 border-left-violet">
            <h4 class="text-purple m-0 mb-4">Excepción: Destino Directo a Matadero</h4>
            <p class="text-85 text-aaa m-0">Los animales destinados a sacrificio antes de los 12 meses pueden identificarse con un único <strong>crotal visual en la oreja derecha</strong> que contenga el Código REGA de la explotación de nacimiento.</p>
        </div>

      </div>
    `;
    document.body.appendChild(overlay);
  },

  /**
   * Muestra guía comparativa de normativas autonómicas (Andalucía / Extremadura)
   */
  mostrarGuiaNormativas() {
    if (document.getElementById('guia-normativas-overlay')) return;
    const CS = window.ComunidadesService;
    const and = CS ? CS.getConfiguracionCCAA('andalucia') : null;
    const ext = CS ? CS.getConfiguracionCCAA('extremadura') : null;

    const overlay = document.createElement("div");
    overlay.id = "guia-normativas-overlay";
    overlay.className = "wizard-full-screen";
    overlay.style.zIndex = "6000";
    overlay.innerHTML = `
      <div class="wizard-header-fixed flex justify-between items-center border-top-5-violet">
        <h2 class="text-white font-black uppercase mt-0" style="font-size:1.3rem; letter-spacing:1px;">${Icons.libro()} Comparativa Normativa CCAA</h2>
        <button onclick="this.closest('.wizard-full-screen').remove()" class="btn-overlay-close text-purple font-bold"></button>
      </div>
      <div class="wizard-content-scrollable text-base text-zinc-200 wizard-body-text">

        <div class="rounded-sm mb-20 text-sm nota-box nota-box-purple">
          <strong>Marco Legal:</strong> Cada Comunidad Autónoma tiene competencias en sanidad animal, movimiento pecuario y ayudas PAC. Conoce las diferencias clave entre tus zonas de operación.
        </div>

        <h3 class="text-purple mb-15" style="border-bottom:1px solid #333; padding-bottom:8px;">Andalucía vs Extremadura</h3>

        <div class="grid grid-cols-2 gap-15 mb-20">
          <!-- Andalucía -->
          <div class="rounded-md bg-card p-15 border-muted border-gold">
            <h4 class="text-gold mt-0 mb-12 text-lg">Andalucía</h4>
            <div class="grid gap-8 text-82">
              <div><span class="text-gray">Sistema Mov.:</span> <strong class="text-white">${and?.sistema_movimiento || 'SIGGAN'}</strong></div>
              <div><span class="text-gray">Dist. Mín. REGA:</span> <strong class="text-white">${and?.distancia_minima_REGA_m || 500} m</strong></div>
              <div><span class="text-gray">Umbral PAC:</span> <strong class="text-white">${and?.umbral_PAC_corderos_oveja || 0.6} cord/oveja/año</strong></div>
              <div><span class="text-gray">Plataforma:</span> <strong class="text-white">${and?.plataforma || 'PIMA'}</strong></div>
              <div><span class="text-gray">Guía Sanitaria:</span> <strong class="text-green">Automática (365 días)</strong></div>
              <div><span class="text-gray">Subvención ADSG:</span> <strong class="text-green">Directa</strong></div>
            </div>
          </div>
          <!-- Extremadura -->
          <div class="rounded-md bg-card p-15 border-muted border-blue">
            <h4 class="text-blue mt-0 mb-12 text-lg">Extremadura</h4>
            <div class="grid gap-8 text-82">
              <div><span class="text-gray">Sistema Mov.:</span> <strong class="text-white">${ext?.sistema_movimiento || 'BADIGEX'}</strong></div>
              <div><span class="text-gray">Dist. Mín. REGA:</span> <strong class="text-white">${ext?.distancia_minima_REGA_m || 1000} m</strong></div>
              <div><span class="text-gray">Umbral PAC:</span> <strong class="text-white">${ext?.umbral_PAC_corderos_oveja || 0.4} cord/oveja/año</strong></div>
              <div><span class="text-gray">Plataforma:</span> <strong class="text-white">${ext?.plataforma || 'Arado/Laboreo'}</strong></div>
              <div><span class="text-gray">Guía Sanitaria:</span> <strong class="text-yellow">Requiere confirmación</strong></div>
              <div><span class="text-gray">Subvención ADSG:</span> <strong class="text-yellow">Control estricto</strong></div>
            </div>
          </div>
        </div>

        <h3 class="text-green mb-10" class="section-underline">Impacto en la Gestión Diaria</h3>
        <ul class="mb-20 text-sm text-ccc pl-20">
          <li class="mb-8"><strong>Guías de Movimiento:</strong> En Andalucía se emiten automáticamente si el animal está saneado. En Extremadura requieren confirmación del veterinario ADSG.</li>
          <li class="mb-8"><strong>PAC 2026:</strong> Andalucía exige 0.6 corderos/oveja/año para cobrar el eco-régimen; Extremadura 0.4. Ajusta tus declaraciones.</li>
          <li class="mb-8"><strong>Vacunación:</strong> Andalucía subvenciona directamente las vacunas (paga la Junta). Extremadura las incluye como cláusula de fuerza mayor en PAC.</li>
          <li class="mb-8"><strong>Distancia Mínima REGA:</strong> Entre explotaciones: 500m en Andalucía, 1000m en Extremadura. Crítico para nuevas altas.</li>
          <li class="mb-8"><strong>Cadena de Frío:</strong> Obligatorio en ambas: leche de 37°C a &lt;4°C en menos de 2 horas. Sin excepciones.</li>
        </ul>

        <h3 class="text-yellow mb-10" class="section-underline">Enlaces de Interés</h3>
        <div class="grid gap-8 text-sm mb-20">
          <a href="${and?.url_tramitacion || '#'}" target="_blank" class="text-gold flex items-center gap-6" class="no-underline">
            Junta de Andalucía — Trámites Sanitarios
          </a>
          <a href="${ext?.url_tramitacion || '#'}" target="_blank" class="text-blue flex items-center gap-6" class="no-underline">
            DOE — Normativa Extremeña
          </a>
        </div>

      </div>
    `;
    document.body.appendChild(overlay);
  }
};
