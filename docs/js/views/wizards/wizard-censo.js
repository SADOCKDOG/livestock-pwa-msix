/**
 * Wizard Censo Anual SIGGAN — Livestock Manager Premium
 * Consolida el censo de la explotación a una fecha de referencia (por defecto
 * 1 de enero) por especie y categoría, y genera el documento de declaración
 * censal exigido por SIGGAN (Junta de Andalucía).
 */
window.WizardCenso = {
  async abrir() {
    const finca = await Fincas.getActive();
    if (!finca) { App.toastError("No hay finca activa"); return; }

    const year = new Date().getFullYear();
    const steps = [
      {
        content: (data) => `
          <div class="card card-accent card-accent-amber p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--p-gold)">FECHA DE REFERENCIA</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">FECHA DEL CENSO</label>
              <input type="date" id="w-cs-fecha" value="${data.fecha}" class="wizard-input font-800">
            </div>
            <div class="p-10 bg-black border border-222 rounded-sm">
              <p class="text-[0.6rem] text-aaa uppercase font-900 tracking-tight leading-relaxed m-0 text-center">
                LA DECLARACIÓN CENSAL OBLIGATORIA SE REFIERE AL <strong>CENSO A 1 DE ENERO</strong>.
              </p>
            </div>
          </div>`,
        onChange: async (data) => {
          data.fecha = document.getElementById('w-cs-fecha')?.value || data.fecha;
        },
        validate: async (data) => {
          if (!data.fecha) { App.toastError("Indica la fecha de referencia"); return false; }
          return true;
        }
      },
      {
        content: async (data) => {
          const censo = await WizardCenso._calcularCenso(data.fecha);
          data._censo = censo;
          const filas = Object.entries(censo.porEspecie);
          return `
          <div class="card card-accent card-accent-green p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-success)">${Icons.animales()} CENSO CONSOLIDADO</div>
            <div class="text-center bg-black border border-222 p-16 rounded-sm mb-16">
              <div class="text-aaa uppercase font-900 text-[0.65rem] tracking-widest mb-4">TOTAL CABEZAS ACTIVAS</div>
              <div class="text-white font-950 text-3xl tracking-tighter">${censo.total} ${censo.total === 1 ? 'ANIMAL' : 'ANIMALES'}</div>
            </div>
            ${filas.length === 0 ? '<p class="text-center text-gray uppercase font-800 text-xs p-10">No hay animales activos en la fecha</p>' : ''}
            <div class="grid gap-10">
              ${filas.map(([esp, info]) => `
                <div class="rounded-sm p-12 border border-222 bg-black">
                  <div class="flex justify-between font-950 text-gold text-sm uppercase tracking-tight mb-6">
                    <span>${esp}</span><span>${info.total}</span>
                  </div>
                  <div class="text-aaa uppercase font-800 text-[0.6rem] tracking-widest">${Icons.check()} HEMBRAS: ${info.hembras} · MACHOS: ${info.machos}</div>
                  <div class="mt-8 flex flex-wrap gap-4">
                    ${Object.entries(info.categorias).map(([cat, cnt]) =>
                      `<span class="bg-black border border-222 rounded-sm text-[0.55rem] text-aaa px-6 py-2 uppercase font-900">${cat}: ${cnt}</span>`).join('')}
                  </div>
                </div>`).join('')}
            </div>
          </div>`;
        },
        onChange: async () => {},
        validate: async (data) => {
          if (!data._censo || data._censo.total === 0) {
            App.toastError("No hay censo que declarar para esa fecha");
            return false;
          }
          return true;
        }
      },
      {
        content: (data) => `
          <div class="card card-accent card-accent-blue p-16 mt-10">
            <div class="section-header-theme mb-12" style="--theme-color: var(--c-info)">TRAMITACIÓN ADMINISTRATIVA</div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">ESTADO DE TRÁMITE</label>
              <select id="w-cs-estado" class="wizard-input font-950">
                <option value="borrador" ${data.estado_tramite === "borrador" ? "selected" : ""}>BORRADOR</option>
                <option value="presentado" ${data.estado_tramite === "presentado" ? "selected" : ""}>PRESENTADO</option>
                <option value="aceptado" ${data.estado_tramite === "aceptado" ? "selected" : ""}>ACEPTADO</option>
                <option value="rechazado" ${data.estado_tramite === "rechazado" ? "selected" : ""}>RECHAZADO</option>
              </select>
            </div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">FECHA PRESENTACIÓN</label>
              <input type="date" id="w-cs-presentacion" value="${data.fecha_presentacion || ""}" class="wizard-input font-800">
            </div>
            <div class="wizard-input-group mb-12">
              <label class="wizard-label">NÚMERO REGISTRO OFICIAL</label>
              <input type="text" id="w-cs-registro" value="${data.numero_registro_oficial || ""}" class="wizard-input uppercase font-800" placeholder="EJ: CENSO-2026">
            </div>
            <div class="wizard-input-group">
              <label class="wizard-label">ACUSE RECIBO / JUSTIFICANTE</label>
              <textarea id="w-cs-acuse" class="wizard-input uppercase font-700" style="min-height:70px;resize:none;font-size:var(--fs-sm);">${data.acuse_recibo || ""}</textarea>
            </div>
          </div>
        `,
        onChange: async (data) => {
          data.estado_tramite = document.getElementById("w-cs-estado")?.value || data.estado_tramite;
          data.fecha_presentacion = document.getElementById("w-cs-presentacion")?.value || "";
          data.numero_registro_oficial = document.getElementById("w-cs-registro")?.value.trim() || "";
          data.acuse_recibo = document.getElementById("w-cs-acuse")?.value.trim() || "";
        },
        validate: async (data) => {
          if (data.estado_tramite !== "borrador" && !data.fecha_presentacion) {
            App.toastError("Indica la fecha de presentación.");
            return false;
          }
          if ((data.estado_tramite === "aceptado" || data.estado_tramite === "rechazado") && !data.numero_registro_oficial) {
            App.toastError("Indica el número de registro oficial.");
            return false;
          }
          return true;
        }
      }
    ];

    window.WizardManager.create({
      id: 'wizard-censo',
      title: 'DECLARACIÓN CENSAL',
      initialData: {
        fecha: `${year}-01-01`,
        _censo: null,
        estado_tramite: "borrador",
        fecha_presentacion: "",
        numero_registro_oficial: "",
        acuse_recibo: ""
      },
      steps,
      onComplete: async (data) => {
        const fechaHoy = new Date().toISOString().split("T")[0];
        const ahoraIso = new Date().toISOString();
        const fincaId = await Fincas.getActiveId().catch(() => null);
        const documentoId = await window.db.add("documentos_legales", {
          fincaId,
          tipo: "DECLARACION_CENSAL",
          fecha: data.fecha || fechaHoy,
          descripcion: `Declaración censal (${data._censo?.total || 0} animales)`,
          estado_tramite: data.estado_tramite || "borrador",
          fecha_presentacion: data.fecha_presentacion || null,
          numero_registro_oficial: data.numero_registro_oficial || null,
          acuse_recibo: data.acuse_recibo || null,
          payload: data._censo || null,
          creadoEn: ahoraIso,
          actualizadoEn: ahoraIso
        });
        await window.db.add("registro_eventos", {
          fincaId,
          tipo: "declaracion_censal",
          tipo_entidad: "finca",
          entidad_id: fincaId || 0,
          fecha: data.fecha || fechaHoy,
          descripcion: `Declaración censal registrada (${data._censo?.total || 0} animales)`,
          estado_tramite: data.estado_tramite || "borrador",
          fecha_presentacion: data.fecha_presentacion || null,
          numero_registro_oficial: data.numero_registro_oficial || null,
          acuse_recibo: data.acuse_recibo || null,
          documento_legal_id: documentoId,
          creadoEn: ahoraIso
        }).catch(() => {});
        WizardCenso.generarDocumento(finca, data.fecha, data._censo);
      }
    });
  },

  async _calcularCenso(fecha) {
    const animales = await window.db.getAll('animales').catch(() => []);
    const ref = fecha ? new Date(fecha) : new Date();
    const porEspecie = {};
    let total = 0;
    animales.forEach(a => {
      if (a?.anulado) return;
      // Activo a la fecha: dado de alta antes/igual y no dado de baja antes de la fecha
      const alta = a.fecha_alta ? new Date(a.fecha_alta) : (a.fecha_nacimiento ? new Date(a.fecha_nacimiento) : null);
      if (alta && alta > ref) return;
      const baja = (a.estado === 'baja' || a.estado === 'vendido') && a.fecha_baja ? new Date(a.fecha_baja) : null;
      if (baja && baja <= ref) return;
      // Si no hay fecha de baja pero está de baja/vendido, lo excluimos sólo si la fecha es "hoy o futura"
      if (!baja && (a.estado === 'baja' || a.estado === 'vendido')) return;

      const esp = a.especie || 'Sin especie';
      if (!porEspecie[esp]) porEspecie[esp] = { total: 0, hembras: 0, machos: 0, categorias: {} };
      porEspecie[esp].total++;
      total++;
      const sexo = (a.sexo || '').toString().toUpperCase();
      if (sexo === 'H' || sexo.startsWith('HEMBRA')) porEspecie[esp].hembras++;
      else if (sexo === 'M' || sexo.startsWith('MACHO')) porEspecie[esp].machos++;
      const cat = a.categoria || a.tipo || 'Sin categoría';
      porEspecie[esp].categorias[cat] = (porEspecie[esp].categorias[cat] || 0) + 1;
    });
    return { total, porEspecie };
  },

  generarDocumento(finca, fecha, censo) {
    const overlay = document.createElement('div');
    overlay.id = 'censo-overlay';
    overlay.className = 'wizard-full-screen animate-in';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:6000;background:white;color:black;display:flex;flex-direction:column;';
    const contentId = `censo-content-${Date.now()}`;
    const regaPropia = finca.codigo_REGA || finca.rega || '—';
    const filas = Object.entries(censo.porEspecie);
    overlay.innerHTML = `
      <div id="${contentId}" style="flex:1;width:100%;background:white;color:black;padding:40px;font-family:serif;box-sizing:border-box;overflow:auto;">
        <div style="text-align:center;border-bottom:2px solid #000;padding-bottom:16px;margin-bottom:24px;">
          <h1 style="margin:0;font-size:1.4rem;text-transform:uppercase;">Declaración Censal de Explotación Ganadera</h1>
          <h3 style="margin:5px 0 0;color:#555;font-weight:normal;">Censo a fecha ${fecha}</h3>
        </div>
        <div class="text-base mb-20">
          <p style="margin:0;"><strong>Explotación:</strong> ${finca.nombre || '—'} &nbsp;·&nbsp;
          <strong>REGA:</strong> <span class="text-gold" style="color:var(--p-gold); font-weight:bold;">${regaPropia}</span><br>
          <strong>Titular:</strong> ${finca.propietario || '—'} &nbsp;·&nbsp;
          <strong>NIF/CIF:</strong> ${finca.nif_cif || finca.nif || '—'}<br>
          <strong>Provincia:</strong> ${finca.provincia || '—'} &nbsp;·&nbsp;
          <strong>Municipio:</strong> ${finca.municipio || '—'}</p>
        </div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:0.88rem;">
          <thead>
            <tr style="background:#eee;">
              <th style="padding:8px;border:1px solid #ccc;text-align:left;">Especie</th>
              <th style="padding:8px;border:1px solid #ccc;text-align:center;">Hembras</th>
              <th style="padding:8px;border:1px solid #ccc;text-align:center;">Machos</th>
              <th style="padding:8px;border:1px solid #ccc;text-align:center;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${filas.map(([esp, info]) => `
              <tr>
                <td style="padding:8px;border:1px solid #ccc;">${esp}</td>
                <td style="padding:8px;border:1px solid #ccc;text-align:center;">${info.hembras}</td>
                <td style="padding:8px;border:1px solid #ccc;text-align:center;">${info.machos}</td>
                <td style="padding:8px;border:1px solid #ccc;text-align:center;font-weight:bold;">${info.total}</td>
              </tr>`).join('')}
            <tr style="background:#f4f4f4;font-weight:bold;">
              <td style="padding:8px;border:1px solid #ccc;">TOTAL</td>
              <td style="padding:8px;border:1px solid #ccc;"></td>
              <td style="padding:8px;border:1px solid #ccc;"></td>
              <td style="padding:8px;border:1px solid #ccc;text-align:center;">${censo.total}</td>
            </tr>
          </tbody>
        </table>
        <div style="margin-top:48px;display:flex;justify-content:space-between;align-items:flex-end;">
          <div style="text-align:center;width:240px;">
            <p style="margin-bottom:50px;color:#555;">Firma del Titular:</p>
            <div style="border-top:1px solid #000;padding-top:4px;font-weight:bold;">${finca.propietario || finca.nombre}</div>
          </div>
          <div style="text-align:right;"><p>Emitida: <strong>${new Date().toLocaleDateString()}</strong></p></div>
        </div>
      </div>
      <div style="text-align:center;padding:16px;padding-bottom:calc(16px + env(safe-area-inset-bottom));display:flex;gap:10px;justify-content:center;background:#eee;border-top:1px solid #ddd;flex-shrink:0;">
        <button class="btn btn-primary" id="btn-censo-print" style="width:auto;padding:0 30px;background:#10b981;color:white;font-weight:bold;">${Icons.exportar()} IMPRIMIR / COMPARTIR</button>
        <button class="btn btn-secondary" onclick="document.getElementById('censo-overlay').remove()" style="width:auto;padding:0 30px;">CERRAR</button>
      </div>`;
    document.body.appendChild(overlay);

    overlay.querySelector('#btn-censo-print').onclick = async () => {
      let loader;
      try {
        loader = document.createElement('div');
        loader.id = 'pdf-loader-overlay';
        loader.style.cssText = `
          position:fixed; top:0; left:0; right:0; bottom:0; z-index:100000;
          background:rgba(0,0,0,0.85); display:flex; flex-direction:column;
          align-items:center; justify-content:center; color:#fff; font-family:sans-serif;
        `;
        loader.innerHTML = `
          <div class="pdf-loader">
            <div class="pdf-loader-icon" style="color:var(--p-gold); margin-bottom:15px; transform:scale(2);">${Icons.documento()}</div>
            <div class="pdf-loader-title">Generando Declaración</div>
            <div class="pdf-loader-desc">Informe de Censo Anual</div>
            <div class="pdf-loader-bar">
              <div id="pdf-progress-bar" class="pdf-loader-fill"></div>
            </div>
            <div id="pdf-progress-text" class="pdf-loader-status">PROCESANDO...</div>
          </div>
        `;
        document.body.appendChild(loader);

        const updateProgress = (pct, text) => {
          const bar = loader.querySelector('#pdf-progress-bar');
          const txt = loader.querySelector('#pdf-progress-text');
          if (bar) bar.style.width = pct + '%';
          if (txt) txt.textContent = text.toUpperCase();
        };

        const el = document.getElementById(contentId);
        if (!el) {
          App.toastError("Error: contenido no encontrado");
          loader.remove();
          return;
        }

        updateProgress(30, 'Preparando documento...');
        const tempContainer = document.createElement('div');
        tempContainer.style.cssText = `position:fixed; left:0; top:0; width:800px; z-index:10; background:#fff; color:#000; padding:40px; font-family:serif; visibility:visible;`;
        tempContainer.innerHTML = el.innerHTML;
        document.body.appendChild(tempContainer);

        const filename = `Declaracion_Censal_${regaPropia}_${fecha}.pdf`;

        const opt = {
          margin: [12, 10, 12, 10],
          filename: filename,
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            backgroundColor: '#ffffff',
            width: 800,
            windowWidth: 800,
            scrollX: 0,
            scrollY: 0,
            height: tempContainer.scrollHeight,
            windowHeight: tempContainer.scrollHeight
          },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
        };

        if (typeof html2pdf === 'undefined' && !(await App._ensureHtml2Pdf())) {
          document.body.removeChild(tempContainer);
          loader.remove();
          if (window.WizardCrotales && WizardCrotales._fallbackPDF) {
            WizardCrotales._fallbackPDF(el, filename);
          } else {
            App.toastError('Librería PDF no disponible');
          }
          return;
        }

        updateProgress(70, 'Rasterizando PDF...');
        const pdfBlob = await html2pdf().set(opt).from(tempContainer).toPdf().output('blob');
        document.body.removeChild(tempContainer);

        updateProgress(90, 'Compartiendo...');

        const shareTitle = 'Declaración Censal';
        const shareText = `Censo oficial de la explotación ${regaPropia} a fecha ${fecha}`;

        const fileObj = {
          blob: pdfBlob,
          fileName: filename,
          mimeType: 'application/pdf',
          titulo: 'Declaración Censal',
          shareTitle,
          shareText
        };

        if (window.InformesView && typeof InformesView._ejecutarShare === 'function') {
          await InformesView._ejecutarShare(fileObj);
        } else {
          // Implementación local de share
          const cap = window.Capacitor;
          if (cap?.Plugins?.Share) {
            const reader = new FileReader();
            const dataUri = await new Promise((resolve, reject) => {
              reader.onload = () => resolve(reader.result);
              reader.onerror = reject;
              reader.readAsDataURL(pdfBlob);
            });
            const result = await cap.Plugins.Filesystem.writeFile({
              path: filename,
              data: dataUri.split(',')[1],
              directory: 'CACHE'
            });
            await cap.Plugins.Share.share({
              title: shareTitle,
              text: shareText,
              url: result.uri,
              files: [result.uri],
              dialogTitle: 'Compartir Declaración con…'
            });
          } else if (navigator.share) {
            const file = new File([pdfBlob], filename, { type: 'application/pdf' });
            await navigator.share({ title: shareTitle, text: shareText, files: [file] });
          } else {
            html2pdf().set(opt).from(el).save(filename);
          }
        }

        updateProgress(100, '¡Listo!');
        await new Promise(r => setTimeout(r, 400));
        loader.remove();
        App.toast("Declaración enviada", 'success');

      } catch (e) {
        console.error("Error en generación PDF Censo:", e);
        if (loader) loader.remove();
        App.toastError("Error al generar PDF: " + e.message);
      }
    };
  }
};
