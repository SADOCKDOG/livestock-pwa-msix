/**
 * Wizard Traslado de Animales
 * Extraído de app.js para modularización.
 * Refactorizado para usar el framework WizardManager (multi-paso),
 * unificando la experiencia visual con el resto de asistentes.
 */
window.WizardTraslado = {
  async abrir() {
    const App = window.App;
    if (!App) return console.error("App no disponible");
    try {
      const rebanos = (await Rebanos.list()).filter((r) => !r.anulado);
      if (rebanos.length === 0) {
        App.toastError("No hay rebaños creados. Crea un rebaño de destino primero.");
        location.hash = '#/rebanos';
        return;
      }
      if (rebanos.length === 1) {
        return this.abrirSelectorAnimales(rebanos[0].id);
      }
      // Mostrar selector de rebaño destino dentro del wizard
      App.toastInfo?.('Selecciona el rebaño destino para el traslado');
      return this.abrirSelectorRebano(rebanos);
    } catch (error) {
      console.error("[WizardTraslado] Error al abrir:", error);
      App.toastError("Error al cargar los rebaños: " + error.message);
    }
  },

  async abrirSelectorRebano(rebanos) {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    if (!window.WizardManager) {
      App.toastError("Wizard de traslado no disponible");
      return;
    }

    const wizardSteps = [
      {
        content: (data) => `
          <div class="mt-10">
            <div class="wizard-input-group">
              <label class="wizard-label">SELECCIONA EL REBAÑO DESTINO</label>
              <div id="w-tras-rebano-list" class="rounded-sm bg-card wizard-list-scroll">
                ${rebanos.map((rebano) => `
                  <label class="flex items-start gap-10 p-10 wizard-list-item">
                    <input type="radio" name="rebanoId" value="${rebano.id}" ${data.selectedRebanoId === rebano.id ? "checked" : ""} class="w-tras-rebano-radio">
                    <div class="flex-1">
                      <div class="font-bold text-white">${rebano.nombre}</div>
                      <div class="text-sm text-gray">Zona: ${rebano.zonaActual || "—"}</div>
                    </div>
                  </label>
                `).join("")}
              </div>
            </div>
          </div>
        `,
        onChange: async (data) => {
          const selectedRadio = document.querySelector(`input[name="rebanoId"]:checked`);
          if (selectedRadio) {
            data.selectedRebanoId = parseInt(selectedRadio.value, 10);
          }
        },
        validate: async (data) => {
          if (!data.selectedRebanoId) {
            App.toastError("Selecciona un rebaño destino");
            return false;
          }
          return true;
        }
      },
      {
        content: (data) => {
          const rebanoSeleccionado = rebanos.find(r => r.id === data.selectedRebanoId);
          if (!rebanoSeleccionado) return "<div>Error: Rebaño no encontrado</div>";
          return `
            <div class="mt-10">
              <p class="text-sm text-gray m-0 mb-10">Destino: <span class="text-gold font-bold">${rebanoSeleccionado.nombre}</span></p>
              <div class="wizard-input-group">
                <label class="wizard-label">SELECCIONA LOS ANIMALES A TRASLADAR</label>
                <div id="w-tras-list" class="rounded-sm bg-card wizard-list-scroll">
                  ${rebanoSeleccionado.allAnimales.length > 0
                    ? rebanoSeleccionado.allAnimales.map((a) => {
                      const yaEnRebano = a.rebanoId == rebanoSeleccionado.id;
                      const checked = yaEnRebano || data.selectedIds.includes(a.id);
                      return `<label class="flex items-center gap-10 p-10 wizard-list-item">
                        <input type="checkbox" value="${a.id}" ${checked ? "checked" : ""} ${yaEnRebano ? "disabled" : ""} class="w-tras-chk">
                        <span class="${yaEnRebano ? 'text-gold' : ''}">${a.numero_identificacion} (${a.raza || '—'})${yaEnRebano ? " · ya en destino" : ""}</span>
                      </label>`;
                    }).join("")
                    : '<div class="text-center text-gray p-20 uppercase font-900 text-xs">Sin animales activos para trasladar</div>'
                  }
                </div>
              </div>
            </div>
          `;
        },
        onChange: async (data) => {
          const checks = document.querySelectorAll(".w-tras-chk:checked:not(:disabled)");
          data.selectedIds = Array.from(checks).map((c) => parseInt(c.value, 10));
        },
        validate: async (data) => {
          if (!data.selectedIds || data.selectedIds.length === 0) {
            App.toastError("Selecciona al menos un animal para trasladar");
            return false;
          }
          return true;
        }
      }
    ];

    // Obtener animales para cada rebaño para mostrar en la selección
    const rebanosConAnimales = await Promise.all(
      rebanos.map(async (rebano) => {
        const animales = (await Animales.list()).filter((a) => !a?.anulado && (a.estado || "activo") === "activo" && a.rebanoId === rebano.id);
        return {...rebano, allAnimales: animales};
      })
    );

    window.WizardManager.create({
      id: "selector-rebano-traslado",
      title: "Traslado de Animales - Seleccionar Destino",
      initialData: {
        rebanos: rebanosConAnimales,
        selectedRebanoId: null,
        selectedIds: []
      },
      steps: wizardSteps,
      onComplete: async (data) => {
        const rebanoSeleccionado = rebanosConAnimales.find(r => r.id === data.selectedRebanoId);
        if (!rebanoSeleccionado) {
          App.toastError("Error: Rebaño destino no seleccionado correctamente");
          return;
        }
        // Llamar al selector de animales con el rebaño seleccionado
        return this.abrirSelectorAnimales(rebanoSeleccionado.id, data.selectedIds);
      }
    });
  },

  async abrirSelectorAnimales(rebanoId, preselectedIds = []) {
    const App = window.App;
    if (!App) return console.error("App no disponible");

    if (!window.WizardManager) {
      App.toastError("Wizard de traslado no disponible");
      return;
    }

    try {
      const allAnimales = (await Animales.list()).filter((a) => !a?.anulado && (a.estado || "activo") === "activo");
      const rebano = await Rebanos.get(rebanoId);

      if (!rebano) {
        App.toastError("Rebaño destino no encontrado");
        return;
      }

      const wizardSteps = [
        {
          content: (data) => `
            <div class="mt-10">
              <p class="text-sm text-gray m-0 mb-10">Destino: <span class="text-gold font-bold">${data.rebano.nombre}</span></p>
              <div class="wizard-input-group">
                <label class="wizard-label">SELECCIONA LOS ANIMALES A TRASLADAR</label>
                <div id="w-tras-list" class="rounded-sm bg-card wizard-list-scroll">
                  ${data.allAnimales.length > 0
                    ? data.allAnimales.map((a) => {
                      const yaEnRebano = a.rebanoId == data.rebano.id;
                      const checked = yaEnRebano || data.selectedIds.includes(a.id);
                      return `<label class="flex items-center gap-10 p-10 wizard-list-item">
                        <input type="checkbox" value="${a.id}" ${checked ? "checked" : ""} ${yaEnRebano ? "disabled" : ""} class="w-tras-chk">
                        <span class="${yaEnRebano ? 'text-gold' : ''}">${a.numero_identificacion} (${a.raza || '—'})${yaEnRebano ? " · ya en destino" : ""}</span>
                      </label>`;
                    }).join("")
                    : '<div class="text-center text-gray p-20 uppercase font-900 text-xs">Sin animales activos para trasladar</div>'
                  }
                </div>
              </div>
            </div>
          `,
          onChange: async (data) => {
            const checks = document.querySelectorAll(".w-tras-chk:checked:not(:disabled)");
            data.selectedIds = Array.from(checks).map((c) => parseInt(c.value, 10));
          },
          validate: async (data) => {
            if (!data.selectedIds || data.selectedIds.length === 0) {
              App.toastError("Selecciona al menos un animal para trasladar");
              return false;
            }
            return true;
          }
        },
        {
          content: (data) => {
            const seleccionados = data.allAnimales.filter((a) => data.selectedIds.includes(a.id));
            return `
              <div class="mt-10">
                <div class="wizard-input-group">
                  <label class="wizard-label">RESUMEN DEL TRASLADO</label>
                  <div class="bg-card rounded-sm p-10 border-444">
                    <p class="m-0 text-sm">Rebaño destino: <span class="text-gold font-bold">${data.rebano.nombre}</span></p>
                    <p class="m-0 text-sm">Zona destino: <span class="font-bold">${data.rebano.zonaActual || "—"}</span></p>
                    <p class="m-0 text-sm">Animales a trasladar: <span class="font-bold">${seleccionados.length}</span></p>
                  </div>
                </div>
                <div class="wizard-input-group">
                  <label class="wizard-label">ANIMALES SELECCIONADOS</label>
                  <div class="rounded-sm bg-card wizard-list-scroll-sm">
                    ${seleccionados.map((a) =>
                      `<div class="p-10 text-sm wizard-list-item">${a.numero_identificacion} (${a.raza || '—'})</div>`
                    ).join("")}
                  </div>
                </div>
              </div>
            `;
          }
        },
        {
          content: (data) => `
            <div class="mt-10">
              <div class="wizard-input-group">
                <label class="wizard-label">ESTADO DE TRÁMITE</label>
                <select id="w-tras-estado" class="wizard-input">
                  <option value="borrador" ${data.estado_tramite === "borrador" ? "selected" : ""}>Borrador</option>
                  <option value="presentado" ${data.estado_tramite === "presentado" ? "selected" : ""}>Presentado</option>
                  <option value="aceptado" ${data.estado_tramite === "aceptado" ? "selected" : ""}>Aceptado</option>
                  <option value="rechazado" ${data.estado_tramite === "rechazado" ? "selected" : ""}>Rechazado</option>
                </select>
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">FECHA PRESENTACIÓN</label>
                <input type="date" id="w-tras-fecha" value="${data.fecha_presentacion || ""}" class="wizard-input">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">NÚMERO REGISTRO OFICIAL</label>
                <input type="text" id="w-tras-registro" value="${data.numero_registro_oficial || ""}" placeholder="Ej: SIGGAN-2026-000123" class="wizard-input">
              </div>
              <div class="wizard-input-group">
                <label class="wizard-label">ACUSE RECIBO</label>
                <textarea id="w-tras-acuse" class="wizard-input wizard-textarea">${data.acuse_recibo || ""}</textarea>
              </div>
            </div>
          `,
          onChange: async (data) => {
            data.estado_tramite = document.getElementById("w-tras-estado")?.value || data.estado_tramite;
            data.fecha_presentacion = document.getElementById("w-tras-fecha")?.value || "";
            data.numero_registro_oficial = document.getElementById("w-tras-registro")?.value.trim() || "";
            data.acuse_recibo = document.getElementById("w-tras-acuse")?.value.trim() || "";
          },
          validate: async (data) => {
            if (data.estado_tramite !== "borrador" && !data.fecha_presentacion) {
              App.toastError("Indica fecha de presentación para continuar.");
              return false;
            }
            if ((data.estado_tramite === "aceptado" || data.estado_tramite === "rechazado") && !data.numero_registro_oficial) {
              App.toastError("El número de registro oficial es obligatorio para trámites resueltos.");
              return false;
            }
            return true;
          }
        }
      ];

      window.WizardManager.create({
        id: "selector-animales-overlay",
        title: "Traslado de Animales",
        initialData: {
          rebano,
          allAnimales,
          selectedIds: preselectedIds.slice(), // clonar array
          estado_tramite: "borrador",
          fecha_presentacion: "",
          numero_registro_oficial: "",
          acuse_recibo: ""
        },
        steps: wizardSteps,
        onComplete: async (data) => {
          try {
            await Trazabilidad.validarAforoZona(
              window.db,
              data.rebano.zonaActual,
              data.selectedIds.length
            );
            const fincaId = (window.Fincas && Fincas.getActiveId)
              ? await Fincas.getActiveId().catch(() => null)
              : null;
            const hoy = new Date().toISOString().split("T")[0];
            const ahoraIso = new Date().toISOString();
            const numeroGuia = `TRASLADO-${Date.now()}`;
            const documentoId = await window.db.add("documentos_legales", {
              tipo: "GUIA_TRASLADO_INTERNO",
              fecha: hoy,
              fincaId,
              descripcion: `Traslado interno de ${data.selectedIds.length} animales a ${data.rebano.nombre}`,
              numero: numeroGuia, // Campo adicional con índice único
              numero_referencia: numeroGuia,
              estado_tramite: data.estado_tramite || "borrador",
              fecha_presentacion: data.fecha_presentacion || null,
              numero_registro_oficial: data.numero_registro_oficial || null,
              acuse_recibo: data.acuse_recibo || null,
              creadoEn: ahoraIso,
              actualizadoEn: ahoraIso
            });
            let trasladados = 0;
            for (let id of data.selectedIds) {
              const a = await Animales.get(id);
              if (!a) continue;
              const origenId = a.rebanoId;
              if (origenId === data.rebano.id) continue;
              a.rebanoId = data.rebano.id;
              await Animales.save(a);
              trasladados++;
              // Trazabilidad SIGGAN: evento de movimiento interno en el libro de registro
              try {
                await window.db.add("registro_eventos", {
                  fincaId,
                  entidad_id: id,
                  tipo_entidad: "animal",
                  tipo: "movimiento",
                  motivo_tarea: "traslado_interno",
                  fecha: hoy,
                  rebano_origen: origenId || null,
                  rebano_destino: data.rebano.id,
                  numero_guia: numeroGuia,
                  documento_legal_id: documentoId,
                  estado_tramite: data.estado_tramite || "borrador",
                  fecha_presentacion: data.fecha_presentacion || null,
                  numero_registro_oficial: data.numero_registro_oficial || null,
                  acuse_recibo: data.acuse_recibo || null,
                  descripcion: `Traslado interno · ${a.numero_identificacion || "#" + id} → rebaño "${data.rebano.nombre}"${data.rebano.zonaActual ? " (zona " + data.rebano.zonaActual + ")" : ""}`,
                  creadoEn: ahoraIso,
                });
              } catch (e) {
                console.warn("[Traslado] No se pudo registrar el evento de movimiento:", e?.message);
              }
            }
            App.toast(`Traslado completado · ${trasladados} ${trasladados === 1 ? 'animal' : 'animales'}`);
            App.renderDetalleRebano(new URLSearchParams(`id=${data.rebano.id}`));
          } catch (error) {
            console.error("[WizardTraslado] Error en onComplete:", error);
            App.toastError("Error al completar el traslado: " + error.message);
          }
        }
      });
    } catch (error) {
      console.error("[WizardTraslado] Error al abrir selector de animales:", error);
      App.toastError("Error al cargar los animales: " + error.message);
    }
  }
};