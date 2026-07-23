/**
 * Livestock Manager - MargenAnimalView v1.0.0
 * Listado/ranking de margen económico por animal (js/margen-animal.js),
 * ordenable por margen neto para detectar animales poco rentables.
 */
const MargenAnimalView = {
  _cache: [],
  _orden: 'asc',

  async render() {
    if (window.App) App.updateHeaderColor('margen-animal');
    const main = document.getElementById("app-content");
    const finca = await Fincas.getActive();
    if (!finca) {
      main.innerHTML = `<div class="empty-state"><p class="empty-state-text">Selecciona una finca activa primero.</p></div>`;
      return;
    }

    const margenes = await window.MargenAnimal.calcularParaFinca(finca.id);
    const animales = await Promise.all(margenes.map((m) => window.Animales.get(m.animalId)));
    this._cache = margenes.map((m, i) => ({ ...m, animal: animales[i] })).filter((r) => r.animal);

    this._render();
  },

  _render() {
    const main = document.getElementById("app-content");
    const filas = [...this._cache].sort((a, b) =>
      this._orden === 'asc' ? a.margenNeto - b.margenNeto : b.margenNeto - a.margenNeto
    );

    let html = `<div class="mb-20"><h2 class="mt-10 font-900 uppercase tracking-wider"><span style="color: var(--neon);">|</span> ${Icons.documento()} MARGEN ECONÓMICO POR ANIMAL</h2></div>`;

    if (filas.length === 0) {
      html += `<div class="empty-state"><p class="empty-state-text">Sin animales con datos suficientes para calcular margen.</p></div>`;
    } else {
      html += `<div class="mb-15"><button class="btn btn-secondary" onclick="MargenAnimalView._toggleOrden()">Ordenar: ${this._orden === 'asc' ? 'Peor primero' : 'Mejor primero'}</button></div>`;
      html += `<div class="flex flex-col gap-8">`;
      filas.forEach((f) => {
        const color = f.margenNeto >= 0 ? 'var(--c-success)' : 'var(--c-danger)';
        html += `
          <div class="card-registro" style="--registro-color: ${color};" onclick="location.hash='/animal?id=${f.animalId}'">
            <div class="flex justify-between items-center">
              <div>
                <div class="font-900 uppercase">${(f.animal.numero_identificacion || ('#' + f.animalId))}</div>
                <div class="text-xs text-gray">Coste: ${f.costeTotal.toFixed(2)} € · Ingreso: ${f.ingresoTotal.toFixed(2)} €</div>
              </div>
              <div class="font-950 text-lg" style="color: ${color};">${f.margenNeto.toFixed(2)} €</div>
            </div>
          </div>`;
      });
      html += `</div>`;
    }

    main.innerHTML = html;
  },

  _toggleOrden() {
    this._orden = this._orden === 'asc' ? 'desc' : 'asc';
    this._render();
  },
};

window.MargenAnimalView = MargenAnimalView;