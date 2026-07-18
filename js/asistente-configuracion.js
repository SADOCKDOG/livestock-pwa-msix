/**
 * Asistente de Configuración Inicial
 * Permite importar fincas desde backup o crear nuevas manualmente
 */

const AsistenteConfiguracion = {
    /** Carga js/seed-data.js bajo demanda (solo se usa desde este asistente) en vez de en cada arranque. */
    async _ensureSeedData() {
        if (window.SeedData && typeof window.SeedData.run === 'function') return true;
        await new Promise((resolve, reject) => {
            const s = document.createElement('script');
            s.src = 'js/seed-data.js?v=6.28';
            s.onload = resolve;
            s.onerror = reject;
            document.body.appendChild(s);
        });
        return !!(window.SeedData && typeof window.SeedData.run === 'function');
    },

    /**
     * Mostrar ventana de bienvenida/configuración inicial
     * @returns {Promise<void>}
     */
    async mostrarAsistente() {
        const contenedor = document.createElement('div');
        contenedor.id = 'asistente-configuracion-contenedor';
        contenedor.innerHTML = `
            <div class="asistente-configuracion">
                <div class="asistente-cabecera">
                    <img src="icons/Logo aplicación.png" alt="Livestock Manager" class="asistente-logo">
                    <h1>Bienvenido</h1>
                    <p>Gestión ganadera profesional v${window.APP_INFO.version} Premium</p>
                    <button class="btn-tour" id="btn-iniciar-tour">
                        Primeros pasos
                    </button>
                </div>

                <div class="asistente-opciones">
                    <!-- Opción 1: Importar desde Backup -->
                    <button class="asistente-opcion" id="btn-importar">
                        <div class="asistente-icono">${Icons.importar()}</div>
                        <div class="asistente-info-opcion">
                            <div class="asistente-titulo">Importar Backup</div>
                            <div class="asistente-descripcion">Restaura tu base de datos desde un archivo JSON</div>
                        </div>
                    </button>

                    <!-- Opción 2: Crear Nueva Finca -->
                    <button class="asistente-opcion" id="btn-crear">
                        <div class="asistente-icono">${Icons.mas()}</div>
                        <div class="asistente-info-opcion">
                            <div class="asistente-titulo">Nueva Finca</div>
                            <div class="asistente-descripcion">Configura una explotación desde cero</div>
                        </div>
                    </button>

                    <!-- Opción Demo: Cargar explotación de ejemplo -->
                    <button class="asistente-opcion" id="btn-demo">
                        <div class="asistente-icono">${Icons.animales()}</div>
                        <div class="asistente-info-opcion">
                            <div class="asistente-titulo">Cargar Demo CHAMORRO</div>
                            <div class="asistente-descripcion">Explora la app con una explotación de ejemplo con datos en todos los módulos</div>
                        </div>
                    </button>

                    <!-- Opción 3: Ver Fincas Existentes -->
                    <button class="asistente-opcion d-none" id="btn-seleccionar">
                        <div class="asistente-icono">${Icons.finca()}</div>
                        <div class="asistente-info-opcion">
                            <div class="asistente-titulo">Seleccionar Finca</div>
                            <div class="asistente-descripcion">Cambiar a una finca ya registrada</div>
                        </div>
                    </button>
                </div>

                <!-- Sección de Carga de Archivo -->
                <div id="asistente-carga-archivo" class="asistente-seccion d-none">
                    <div class="asistente-titulo-seccion">Cargar Backup JSON</div>
                    <input type="file" id="entrada-archivo" accept=".json" class="d-none">
                    <div class="asistente-carga-zona">
                        <button class="btn-carga" id="btn-seleccionar-archivo">
                            Seleccionar archivo
                        </button>
                        <p id="nombre-archivo-seleccionado" class="asistente-archivo-nombre"></p>
                    </div>
                    <div id="asistente-progreso" class="asistente-progreso d-none">
                        <div class="asistente-barra-progreso">
                            <div class="asistente-barra-lleno"></div>
                        </div>
                        <p id="texto-progreso">Importando...</p>
                    </div>
                    <div id="asistente-resultado" class="asistente-resultado d-none"></div>
                    <div class="asistente-botones">
                        <button class="btn btn-sm btn-primary" id="btn-importar-confirmar" disabled>
                            Importar Fincas
                        </button>
                        <button class="btn btn-sm btn-secondary" id="btn-volver-importar">
                            Volver
                        </button>
                    </div>
                </div>

                <!-- Sección de Selección de Fincas Existentes -->
                <div id="asistente-seleccionar-finca" class="asistente-seccion d-none">
                    <div class="asistente-titulo-seccion">Seleccionar Finca Existente</div>
                    <div id="lista-fincas-existentes" class="asistente-lista-fincas"></div>
                    <div class="asistente-botones">
                        <button class="btn btn-sm btn-secondary" id="btn-volver-seleccionar">
                            Volver
                        </button>
                    </div>
                </div>

                <!-- Mensajes -->
                <div id="asistente-mensaje" class="asistente-mensaje d-none"></div>
            </div>
        `;

        document.body.appendChild(contenedor);

        // Asignar event listeners
        this._asignarEventos(contenedor);

        // Verificar si hay fincas existentes
        const fincas = await Fincas.list();
        if (fincas.length > 0) {
            document.querySelector('#btn-seleccionar').classList.remove('d-none');
        }
    },

    /**
     * Asignar event listeners a botones
     */
    _asignarEventos(contenedor) {
        const btnImportar = contenedor.querySelector('#btn-importar');
        const btnCrear = contenedor.querySelector('#btn-crear');
        const btnSeleccionar = contenedor.querySelector('#btn-seleccionar');
        const btnSeleccionarArchivo = contenedor.querySelector('#btn-seleccionar-archivo');
        const entradaArchivo = contenedor.querySelector('#entrada-archivo');
        const btnImportarConfirmar = contenedor.querySelector('#btn-importar-confirmar');
        const btnVolverImportar = contenedor.querySelector('#btn-volver-importar');
        const btnVolverSeleccionar = contenedor.querySelector('#btn-volver-seleccionar');

        // Botón Iniciar Tour
        const btnTour = contenedor.querySelector('#btn-iniciar-tour');
        if (btnTour) {
            btnTour.addEventListener('click', () => {
                this._mostrarTourInicio(contenedor);
            });
        }

        // Opción: Importar desde Backup
        btnImportar.addEventListener('click', () => {
            contenedor.querySelector('.asistente-opciones').classList.add('d-none');
            contenedor.querySelector('#asistente-carga-archivo').classList.remove('d-none');
        });

        // Opción: Crear Nueva Finca
        btnCrear.addEventListener('click', () => {
            contenedor.remove();
            this._mostrarFormularioCrear();
        });

        // Opción: Cargar Demo CHAMORRO
        const btnDemo = contenedor.querySelector('#btn-demo');
        if (btnDemo) {
            btnDemo.addEventListener('click', async () => {
                if (!await Confirm.confirm("Cargar Demo", 'Se cargará la explotación de ejemplo "DEMO CHAMORRO" con datos en todos los módulos (animales, leche, ventas, gastos, sanidad, informes...).\n\n¿Continuar?', false)) return;

                const opciones = contenedor.querySelector('.asistente-opciones');
                const mensaje = contenedor.querySelector('#asistente-mensaje');
                opciones.classList.add('d-none');
                mensaje.classList.remove('d-none');
                mensaje.innerHTML = '<div class="text-gold text-center font-bold asistente-msg-body">Cargando datos de la demo...<br><span class="text-gray text-sm font-normal">Esto puede tardar unos segundos.</span></div>';

                try {
                    if (await AsistenteConfiguracion._ensureSeedData()) {
                        await window.SeedData.run(true);
                        window.location.reload();
                    } else {
                        throw new Error('Módulo de datos demo no disponible.');
                    }
                } catch (err) {
                    mensaje.innerHTML = '<div class="text-red text-center font-bold asistente-msg-body">Error cargando la demo:<br><span class="text-gray text-sm font-normal">' + (err.message || err) + '</span></div>';
                    opciones.classList.remove('d-none');
                }
            });
        }

        // Opción: Seleccionar Finca Existente
        if (btnSeleccionar) {
            btnSeleccionar.addEventListener('click', () => {
                contenedor.querySelector('.asistente-opciones').classList.add('d-none');
                contenedor.querySelector('#asistente-seleccionar-finca').classList.remove('d-none');
                this._cargarFincasExistentes(contenedor);
            });
        }

        // Selector de archivo
        btnSeleccionarArchivo.addEventListener('click', () => {
            entradaArchivo.click();
        });

        entradaArchivo.addEventListener('change', (e) => {
            const archivo = e.target.files[0];
            if (archivo) {
                const nombreElement = contenedor.querySelector('#nombre-archivo-seleccionado');
                nombreElement.textContent = `Archivo: ${archivo.name}`;
                btnImportarConfirmar.disabled = false;
            }
        });

        // Confirmar importación
        btnImportarConfirmar.addEventListener('click', () => {
            const archivo = entradaArchivo.files[0];
            if (archivo) {
                this._procesarImportacion(contenedor, archivo);
            }
        });

        // Botones Volver
        btnVolverImportar.addEventListener('click', () => {
            contenedor.querySelector('.asistente-opciones').classList.remove('d-none');
            contenedor.querySelector('#asistente-carga-archivo').classList.add('d-none');
            entradaArchivo.value = '';
            btnImportarConfirmar.disabled = true;
        });

        btnVolverSeleccionar.addEventListener('click', () => {
            contenedor.querySelector('.asistente-opciones').classList.remove('d-none');
            contenedor.querySelector('#asistente-seleccionar-finca').classList.add('d-none');
        });
    },

    /**
     * Procesar importación de archivo backup
     */
    async _procesarImportacion(contenedor, archivo) {
        try {
            const progreso = contenedor.querySelector('#asistente-progreso');
            const textProgreso = contenedor.querySelector('#texto-progreso');
            const btnConfirmar = contenedor.querySelector('#btn-importar-confirmar');

            const deseaSobrescribir = await Confirm.confirm(
                "Restaurar Copia de Seguridad",
                "¿Deseas SOBRESCRIBIR completamente la base de datos con esta copia?\n\n[Aceptar] = Borrar los datos actuales y cargar el backup.\n[Cancelar] = Mezclar los datos del backup con los datos actuales.",
                true,
                "Sobrescribir",
                "Mezclar"
            );

            progreso.classList.remove('d-none');
            btnConfirmar.disabled = true;
            textProgreso.textContent = 'Restaurando base de datos...';

            const reader = new FileReader();
            reader.onload = async (e) => {
                try {
                    const contenido = e.target.result;
                    const res = await window.Trazabilidad.importarBackupData(window.db, contenido, deseaSobrescribir);

                    if (res.multiplesFincas) {
                        textProgreso.textContent = 'Múltiples fincas detectadas. Selecciona la activa.';
                        this._mostrarWizardSeleccionFinca(res.fincas, contenedor);
                    } else {
                        await window.Fincas.setActiveId(res.fincas[0].id);
                        await Confirm.alert("Copia de Seguridad Restaurada", "Base de datos restaurada correctamente. Reiniciando...");
                        window.location.reload();
                    }
                } catch (err) {
                    await Confirm.alert("Error Crítico", "Error crítico en restauración: " + err.message);
                    window.location.reload();
                }
            };
            reader.readAsText(archivo);

        } catch (error) {
            await Confirm.alert("Error de Importación", "Error en Importación: " + error.message);
            window.location.reload();
        }
    },

    /**
     * Wizard para seleccionar finca activa tras importar backup con varias fincas
     */
    _mostrarWizardSeleccionFinca(fincas, contenedor) {
        const opciones = contenedor.querySelector('.asistente-opciones');
        const cargaArea = contenedor.querySelector('#asistente-carga-archivo');
        const progreso = contenedor.querySelector('#asistente-progreso');

        progreso.classList.add('d-none');
        cargaArea.classList.add('d-none');
        opciones.classList.remove('d-none');
        opciones.innerHTML = `
            <div class="asistente-sel-overlay">
                <h3 class="text-gold mt-0">Selecciona Finca Activa</h3>
                <p class="text-ccc text-85 mb-15">El backup contiene varias fincas. ¿Con cuál deseas empezar?</p>
                <div class="asistente-sel-list">
                    ${fincas.map(f => `
                        <button class="btn btn-secondary asistente-sel-btn" onclick="window.AsistenteConfiguracion._finalizarConFinca(${f.id})">
                            <strong class="text-gold">${f.nombre}</strong>
                            <span class="text-2xs text-gray">Propietario: ${f.propietario}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async _finalizarConFinca(id) {
        await window.Fincas.setActiveId(id);
        await Confirm.alert("Finca Seleccionada", "Finca seleccionada correctamente. Iniciando aplicación.");
        window.location.reload();
    },

    /**
     * Cargar fincas existentes en la lista
     */
    async _cargarFincasExistentes(contenedor) {
        try {
            const fincas = await Fincas.list();
            const listaElement = contenedor.querySelector('#lista-fincas-existentes');

            if (fincas.length === 0) {
                listaElement.innerHTML = '<p class="text-center text-555 text-xs">No hay fincas</p>';
                return;
            }

            listaElement.innerHTML = fincas.map(f => `
                <button class="asistente-finca-item" data-finca-id="${f.id}">
                    <div class="asistente-finca-nombre">${f.nombre}</div>
                    <div class="asistente-finca-propietario">${f.propietario}</div>
                </button>
            `).join('');

            // Asignar listeners a items de finca
            listaElement.querySelectorAll('.asistente-finca-item').forEach(item => {
                item.addEventListener('click', async (e) => {
                    const fincaId = parseInt(item.dataset.fincaId);
                    await Fincas.setActiveId(fincaId);
                    this._cerrarYContinuar(contenedor);
                });
            });

        } catch (error) {
            console.error('Error cargando fincas:', error);
        }
    },

    /**
     * Mostrar formulario para crear nueva finca (usa WizardFinca)
     */
    _mostrarFormularioCrear() {
        const contenedor = document.getElementById('asistente-configuracion-contenedor');
        if (contenedor) contenedor.remove();

        window.WizardFinca.showForm({
            onComplete: async (finalData) => {
                try {
                    await Fincas.save(finalData);
                    this._cerrarYContinuar(null);
                } catch (e) {
                    App.toastError(e.message);
                }
            },
            onCancel: () => this.mostrarAsistente()
        });
    },

    /**
     * Cerrar asistente y continuar a app
     */
    _cerrarYContinuar(contenedor) {
        if (contenedor) contenedor.remove();
        window.location.hash = '#/';
        if (window.App && typeof window.App.init === 'function') {
            window.App.init();
        } else {
            window.location.reload();
        }
    },

    /**
     * Tour de inicio flotante: guía al usuario en sus primeros pasos
     */
    _mostrarTourInicio(contenedor) {
        const existente = document.getElementById('tour-flotante-overlay');
        if (existente) existente.remove();

        const pasos = [
            {
                icono: Icons.estrella(),
                titulo: 'Bienvenido a Livestock Manager',
                texto: 'Plataforma profesional de gestión ganadera con trazabilidad industrial, control lechero, comercialización y centro de informes premium.\n\nTodo funciona 100% offline en tu dispositivo.',
                accion: null
            },
            {
                icono: Icons.animales(),
                titulo: 'Explorar la Demo',
                texto: 'Prueba la app sin riesgos cargando la explotación de ejemplo "Ganadería Chamorro". Incluye animales, rebaños, pesajes, ventas, gastos, sanidad e informes completos.',
                accion: { texto: 'Cargar Demo', metodo: 'cargarDemo' }
            },
            {
                icono: Icons.libro(),
                titulo: 'Manuales de Usuario',
                texto: 'La app incluye 8 manuales interactivos con capturas paso a paso: General, Ovino de Carne, Ovino de Leche, Producción, Comercialización, Pesadas, Control Lechero y Gastos.',
                accion: { texto: 'Abrir Manuales', metodo: 'abrirManuales' }
            },
            {
                icono: Icons.rayo(),
                titulo: '¡Manos a la obra!',
                texto: 'Elige cómo empezar:\n\nImporta una copia de seguridad existente.\nCrea una nueva explotación desde cero.\nCarga la demo para explorar todas las funcionalidades.\nConsulta los manuales cuando necesites ayuda.',
                accion: null
            }
        ];

        let pasoActual = 0;

        const overlay = document.createElement('div');
        overlay.id = 'tour-flotante-overlay';
        overlay.innerHTML = `
            <div class="tour-flotante-backdrop"></div>
            <div class="tour-flotante-card" id="tour-card">
                <button class="tour-btn-cerrar" id="tour-cerrar">✕</button>
                <div class="tour-body" id="tour-body">
                    <div class="tour-icono">${pasos[0].icono}</div>
                    <h3 class="tour-titulo">${pasos[0].titulo}</h3>
                    <p class="tour-texto">${pasos[0].texto.replace(/\n/g, '<br>')}</p>
                    <div class="tour-accion" id="tour-accion"></div>
                </div>
                <div class="tour-footer">
                    <button class="tour-btn tour-btn-prev" id="tour-prev" disabled>← Anterior</button>
                    <div class="tour-dots" id="tour-dots">
                        ${pasos.map((_, i) => `<span class="tour-dot ${i === 0 ? 'active' : ''}" data-index="${i}"></span>`).join('')}
                    </div>
                    <button class="tour-btn tour-btn-next" id="tour-next">Siguiente →</button>
                    <button class="tour-btn tour-btn-fin d-none" id="tour-fin">✓ ¡Comenzar!</button>
                </div>
            </div>
        `;

        const renderPaso = (idx) => {
            const paso = pasos[idx];
            const accionDiv = overlay.querySelector('#tour-accion');
            const prevBtn = overlay.querySelector('#tour-prev');
            const nextBtn = overlay.querySelector('#tour-next');
            const finBtn = overlay.querySelector('#tour-fin');
            const dots = overlay.querySelectorAll('.tour-dot');

            overlay.querySelector('#tour-body .tour-icono').innerHTML = paso.icono;
            overlay.querySelector('#tour-body .tour-titulo').textContent = paso.titulo;
            overlay.querySelector('#tour-body .tour-texto').innerHTML = paso.texto.replace(/\n/g, '<br>');

            accionDiv.innerHTML = '';
            if (paso.accion) {
                const btnAccion = document.createElement('button');
                btnAccion.className = 'tour-btn-accion';
                btnAccion.textContent = paso.accion.texto;
                btnAccion.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this._ejecutarAccionTour(paso.accion.metodo, contenedor);
                });
                accionDiv.appendChild(btnAccion);
            }

            prevBtn.disabled = idx === 0;
            if (idx < pasos.length - 1) {
                nextBtn.classList.remove('d-none');
                finBtn.classList.add('d-none');
            } else {
                nextBtn.classList.add('d-none');
                finBtn.classList.remove('d-none');
            }

            dots.forEach((dot, i) => {
                dot.classList.toggle('active', i === idx);
            });
        };

        overlay.querySelector('#tour-next').addEventListener('click', () => {
            if (pasoActual < pasos.length - 1) { pasoActual++; renderPaso(pasoActual); }
        });
        overlay.querySelector('#tour-prev').addEventListener('click', () => {
            if (pasoActual > 0) { pasoActual--; renderPaso(pasoActual); }
        });
        overlay.querySelector('#tour-fin').addEventListener('click', () => overlay.remove());
        overlay.querySelector('#tour-cerrar').addEventListener('click', () => overlay.remove());
        overlay.querySelector('.tour-flotante-backdrop').addEventListener('click', () => overlay.remove());

        document.body.appendChild(overlay);
    },

    /** Ejecuta acciones contextuales del tour */
    async _ejecutarAccionTour(metodo, contenedor) {
        const overlay = document.getElementById('tour-flotante-overlay');
        if (overlay) overlay.remove();
        if (contenedor) contenedor.remove();

        switch (metodo) {
            case 'cargarDemo':
                if (await AsistenteConfiguracion._ensureSeedData()) {
                    if (!await Confirm.confirm("Cargar Demo", '¿Cargar la explotación de ejemplo "DEMO CHAMORRO"? Se añadirán datos de ejemplo en todos los módulos.', false)) return;
                    const msgDiv = document.createElement('div');
                    msgDiv.className = 'asistente-loading-overlay';
                    msgDiv.innerHTML = '<div class="text-2rem"></div><div class="text-gold font-bold">Cargando datos demo...</div><div class="text-gray text-xs">Esto puede tardar unos segundos.</div>';
                    document.body.appendChild(msgDiv);
                    setTimeout(async () => {
                        try {
                            await window.SeedData.run(true);
                            window.location.reload();
                        } catch (e) {
                            await Confirm.alert("Error", 'Error: ' + e.message);
                            window.location.reload();
                        }
                    }, 300);
                } else {
                    await Confirm.alert("Error", 'Módulo de datos demo no disponible.');
                }
                break;

            case 'abrirManuales':
                window.location.hash = '#/ajustes';
                if (window.App && typeof window.App.renderAjustes === 'function') {
                    window.App.renderAjustes();
                    setTimeout(() => {
                        if (window.ManualesView && typeof window.ManualesView.render === 'function') {
                            window.ManualesView.render();
                        }
                    }, 500);
                }
                break;
        }
    }
};

window.AsistenteConfiguracion = AsistenteConfiguracion;
