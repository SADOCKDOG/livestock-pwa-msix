/**
 * Wizard Pedido de Crotales — generación de documento oficial ADSG
 * Extraído de app.js para modularización
 */
window.WizardCrotales = {
  async abrir(borrador = null) {
    return this.abrirPedido(borrador);
  },
  async abrirPedido(borrador = null) {
    const finca = await Fincas.getActive();
    if (!finca) { App.toastError("No hay finca activa"); return; }

    // Validación previa del REGA de la explotación (SIGGAN)
    const CS = window.ComunidadesService;
    const regaFinca = finca.codigo_REGA || finca.rega || '';
    if (CS) {
      const ccaa = finca.comunidad_autonoma || null;
      if (!regaFinca) {
        App.toastError("La explotación no tiene código REGA. Complétalo antes de pedir crotales.");
        return;
      }
      const res = CS.validarFormatoREGA(regaFinca, ccaa);
      if (!res.valido) {
        App.toastError("REGA de la explotación inválido: " + res.mensaje);
        return;
      }
    }
    const especiesPedido = CS ? CS.getEspeciesAutorizables() : ['Bovino', 'Ovino', 'Caprino'];

    const wizardSteps = [
      {
        content: (data) => `
          <div class="card card-accent card-accent-green p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-success)">${Icons.paquete()} MATERIAL SOLICITADO</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">ESPECIE</label>
              <select id="w-pd-especie" class="wizard-input font-800">
                ${especiesPedido.map(e => `<option value="${e}" ${data.especie === e ? "selected" : ""}>${e.toUpperCase()}</option>`).join("")}
              </select>
            </div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">TIPO DE CROTAL / MATERIAL</label>
              <select id="w-pd-tipo" class="wizard-input font-800">
                <option value="Bandera + Botón (EID)" ${data.tipo === "Bandera + Botón (EID)" ? "selected" : ""}>BANDERA + BOTÓN (ELECTRÓNICO)</option>
                <option value="Botón + Botón (EID)" ${data.tipo === "Botón + Botón (EID)" ? "selected" : ""}>BOTÓN + BOTÓN (ELECTRÓNICO)</option>
                <option value="Bolo Ruminal + Botón Visual" ${data.tipo === "Bolo Ruminal + Botón Visual" ? "selected" : ""}>BOLO RUMINAL + BOTÓN VISUAL</option>
                <option value="Crotal Visual Clásico" ${data.tipo === 'Crotal Visual Clásico' ? 'selected' : ''}>CROTAL VISUAL CLÁSICO</option>
              </select>
            </div>
            <div class="wizard-input-group mb-10">
              <label class="wizard-label">CANTIDAD DE PARES</label>
              <input type="number" id="w-pd-cant" value="${data.cantidad}" class="wizard-input font-900" min="1" step="1">
            </div>
            <div class="p-10 bg-black-opacity-30 rounded-sm">
                <p class="text-[0.6rem] text-aaa uppercase font-700 m-0 text-center">
                    Los crotales electrónicos (EID) son obligatorios para nuevas incorporaciones según RD 787/2023.
                </p>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.tipo = document.getElementById('w-pd-tipo')?.value || data.tipo;
          data.especie = document.getElementById('w-pd-especie')?.value || data.especie;
          data.cantidad = parseInt(document.getElementById('w-pd-cant')?.value) || 0;
        },
        validate: async (data) => {
          if (data.cantidad <= 0) { App.toastError("Cantidad debe ser mayor a 0"); return false; }
          return true;
        }
      },
      {
        content: async (data) => {
          const adsgs = await window.ADSGs.list().catch(() => []);
          return `
            <div class="card card-accent card-accent-blue p-16 mt-10">
              <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">${Icons.edificio()} DESTINO Y ADSG</div>
              
              ${adsgs.length > 0 ? `
              <div class="wizard-input-group mb-14">
                <label class="wizard-label">SELECCIONAR ADSG REGISTRADA</label>
                <select id="w-pd-adsg-select" class="wizard-input text-sm font-800" onchange="WizardCrotales._onSelectADSG(this.value)">
                  <option value="">-- Escribir manualmente --</option>
                  ${adsgs.map(a => `<option value="${a.id}" ${data.adsg_codigo === a.codigo ? 'selected' : ''}>${a.nombre} (${a.codigo})</option>`).join('')}
                </select>
              </div>
              ` : ''}

              <div class="wizard-input-group mb-12">
                <label class="wizard-label">DESTINATARIO (ADSG / OCA) *</label>
                <input type="text" id="w-pd-adsg" value="${data.adsg_nombre || ''}" placeholder="EJ: ADSG SIERRA NORTE" class="wizard-input uppercase font-800">
              </div>
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">CÓDIGO ADSG</label>
                <input type="text" id="w-pd-adsg-cod" value="${data.adsg_codigo || ''}" placeholder="OPCIONAL" class="wizard-input uppercase font-800">
              </div>
              <div class="wizard-input-group mb-12">
                <label class="wizard-label">VETERINARIO RESPONSABLE</label>
                <input type="text" id="w-pd-vet" value="${data.adsg_veterinario || ''}" placeholder="NOMBRE DEL VETERINARIO" class="wizard-input uppercase font-800">
              </div>
              <div class="grid grid-cols-2 gap-10 mb-10">
                <div class="wizard-input-group">
                  <label class="wizard-label">Nº COLEGIADO</label>
                  <input type="text" id="w-pd-vet-col" value="${data.adsg_vet_colegiado || ''}" placeholder="0000" class="wizard-input font-800">
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">NIF VET.</label>
                  <input type="text" id="w-pd-vet-nif" value="${data.adsg_vet_nif || ''}" placeholder="NIF" class="wizard-input font-800">
                </div>
              </div>
              ${finca.comunidad_autonoma ? `
              <div class="p-10 bg-black border border-222 rounded-sm">
                <p class="text-[0.6rem] text-aaa uppercase font-900 tracking-tight leading-relaxed m-0 text-center">
                  LA SOLICITUD SE DIRIGIRÁ A <strong>${finca.comunidad_autonoma.toLowerCase() === 'andalucia' ? 'SIGGAN' : 'BADIGEX'}</strong> PARA TRAMITACIÓN OFICIAL.
                </p>
              </div>` : ''}
            </div>
          `;
        },
        onChange: async (data) => {
          data.adsg_nombre = document.getElementById('w-pd-adsg')?.value.trim() || data.adsg_nombre;
          data.adsg_codigo = document.getElementById('w-pd-adsg-cod')?.value.trim() || '';
          data.adsg_veterinario = document.getElementById('w-pd-vet')?.value.trim() || '';
          data.adsg_vet_colegiado = document.getElementById('w-pd-vet-col')?.value.trim() || '';
          data.adsg_vet_nif = document.getElementById('w-pd-vet-nif')?.value.trim() || '';
        },
        validate: async (data) => {
          if (!data.adsg_nombre) { App.toastError("Indica a quién va dirigida la solicitud (ADSG u OCA)"); return false; }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-pedido-crotales',
      title: 'PEDIDO OFICIAL CROTALES',
      initialData: {
        id: borrador ? borrador.id : undefined,
        tipo: borrador ? borrador.tipo : "Bandera + Botón (EID)",
        especie: borrador ? borrador.especie : (especiesPedido[0] || "Ovino"),
        cantidad: borrador ? borrador.cantidad : 50,
        adsg_nombre: borrador ? borrador.adsg_nombre : (finca.adsg_nombre || ""),
        adsg_codigo: borrador ? borrador.adsg_codigo : (finca.adsg_codigo || ""),
        adsg_veterinario: borrador ? borrador.adsg_veterinario : (finca.adsg_veterinario || ""),
        adsg_vet_colegiado: borrador ? borrador.adsg_vet_colegiado : (finca.adsg_vet_colegiado || ""),
        adsg_vet_nif: borrador ? borrador.adsg_vet_nif : (finca.adsg_vet_nif || ""),
      },
      steps: wizardSteps,
      onComplete: async (data) => {
        console.log("[wizard-crotales] onComplete iniciado", data);
        try {
          if (!window.db) {
            await Confirm.alert("Error", "Base de datos no disponible. Por favor, reinicia la aplicación.");
            return;
          }

          if (!window.db.objectStoreNames.contains('pedidos_crotales')) {
             await Confirm.alert("Actualización Requerida", "El sistema de pedidos requiere una actualización de base de datos (v12). Por favor, cierra y abre la aplicación.");
             return;
          }

          // Leer valores directamente del DOM como fallback
          const especie = document.getElementById('w-pd-especie')?.value || data.especie;
          const tipo = document.getElementById('w-pd-tipo')?.value || data.tipo;
          const cantidad = parseInt(document.getElementById('w-pd-cant')?.value) || data.cantidad || 0;
          const adsg_nombre = document.getElementById('w-pd-adsg')?.value.trim() || data.adsg_nombre || '';
          const adsg_codigo = document.getElementById('w-pd-adsg-cod')?.value.trim() || data.adsg_codigo || '';
          const adsg_veterinario = document.getElementById('w-pd-vet')?.value.trim() || data.adsg_veterinario || '';
          const adsg_vet_colegiado = document.getElementById('w-pd-vet-col')?.value.trim() || data.adsg_vet_colegiado || '';
          const adsg_vet_nif = document.getElementById('w-pd-vet-nif')?.value.trim() || data.adsg_vet_nif || '';

          const payload = {
            id: data.id || undefined,
            fincaId: finca.id,
            especie, tipo, cantidad,
            adsg_nombre, adsg_codigo, adsg_veterinario, adsg_vet_colegiado, adsg_vet_nif,
            estado: 'pendiente',
            fecha_pedido: borrador ? borrador.fecha_pedido : new Date().toISOString(),
          };

          App.toast("Guardando pedido...");
          const pedidoId = await PedidosCrotales.save(payload);
          console.log(`[wizard-crotales] Pedido guardado en BD: id=${pedidoId}`);

          const pdfData = { ...data, especie, tipo, cantidad, adsg_nombre, adsg_codigo, adsg_veterinario, adsg_vet_colegiado, adsg_vet_nif };
          App.toast(`Pedido guardado (nº ${pedidoId})`, 'success');
          await WizardCrotales.generarPDF(finca, pdfData, pedidoId);
          if (document.getElementById('docs-lista')) {
            try { await DocumentosView.render(); } catch (_) { /* noop */ }
          }
        } catch (e) {
          console.error('[wizard-crotales] Error:', e);
          await Confirm.alert("Error", "Error al procesar el pedido: " + e.message);
          const fbData = { ...data, especie: data.especie || document.getElementById('w-pd-especie')?.value, tipo: data.tipo || document.getElementById('w-pd-tipo')?.value, cantidad: data.cantidad || parseInt(document.getElementById('w-pd-cant')?.value) || 0 };
          await WizardCrotales.generarPDF(finca, fbData, "TEMP-" + Date.now());
        }
      }
    });
  },

  async generarPDF(finca, data, pedidoId = null) {
    App.toast("Generando documento oficial...");
    const html = this._buildPDFHtml(finca, data, pedidoId);
    await this._mostrarPDF(html, `Solicitud_Crotales_${finca.codigo_REGA || finca.rega}`, 'Solicitud Crotales');
  },

  _buildPDFHtml(finca, data, pedidoId) {
    const ccaa = finca.comunidad_autonoma;
    const ccaaLabel = ccaa === 'andalucia' ? 'Andalucía' : ccaa === 'extremadura' ? 'Extremadura' : '—';
    const plataforma = ccaa === 'andalucia' ? 'SIGGAN' : ccaa === 'extremadura' ? 'BADIGEX' : 'SIA/PIGGAN';
    return `
      <div style="padding:40px;font-family:serif;max-width:800px;margin:0 auto;color:#000;background:#fff;">
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:20px;margin-bottom:30px;">
          <h1 style="margin:0;font-size:1.5rem;text-transform:uppercase;">SOLICITUD DE MATERIAL DE IDENTIFICACIÓN ANIMAL</h1>
          <h3 style="margin:5px 0 0 0;color:#555;font-weight:normal;">Documento de delegación para ADSG / Autoridad Competente</h3>
        </div>
        <div style="display:flex;gap:40px;margin-bottom:20px;font-size:0.9rem;">
          <div style="flex:1;">
            <h4 style="border-bottom:1px solid #ddd;padding-bottom:5px;margin-top:0;">DATOS DEL TITULAR</h4>
            <p><strong>Nombre/Razón Social:</strong> ${finca.propietario || finca.nombre}<br>
            <strong>NIF/CIF:</strong> ${finca.nif_cif || 'No especificado'}<br>
            <strong>Dirección:</strong> ${finca.direccion || 'No especificada'}<br>
            <strong>Teléfono:</strong> ${finca.telefonoContacto || finca.telefono || 'No especificado'}<br>
            <strong>Email:</strong> ${finca.email || 'No especificado'}</p>
          </div>
          <div style="flex:1;">
            <h4 style="border-bottom:1px solid #ddd;padding-bottom:5px;margin-top:0;">DATOS DE LA EXPLOTACIÓN</h4>
            <p><strong>Nombre Finca:</strong> ${finca.nombre}<br>
            <strong>Código REGA:</strong> <span class="text-gold" style="color:var(--p-gold); font-weight:bold;">${finca.codigo_REGA || finca.rega || 'No especificado'}</span><br>
            <strong>Dirigido a (ADSG/OCA):</strong> ${data.adsg_nombre}</p>
          </div>
        </div>
        ${data.adsg_codigo || data.adsg_veterinario ? `
        <div style="margin-bottom:20px;font-size:0.9rem;">
          <h4 style="border-bottom:1px solid #ddd;padding-bottom:5px;">DATOS ADSG / VETERINARIO</h4>
          <p>${data.adsg_codigo ? `<strong>Código ADSG:</strong> ${data.adsg_codigo}<br>` : ''}
          ${data.adsg_veterinario ? `<strong>Veterinario:</strong> ${data.adsg_veterinario}<br>` : ''}
          ${data.adsg_vet_colegiado ? `<strong>Nº Colegiado:</strong> ${data.adsg_vet_colegiado}<br>` : ''}
          ${data.adsg_vet_nif ? `<strong>NIF Vet.:</strong> ${data.adsg_vet_nif}` : ''}</p>
        </div>` : ''}
        <div style="margin-bottom:30px;">
          <h4 style="border-bottom:1px solid #ddd;padding-bottom:5px;">MATERIAL SOLICITADO</h4>
          <table style="width:100%;border-collapse:collapse;margin-top:10px;">
            <thead><tr style="background:#eee;">
              <th style="padding:10px;border:1px solid #ccc;text-align:left;">Tipo de Dispositivo</th>
              <th style="padding:10px;border:1px solid #ccc;text-align:center;">Cantidad (Pares)</th>
            </tr></thead>
            <tbody><tr>
              <td style="padding:10px;border:1px solid #ccc;">${data.tipo}${data.especie ? ` · ${data.especie}` : ''}</td>
              <td style="padding:10px;border:1px solid #ccc;text-align:center;font-weight:bold;font-size:1.2rem;">${data.cantidad}</td>
            </tr></tbody>
          </table>
        </div>
        <div style="padding:20px;border:1px solid #ccc;background:#f9f9f9;font-size:0.85rem;">
          <p style="margin-top:0;"><strong>DECLARACIÓN:</strong><br>
          El titular declara conocer la normativa vigente en materia de identificación animal.</p>
          <div style="display:flex;justify-content:space-between;margin-top:40px;">
            <div style="text-align:center;border-top:1px solid #000;width:40%;">Firma del Titular</div>
            <div style="text-align:center;border-top:1px solid #000;width:40%;">Fecha: ${new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>`;
  },

  async _mostrarPDF(html, baseName, titulo) {
    DocumentViewer.show({
      id: 'doc-viewer-crotales',
      title: titulo,
      html,
      filename: baseName,
      shareTitle: titulo
    });
  },

  /** Fallback genérico cuando html2pdf no llegó a cargarse: muestra el documento igualmente. */
  _fallbackPDF(element, filename) {
    if (!element) { App.toastError('Documento no disponible'); return; }
    DocumentViewer.show({
      id: 'doc-viewer-fallback',
      title: filename,
      html: element.innerHTML,
      filename: filename.replace(/\.pdf$/i, '')
    });
  },

  async _onSelectADSG(adsgId) {
    console.log("[WizardCrotales] _onSelectADSG seleccionado:", adsgId);
    const adsgs = await window.ADSGs.list().catch(() => []);
    const adsg = adsgs.find(a => Number(a.id) === Number(adsgId));
    
    const inputNombre = document.getElementById('w-pd-adsg');
    const inputCodigo = document.getElementById('w-pd-adsg-cod');
    const inputVet = document.getElementById('w-pd-vet');
    const inputCol = document.getElementById('w-pd-vet-col');
    const inputNif = document.getElementById('w-pd-vet-nif');

    if (adsg) {
      if (inputNombre) inputNombre.value = adsg.nombre || '';
      if (inputCodigo) inputCodigo.value = adsg.codigo || '';
      if (inputVet) inputVet.value = adsg.veterinario || '';
      if (inputCol) inputCol.value = adsg.colegiado || '';
      if (inputNif) inputNif.value = adsg.vet_nif || '';
    } else {
      if (inputNombre) inputNombre.value = '';
      if (inputCodigo) inputCodigo.value = '';
      if (inputVet) inputVet.value = '';
      if (inputCol) inputCol.value = '';
      if (inputNif) inputNif.value = '';
    }
  }
};

