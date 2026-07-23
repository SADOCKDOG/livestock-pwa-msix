console.log("[DB] Cargando script db.js");
const DB_NAME = 'LivestockDB';
const DB_VERSION = 23;

// Datos maestros oficiales de Especie / Tipo de Identificador — ver
// docs/NORMATIVA-CROTAL-ESPECIE.md para la fuente normativa de cada valor.
// Compartidos entre InMemoryMockDB (fallback sandboxed) y populateDefaults
// (IndexedDB real) para que ambos caminos vean siempre los mismos datos.

// especies.id = código SIEX oficial del catálogo ESPECIE_ANIMAL del FEGA
// (docs/AUDITAR/Catalogos_csv/Especies animales.csv). nombre_display conserva
// la etiqueta coloquial que ya ve el usuario en el selector de especie.
//
// codigo_espe_siggan / espe_id_siggan: codificación de especie que usa el
// PROPIO chip/fichero de incorporación SIGGAN (campo `Espe`), que es DISTINTA
// de codigo_siex — ver docs/NORMATIVA-CROTAL-ESPECIE.md sección
// "Especificación oficial y exacta: fichero de incorporación de datos a
// SIGGAN". Ovino y Caprino comparten codigo_espe_siggan '04' y se distinguen
// por espe_id_siggan (2=caprino, 3=ovino). Solo aplica al caso SIGGAN/
// Andalucía; Extremadura/BADIGEX usa su propia numeración (ver advertencia
// regional en el mismo documento). No usado todavía por ningún exportador —
// son solo los datos maestros listos para cuando se aborde esa integración.
const ESPECIES_SEED = [
    { id: 1, codigo_siex: '01', nombre_oficial: 'Bovino', nombre_display: 'Vacas', codigo_familia: '01', codigo_espe_siggan: '02', espe_id_siggan: null },
    { id: 2, codigo_siex: '02', nombre_oficial: 'Porcino', nombre_display: 'Cerdos', codigo_familia: '02', codigo_espe_siggan: '03', espe_id_siggan: null },
    { id: 3, codigo_siex: '03', nombre_oficial: 'Ovino', nombre_display: 'Ovejas', codigo_familia: '03', codigo_espe_siggan: '04', espe_id_siggan: 3 },
    { id: 4, codigo_siex: '04', nombre_oficial: 'Caprino', nombre_display: 'Cabras', codigo_familia: '03', codigo_espe_siggan: '04', espe_id_siggan: 2 },
    { id: 5, codigo_siex: '05', nombre_oficial: 'Équido', nombre_display: 'Équidos', codigo_familia: '04', codigo_espe_siggan: '01', espe_id_siggan: null },
];

// tipos_identificador.id = código oficial del catálogo RIIA_TIPO_IDENTIFICADOR
// del FEGA (docs/AUDITAR/Catalogos_csv/Tipo de identificador.csv). Los que
// tienen fecha_baja no deben ofrecerse en altas nuevas (ver UI), pero se
// mantienen en el catálogo para poder leer/mostrar animales históricos.
const TIPOS_IDENTIFICADOR_SEED = [
    { id: 1, nombre: 'Crotal', fecha_baja: '2011-09-05' },
    { id: 2, nombre: 'Bolo ruminal', fecha_baja: null },
    { id: 3, nombre: 'Inyectable electrónico', fecha_baja: null },
    { id: 4, nombre: 'Crotal electrónico', fecha_baja: null },
    { id: 5, nombre: 'Fotografías', fecha_baja: null },
    { id: 6, nombre: 'Reseña', fecha_baja: null },
    { id: 7, nombre: 'Palatograma', fecha_baja: null },
    { id: 8, nombre: 'Identificación biométrica por la retina', fecha_baja: null },
    { id: 9, nombre: 'Tatuaje', fecha_baja: null },
    { id: 10, nombre: 'Fuego', fecha_baja: null },
    { id: 11, nombre: 'Nitrógeno líquido', fecha_baja: null },
    { id: 12, nombre: 'Marcadores genéticos', fecha_baja: null },
    { id: 13, nombre: 'Pulsera electrónica', fecha_baja: null },
    { id: 14, nombre: 'DIE', fecha_baja: null },
    { id: 15, nombre: 'Pasaporte', fecha_baja: '2012-06-28' },
    { id: 16, nombre: 'Crotal visual', fecha_baja: null },
];

// razas.id = correlativo interno; codigo_siex = código oficial del catálogo
// RAZAS/CLASIFICACION_RAZAS del FEGA (docs/AUDITAR/Catalogos_csv/Catálogo
// oficial de razas de ganado de España.csv), filtrado a las 5 especies ya
// modeladas (excluye gallinas/ocas/conejos/dromedario). especieId referencia
// ESPECIES_SEED. clasificacion = código de
// docs/AUDITAR/Catalogos_csv/Clasificación en el catálogo oficial de razas
// de ganado de España.csv (1001 Autóctona, 1002 Autóctona Amenazada, 1003
// Integrada en España, 1004 Otras reconocidas). grado_amenaza solo aplica a
// razas amenazadas (1002); null en el resto.
const RAZAS_SEED = [
    { id: 1, codigo_siex: '10010', nombre: 'ALBERA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 2, codigo_siex: '10020', nombre: 'ALISTANA-SANABRESA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 3, codigo_siex: '10030', nombre: 'ASTURIANA DE LA MONTAÑA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 4, codigo_siex: '10040', nombre: 'ASTURIANA DE LOS VALLES', especieId: 1, clasificacion: 1001, grado_amenaza: null },
    { id: 5, codigo_siex: '10050', nombre: 'AVILEÑA-NEGRA IBÉRICA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 6, codigo_siex: '10051', nombre: 'AVILEÑA-NEGRA IBÉRICA (VARIEDAD BOCIBLANCA)', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 7, codigo_siex: '10060', nombre: 'BERRENDA EN COLORADO', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 8, codigo_siex: '10070', nombre: 'BERRENDA EN NEGRO', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 9, codigo_siex: '10080', nombre: 'BETIZU', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 10, codigo_siex: '10090', nombre: 'BLANCA CACEREÑA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 11, codigo_siex: '10100', nombre: 'BLONDA DE AQUITANIA', especieId: 1, clasificacion: 1003, grado_amenaza: null },
    { id: 12, codigo_siex: '10110', nombre: 'BRUNA DELS PIRINEUS', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 13, codigo_siex: '10120', nombre: 'CACHENA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 14, codigo_siex: '10130', nombre: 'CALDELÁ', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 15, codigo_siex: '10140', nombre: 'CANARIA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 16, codigo_siex: '10150', nombre: 'CÁRDENA ANDALUZA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 17, codigo_siex: '10160', nombre: 'CHAROLESA', especieId: 1, clasificacion: 1003, grado_amenaza: null },
    { id: 18, codigo_siex: '10170', nombre: 'FLECKVIEH', especieId: 1, clasificacion: 1003, grado_amenaza: null },
    { id: 19, codigo_siex: '10180', nombre: 'FRIEIRESA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 20, codigo_siex: '10190', nombre: 'FRISONA', especieId: 1, clasificacion: 1003, grado_amenaza: null },
    { id: 21, codigo_siex: '10200', nombre: 'LIDIA', especieId: 1, clasificacion: 1001, grado_amenaza: null },
    { id: 22, codigo_siex: '10210', nombre: 'LIMIÁ', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 23, codigo_siex: '10220', nombre: 'LIMUSINA', especieId: 1, clasificacion: 1003, grado_amenaza: null },
    { id: 24, codigo_siex: '10230', nombre: 'MALLORQUINA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 25, codigo_siex: '10240', nombre: 'MARISMEÑA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 26, codigo_siex: '10250', nombre: 'MENORQUINA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 27, codigo_siex: '10260', nombre: 'MONCHINA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 28, codigo_siex: '10270', nombre: 'MORUCHA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 29, codigo_siex: '10271', nombre: 'MORUCHA (VARIEDAD NEGRA)', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 30, codigo_siex: '10280', nombre: 'MURCIANA-LEVANTINA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 31, codigo_siex: '10290', nombre: 'NEGRA ANDALUZA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 32, codigo_siex: '10300', nombre: 'PAJUNA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 33, codigo_siex: '10310', nombre: 'PALLARESA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 34, codigo_siex: '10320', nombre: 'PALMERA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 35, codigo_siex: '10330', nombre: 'PARDA', especieId: 1, clasificacion: 1003, grado_amenaza: null },
    { id: 36, codigo_siex: '10340', nombre: 'PARDA DE MONTAÑA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 37, codigo_siex: '10350', nombre: 'PASIEGA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 38, codigo_siex: '10360', nombre: 'PIRENAICA', especieId: 1, clasificacion: 1001, grado_amenaza: null },
    { id: 39, codigo_siex: '10370', nombre: 'RETINTA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 40, codigo_siex: '10380', nombre: 'RUBIA GALLEGA', especieId: 1, clasificacion: 1001, grado_amenaza: null },
    { id: 41, codigo_siex: '10390', nombre: 'SAYAGUESA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 42, codigo_siex: '10400', nombre: 'SERRANA DE TERUEL', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 43, codigo_siex: '10410', nombre: 'SERRANA NEGRA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 44, codigo_siex: '10420', nombre: 'TERREÑA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 45, codigo_siex: '10430', nombre: 'TUDANCA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 46, codigo_siex: '10440', nombre: 'VIANESA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 47, codigo_siex: '10450', nombre: 'MANTEQUERA LEONESA', especieId: 1, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 48, codigo_siex: '20020', nombre: 'CHATO MURCIANO', especieId: 2, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 49, codigo_siex: '20030', nombre: 'DUROC', especieId: 2, clasificacion: 1003, grado_amenaza: null },
    { id: 50, codigo_siex: '20040', nombre: 'EUSKAL TXERRIA', especieId: 2, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 51, codigo_siex: '20050', nombre: 'GOCHU ASTURCELTA', especieId: 2, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 52, codigo_siex: '20070', nombre: 'IBÉRICO', especieId: 2, clasificacion: 1001, grado_amenaza: null },
    { id: 53, codigo_siex: '20071', nombre: 'IBÉRICO (VARIEDAD ENTREPELADO)', especieId: 2, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 54, codigo_siex: '20072', nombre: 'IBÉRICO (VARIEDAD LAMPIÑO)', especieId: 2, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 55, codigo_siex: '20073', nombre: 'IBÉRICO (VARIEDAD MANCHADO DE JABUGO)', especieId: 2, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 56, codigo_siex: '20074', nombre: 'IBÉRICO (VARIEDAD RETINTO)', especieId: 2, clasificacion: 1001, grado_amenaza: null },
    { id: 57, codigo_siex: '20075', nombre: 'IBÉRICO (VARIEDAD TORBISCAL)', especieId: 2, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 58, codigo_siex: '20080', nombre: 'LANDRACE', especieId: 2, clasificacion: 1003, grado_amenaza: null },
    { id: 59, codigo_siex: '20090', nombre: 'LARGE WHITE', especieId: 2, clasificacion: 1003, grado_amenaza: null },
    { id: 60, codigo_siex: '20100', nombre: 'NEGRA CANARIA', especieId: 2, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 61, codigo_siex: '20110', nombre: 'PIETRAIN', especieId: 2, clasificacion: 1003, grado_amenaza: null },
    { id: 62, codigo_siex: '20120', nombre: 'PORC NEGRE MALLORQUÍ', especieId: 2, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 63, codigo_siex: '20130', nombre: 'PORCO CELTA', especieId: 2, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 64, codigo_siex: '30010', nombre: 'ALCARREÑA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 65, codigo_siex: '30020', nombre: 'ANSOTANA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 66, codigo_siex: '30030', nombre: 'ARANESA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 67, codigo_siex: '30040', nombre: 'ASSAF', especieId: 3, clasificacion: 1004, grado_amenaza: null },
    { id: 68, codigo_siex: '30050', nombre: 'BERRICHON DU CHER', especieId: 3, clasificacion: 1003, grado_amenaza: null },
    { id: 69, codigo_siex: '30060', nombre: 'CANARIA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 70, codigo_siex: '30070', nombre: 'CANARIA DE PELO', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 71, codigo_siex: '30080', nombre: 'CARRANZANA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 72, codigo_siex: '30081', nombre: 'CARRANZANA (VARIEDAD NEGRA)', especieId: 3, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 73, codigo_siex: '30090', nombre: 'CARTERA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 74, codigo_siex: '30100', nombre: 'CASTELLANA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 75, codigo_siex: '30101', nombre: 'CASTELLANA (VARIEDAD NEGRA)', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 76, codigo_siex: '30110', nombre: 'CHAMARITA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 77, codigo_siex: '30130', nombre: 'CHURRA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 78, codigo_siex: '30140', nombre: 'CHURRA LEBRIJANA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 79, codigo_siex: '30150', nombre: 'CHURRA TENSINA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 80, codigo_siex: '30160', nombre: 'COLMENAREÑA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 81, codigo_siex: '30170', nombre: 'FLEISCHSCHAF', especieId: 3, clasificacion: 1003, grado_amenaza: null },
    { id: 82, codigo_siex: '30180', nombre: 'GUIRRA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 83, codigo_siex: '30190', nombre: 'ÎLE DE FRANCE', especieId: 3, clasificacion: 1003, grado_amenaza: null },
    { id: 84, codigo_siex: '30200', nombre: 'LACAUNE', especieId: 3, clasificacion: 1004, grado_amenaza: null },
    { id: 85, codigo_siex: '30220', nombre: 'LATXA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 86, codigo_siex: '30230', nombre: 'LOJEÑA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 87, codigo_siex: '30240', nombre: 'MAELLANA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 88, codigo_siex: '30250', nombre: 'MANCHEGA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 89, codigo_siex: '30251', nombre: 'MANCHEGA (VARIEDAD NEGRA)', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 90, codigo_siex: '30260', nombre: 'MERINA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 91, codigo_siex: '30261', nombre: 'MERINA (VARIEDAD DE LOS MONTES UNIVERSALES)', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 92, codigo_siex: '30262', nombre: 'MERINA (VARIEDAD NEGRA)', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 93, codigo_siex: '30270', nombre: 'MERINA DE GRAZALEMA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 94, codigo_siex: '30280', nombre: 'MERINO PRECOZ', especieId: 3, clasificacion: 1003, grado_amenaza: null },
    { id: 95, codigo_siex: '30290', nombre: 'MONTESINA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 96, codigo_siex: '30300', nombre: 'NAVARRA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 97, codigo_siex: '30310', nombre: 'OJALADA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 98, codigo_siex: '30320', nombre: 'OJINEGRA DE TERUEL', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 99, codigo_siex: '30330', nombre: 'OVELLA EIVISSENCA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 100, codigo_siex: '30340', nombre: 'OVELLA GALEGA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 101, codigo_siex: '30350', nombre: 'OVELLA MALLORQUINA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 102, codigo_siex: '30360', nombre: 'OVELLA MENORQUINA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 103, codigo_siex: '30370', nombre: 'OVELLA ROJA MALLORQUINA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 104, codigo_siex: '30380', nombre: 'PALMERA.', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 105, codigo_siex: '30390', nombre: 'RASA ARAGONESA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 106, codigo_siex: '30400', nombre: 'RIPOLLESA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 107, codigo_siex: '30410', nombre: 'ROYA BILBILITANA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 108, codigo_siex: '30420', nombre: 'RUBIA DE EL MOLAR', especieId: 3, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 109, codigo_siex: '30430', nombre: 'SALZ', especieId: 3, clasificacion: 1004, grado_amenaza: null },
    { id: 110, codigo_siex: '30440', nombre: 'SASI ARDI', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 111, codigo_siex: '30450', nombre: 'SEGUREÑA', especieId: 3, clasificacion: 1001, grado_amenaza: null },
    { id: 112, codigo_siex: '30460', nombre: 'TALAVERANA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 113, codigo_siex: '30470', nombre: 'XALDA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 114, codigo_siex: '30480', nombre: 'XISQUETA', especieId: 3, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 115, codigo_siex: '40020', nombre: 'AZPI GORRI', especieId: 4, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 116, codigo_siex: '40030', nombre: 'BERMEYA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 117, codigo_siex: '40040', nombre: 'BLANCA ANDALUZA O SERRANA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 118, codigo_siex: '40050', nombre: 'BLANCA CELTIBÉRICA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 119, codigo_siex: '40060', nombre: 'BLANCA DE RASQUERA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 120, codigo_siex: '40070', nombre: 'CABRA DE LAS MESETAS', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 121, codigo_siex: '40080', nombre: 'CABRA GALEGA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 122, codigo_siex: '40090', nombre: 'DEL GUADARRAMA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 123, codigo_siex: '40100', nombre: 'EIVISSENCA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 124, codigo_siex: '40110', nombre: 'FLORIDA', especieId: 4, clasificacion: 1001, grado_amenaza: null },
    { id: 125, codigo_siex: '40130', nombre: 'MAJORERA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 126, codigo_siex: '40140', nombre: 'MALAGUEÑA', especieId: 4, clasificacion: 1001, grado_amenaza: null },
    { id: 127, codigo_siex: '40150', nombre: 'MALLORQUINA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 128, codigo_siex: '40160', nombre: 'MONCAÍNA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 129, codigo_siex: '40170', nombre: 'MURCIANA-GRANADINA', especieId: 4, clasificacion: 1001, grado_amenaza: null },
    { id: 130, codigo_siex: '40180', nombre: 'NEGRA SERRANA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 131, codigo_siex: '40190', nombre: 'PALMERA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 132, codigo_siex: '40200', nombre: 'PAYOYA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 133, codigo_siex: '40210', nombre: 'PIRENAICA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 134, codigo_siex: '40220', nombre: 'RETINTA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 135, codigo_siex: '40230', nombre: 'TINERFEÑA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 136, codigo_siex: '40240', nombre: 'VERATA', especieId: 4, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 137, codigo_siex: '480010', nombre: 'ANGLO-ÁRABE', especieId: 5, clasificacion: 1003, grado_amenaza: null },
    { id: 138, codigo_siex: '480020', nombre: 'ÁRABE', especieId: 5, clasificacion: 1003, grado_amenaza: null },
    { id: 139, codigo_siex: '480030', nombre: 'ASTURCÓN', especieId: 5, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 140, codigo_siex: '480040', nombre: 'BURGUETE', especieId: 5, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 141, codigo_siex: '480050', nombre: 'CABALLO DE DEPORTE ESPAÑOL', especieId: 5, clasificacion: 1004, grado_amenaza: null },
    { id: 142, codigo_siex: '480060', nombre: 'CABALLO DE LAS RETUERTAS', especieId: 5, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 143, codigo_siex: '480070', nombre: 'CABALLO DE MONTE DE PAÍS VASCO', especieId: 5, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 144, codigo_siex: '480080', nombre: 'CABALO DE PURA RAZA GALEGA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 145, codigo_siex: '480090', nombre: 'CAVALL MALLORQUÍ', especieId: 5, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 146, codigo_siex: '480100', nombre: 'MENORQUINA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 147, codigo_siex: '480110', nombre: 'CAVALL PIRINENC CATALÀ', especieId: 5, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 148, codigo_siex: '480120', nombre: 'HISPANO-ÁRABE', especieId: 5, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 149, codigo_siex: '480130', nombre: 'HISPANO-BRETÓN', especieId: 5, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 150, codigo_siex: '480140', nombre: 'JACA NAVARRA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Bajo' },
    { id: 151, codigo_siex: '480150', nombre: 'LOSINA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 152, codigo_siex: '480160', nombre: 'MARISMEÑA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 153, codigo_siex: '480170', nombre: 'MONCHINA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Medio' },
    { id: 154, codigo_siex: '480180', nombre: 'POTTOKA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 155, codigo_siex: '480190', nombre: 'PURA RAZA ESPAÑOLA', especieId: 5, clasificacion: 1001, grado_amenaza: null },
    { id: 156, codigo_siex: '480200', nombre: 'PURA SANGRE INGLÉS', especieId: 5, clasificacion: 1003, grado_amenaza: null },
    { id: 157, codigo_siex: '480210', nombre: 'TROTADOR ESPAÑOL', especieId: 5, clasificacion: 1003, grado_amenaza: null },
    { id: 158, codigo_siex: '510010', nombre: 'ANDALUZA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 159, codigo_siex: '510020', nombre: 'ASE BALEAR', especieId: 5, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 160, codigo_siex: '510030', nombre: 'ASNO DE LAS ENCARTACIONES', especieId: 5, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 161, codigo_siex: '510040', nombre: 'CATALANA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Alto' },
    { id: 162, codigo_siex: '510050', nombre: 'MAJORERA', especieId: 5, clasificacion: 1002, grado_amenaza: 'Desconocido' },
    { id: 163, codigo_siex: '510060', nombre: 'ZAMORANO-LEONÉS', especieId: 5, clasificacion: 1002, grado_amenaza: 'Medio' },
];

// Asociación especie -> tipos de identificador válidos, con el nombre del
// patrón de validación a aplicar (ver ErrorHandler.CROTAL_FORMATOS).
// Equino: el microchip (tipoIdentificadorId 3, "Inyectable electrónico") es
// obligatorio siempre y tiene formato cerrado (UELN 15 dígitos); el DIE/
// pasaporte (id 14) es complementario pero su formato varía por entidad
// emisora (hay ejemplos heredados no numéricos, ver NORMATIVA-CROTAL-ESPECIE.md),
// por eso se deja sin regex estricta (formato:null).
const ESPECIE_TIPO_IDENTIFICADOR_SEED = [
    { especieId: 1, tipoIdentificadorId: 16, formato: 'bovino_fisico' },
    { especieId: 2, tipoIdentificadorId: 16, formato: 'porcino_marca_explotacion' },
    { especieId: 3, tipoIdentificadorId: 2, formato: 'ovino_caprino_eid' },
    { especieId: 3, tipoIdentificadorId: 3, formato: 'ovino_caprino_eid' },
    { especieId: 3, tipoIdentificadorId: 4, formato: 'ovino_caprino_eid' },
    { especieId: 4, tipoIdentificadorId: 2, formato: 'ovino_caprino_eid' },
    { especieId: 4, tipoIdentificadorId: 3, formato: 'ovino_caprino_eid' },
    { especieId: 4, tipoIdentificadorId: 4, formato: 'ovino_caprino_eid' },
    { especieId: 5, tipoIdentificadorId: 3, formato: 'equino_microchip' },
    { especieId: 5, tipoIdentificadorId: 14, formato: null },
];

// Catálogo de tipos de instalación/edificación ganadera — subconjunto
// curado (36 de los 109 valores oficiales) del catálogo FEGA
// EDIFICACIONES_INSTALACIONES (docs/AUDITAR/Catalogos_csv/Edificaciones
// e instalaciones.csv), excluyendo tipos puramente agrícolas
// (invernaderos, viñedo, semillas...) fuera del alcance ganadero de la
// app. codigo_siex conserva el código oficial para trazabilidad. Ver
// docs/PLAN-MEJORA-SIGGAN.md punto 5.
const INSTALACIONES_TIPO_SEED = [
    { id: 1, codigo_siex: '1', nombre: 'Abrevadero y abastecimiento de agua' },
    { id: 2, codigo_siex: '5', nombre: 'Alojamiento ganadero aves' },
    { id: 3, codigo_siex: '6', nombre: 'Alojamiento ganadero bovino de carne' },
    { id: 4, codigo_siex: '7', nombre: 'Alojamiento ganadero bovino de leche' },
    { id: 5, codigo_siex: '8', nombre: 'Alojamiento ganadero conejos' },
    { id: 6, codigo_siex: '9', nombre: 'Alojamiento ganadero equino' },
    { id: 7, codigo_siex: '10', nombre: 'Alojamiento ganadero porcino' },
    { id: 8, codigo_siex: '11', nombre: 'Alojamiento ganadero varios' },
    { id: 9, codigo_siex: '12', nombre: 'Alojamiento ganadero visones y otros peleteros' },
    { id: 10, codigo_siex: '13', nombre: 'Baño' },
    { id: 11, codigo_siex: '14', nombre: 'Comedor' },
    { id: 12, codigo_siex: '21', nombre: 'Construcción para reparación edificios e instalaciones' },
    { id: 13, codigo_siex: '28', nombre: 'Nave ganadera' },
    { id: 14, codigo_siex: '31', nombre: 'Nave para transformación de productos en origen, queserías y otros lácteos.' },
    { id: 15, codigo_siex: '32', nombre: 'Ranchos' },
    { id: 16, codigo_siex: '33', nombre: 'Refugios' },
    { id: 17, codigo_siex: '42', nombre: 'Picaderos' },
    { id: 18, codigo_siex: '43', nombre: 'Plazas de toros' },
    { id: 19, codigo_siex: '44', nombre: 'Tentaderos' },
    { id: 20, codigo_siex: '46', nombre: 'Caminos de la explotación' },
    { id: 21, codigo_siex: '52', nombre: 'Estacionamientos maquinaria agrícola y de transporte' },
    { id: 22, codigo_siex: '55', nombre: 'Muelles de carga' },
    { id: 23, codigo_siex: '58', nombre: 'Recintos para el recibo y acopio de materias primas' },
    { id: 24, codigo_siex: '59', nombre: 'Cámaras frigoríficas' },
    { id: 25, codigo_siex: '63', nombre: 'Depuradoras' },
    { id: 26, codigo_siex: '65', nombre: 'Saneamiento, desagües, drenajes y fosas' },
    { id: 27, codigo_siex: '68', nombre: 'Depósito de líquido' },
    { id: 28, codigo_siex: '69', nombre: 'Depósitos de gas' },
    { id: 29, codigo_siex: '70', nombre: 'Estanques y balsas' },
    { id: 30, codigo_siex: '71', nombre: 'Fosas de purín' },
    { id: 31, codigo_siex: '72', nombre: 'Silos de grano' },
    { id: 32, codigo_siex: '73', nombre: 'Silos forrajeros, heniles y pajares' },
    { id: 33, codigo_siex: '89', nombre: 'Alojamiento ganadero ovino' },
    { id: 34, codigo_siex: '90', nombre: 'Alojamiento ganadero caprino' },
    { id: 35, codigo_siex: '94', nombre: 'Oficina' },
    { id: 36, codigo_siex: '109', nombre: 'Cerramientos de la explotación' },
];

// Clase para base de datos en memoria (Fallback para entornos sandboxed o sin permisos de IndexedDB, como Open Design Desktop)
class InMemoryMockDB {
    constructor() {
        console.log("[DB] Inicializando base de datos simulada en memoria (InMemoryMockDB)");
        this.objectStoreNames = {
            names: [
                'fincas', 'rebanos', 'animales', 'produccion_carne', 'produccion_leche', 
                'ventas_ganado', 'sanitarios_ganado', 'gastos_ganaderia', 'config_especies', 
                'config_tipos_produccion', 'comercializacion_carne', 'comercializacion_leche', 
                'meta', 'registro_eventos', 'reproduccion_eventos', 'compradores', 'proveedores', 
                'contratos_compra', 'transportistas', 'documentos_legales', 'notificaciones_rega', 
                'pedidos_crotales', 'movimientos_ganado', 'saneamientos', 'adsgs',
                'config_costes_referencia', 'config_silos', 'especies', 'tipos_identificador',
                'especie_tipo_identificador', 'razas', 'vacunaciones', 'instalaciones_tipo',
                'config_botiquin', 'agenda_tareas'
            ],
            contains(name) { return this.names.includes(name); }
        };
        this._stores = {};
        this.objectStoreNames.names.forEach(name => {
            this._stores[name] = [];
        });
        this._seedMockData();
    }

    _seedMockData() {
        // Datos por defecto para que la aplicación muestre información visual premium
        this._stores['fincas'] = [
            { id: 1, nombre: 'Finca El Encinar', REGA: 'ES3712345678', rega: 'ES3712345678', codigo_REGA: 'ES3712345678', superficie: 150, municipio: 'Salamanca', creadoEn: new Date().toISOString() }
        ];
        this._stores['rebanos'] = [
            { id: 1, fincaId: 1, codigo: 'REB-001', nombre: 'Lote Reproductoras Frisonas', especie: 'Vacas', zonaActual: 'Prado Alto', creadoEn: new Date().toISOString() },
            { id: 2, fincaId: 1, codigo: 'REB-002', nombre: 'Terneros Limusín Cebo', especie: 'Vacas', zonaActual: 'Cercado Bajo', creadoEn: new Date().toISOString() }
        ];
        this._stores['animales'] = [
            { id: 1, rebanoId: 1, numero_identificacion: 'ES0811122233', caravana: 'ES0811122233', especie: 'Vacas', raza: 'Frisona', sexo: 'Hembra', fecha_nacimiento: '2022-04-10', estado: 'activo', categoria: 'leche', creadoEn: new Date().toISOString() },
            { id: 2, rebanoId: 1, numero_identificacion: 'ES0811122234', caravana: 'ES0811122234', especie: 'Vacas', raza: 'Limusina', sexo: 'Hembra', fecha_nacimiento: '2021-11-15', estado: 'activo', categoria: 'carne', creadoEn: new Date().toISOString() },
            { id: 3, rebanoId: 2, numero_identificacion: 'ES0911122235', caravana: 'ES0911122235', especie: 'Ovejas', raza: 'Assaf', sexo: 'Hembra', fecha_nacimiento: '2023-01-20', estado: 'activo', categoria: 'leche', creadoEn: new Date().toISOString() }
        ];
        this._stores['config_especies'] = [
            { id: 1, nombre: 'Vacas', consumoAguaL: 60, creadoEn: Date.now() },
            { id: 2, nombre: 'Ovejas', consumoAguaL: 8, creadoEn: Date.now() },
            { id: 3, nombre: 'Cabras', consumoAguaL: 8, creadoEn: Date.now() },
            { id: 4, nombre: 'Cerdos', consumoAguaL: 12, creadoEn: Date.now() }
        ];
        this._stores['especies'] = ESPECIES_SEED.map(e => ({ ...e }));
        this._stores['tipos_identificador'] = TIPOS_IDENTIFICADOR_SEED.map(t => ({ ...t }));
        this._stores['especie_tipo_identificador'] = ESPECIE_TIPO_IDENTIFICADOR_SEED.map((a, i) => ({ id: i + 1, ...a }));
        this._stores['razas'] = RAZAS_SEED.map(r => ({ ...r }));
        this._stores['instalaciones_tipo'] = INSTALACIONES_TIPO_SEED.map(i => ({ ...i }));
        this._stores['config_tipos_produccion'] = [
            { id: 1, nombre: 'Cárnica', creadoEn: Date.now() },
            { id: 2, nombre: 'Láctea', creadoEn: Date.now() },
            { id: 3, nombre: 'Mixto', creadoEn: Date.now() },
            { id: 4, nombre: 'Ibérico', creadoEn: Date.now() }
        ];
        this._stores['meta'] = [
            { key: 'migracion_v8', value: true, migradoEn: new Date().toISOString() },
            { key: 'migracion_v9', value: true, migradoEn: new Date().toISOString() },
            { key: 'contador_albaran', valor: 10, actualizadoEn: new Date().toISOString() },
            { key: 'contador_factura', valor: 5, actualizadoEn: new Date().toISOString() }
        ];
        this._stores['compradores'] = [
            { id: 1, nombre: 'Matadero Central de Salamanca', nif_cif: 'A37123456', tipo_comprador: 'carne', activo: true, creadoEn: new Date().toISOString() },
            { id: 2, nombre: 'Lácteas del Duero', nif_cif: 'B49123456', tipo_comprador: 'leche', activo: true, creadoEn: new Date().toISOString() }
        ];
        this._stores['proveedores'] = [
            { id: 1, nombre: 'Piensos Salamanca S.A.', nif_cif: 'A37987654', activo: true, creadoEn: new Date().toISOString() },
            { id: 2, nombre: 'Veterinaria VetCampo', nif_cif: 'B37111222', activo: true, creadoEn: new Date().toISOString() }
        ];
        this._stores['registro_eventos'] = [
            { id: 1, fincaId: 1, entidad_id: 1, tipo_entidad: 'animal', snap_tipo: 'alta', motivo_tarea: 'Compra externa', fecha: new Date().toISOString().split('T')[0], creadoEn: new Date().toISOString() }
        ];
    }

    async get(storeName, key) {
        const store = this._stores[storeName] || [];
        if (storeName === 'meta') {
            return store.find(item => item.key === key);
        }
        return store.find(item => item.id == key);
    }

    async getAll(storeName) {
        return [...(this._stores[storeName] || [])];
    }

    async add(storeName, item) {
        const store = this._stores[storeName] || [];
        let newId = 1;
        if (store.length > 0) {
            const ids = store.map(i => i.id).filter(id => typeof id === 'number');
            if (ids.length > 0) {
                newId = Math.max(...ids) + 1;
            }
        }
        const newItem = { ...item };
        if (storeName === 'meta') {
            // no numeric id for meta
        } else if (newItem.id === undefined) {
            newItem.id = newId;
        }
        store.push(newItem);
        return storeName === 'meta' ? newItem.key : newItem.id;
    }

    async put(storeName, item) {
        const store = this._stores[storeName] || [];
        if (storeName === 'meta') {
            const idx = store.findIndex(i => i.key === item.key);
            if (idx !== -1) {
                store[idx] = { ...item };
            } else {
                store.push({ ...item });
            }
            return item.key;
        }
        const idx = store.findIndex(i => i.id == item.id);
        if (idx !== -1) {
            store[idx] = { ...item };
        } else {
            store.push({ ...item });
        }
        return item.id;
    }

    async delete(storeName, key) {
        const store = this._stores[storeName] || [];
        if (storeName === 'meta') {
            this._stores[storeName] = store.filter(item => item.key !== key);
        } else {
            this._stores[storeName] = store.filter(item => item.id != key);
        }
    }

    async count(storeName) {
        const store = this._stores[storeName] || [];
        return store.length;
    }

    async getFromIndex(storeName, indexName, value) {
        const store = this._stores[storeName] || [];
        const matched = store.find(item => {
            if (indexName === 'caravana' || indexName === 'numero_identificacion') {
                return item.numero_identificacion === value || item.caravana === value;
            }
            let itemVal = item[indexName];
            if (typeof itemVal === 'string' && typeof value === 'string') {
                return itemVal.toLowerCase() === value.toLowerCase();
            }
            return itemVal == value;
        });
        if (!matched) throw new Error("Key not found in index: " + indexName + " = " + value);
        return matched;
    }

    async getAllFromIndex(storeName, indexName, value) {
        const store = this._stores[storeName] || [];
        return store.filter(item => {
            let itemVal = item[indexName];
            if (['fincaId', 'rebanoId', 'animalId'].includes(indexName)) {
                return Number(itemVal) === Number(value);
            }
            if (typeof itemVal === 'string' && typeof value === 'string') {
                return itemVal.toLowerCase() === value.toLowerCase();
            }
            return itemVal == value;
        });
    }

    transaction(storeNames, mode) {
        const self = this;
        const names = Array.isArray(storeNames) ? storeNames : [storeNames];
        const tx = {
            done: Promise.resolve(),
            objectStore(name) {
                return {
                    indexNames: {
                        contains: (indexName) => {
                            const knownIndexes = ['fincaId', 'rebanoId', 'animalId', 'caravana', 'numero_identificacion', 'nif_cif', 'activo', 'especie', 'rega', 'dib', 'categoria', 'madre_id', 'numero_albaran', 'dimoe', 'transportistaId', 'autorizacion_veterinaria', 'tipo', 'fecha_emision', 'numero', 'especieId'];
                            return knownIndexes.includes(indexName);
                        }
                    },
                    createIndex: () => {},
                    get: async (key) => await self.get(name, key),
                    getAll: async () => await self.getAll(name),
                    add: async (item) => await self.add(name, item),
                    put: async (item) => await self.put(name, item),
                    delete: async (key) => await self.delete(name, key),
                    count: async () => await self.count(name)
                };
            }
        };
        if (names.length === 1) {
            tx.store = tx.objectStore(names[0]);
        }
        return tx;
    }
}

async function initDB() {
    console.log('[DB] Ejecutando initDB...');

    // Sandbox guard para IndexedDB: Verificar disponibilidad real antes de llamar a librerías
    try {
        if (typeof indexedDB === 'undefined' || !indexedDB) {
            console.warn("[DB] indexedDB no está definido o está bloqueado. Usando base de datos en memoria (InMemoryMockDB).");
            return new InMemoryMockDB();
        }
    } catch (e) {
        console.warn("[DB] Error de seguridad síncrono al consultar indexedDB. Usando base de datos en memoria (InMemoryMockDB). Detalle:", e.message);
        return new InMemoryMockDB();
    }

    if (!self.idb || !self.idb.openDB) {
        console.error("[DB] self.idb no detectado!");
        throw new Error('Librería de base de datos no encontrada (idb-local.js)');
    }

    const { openDB } = self.idb;
    console.log('[DB] Llamando a openDB...');

    try {
        return await openDB(DB_NAME, DB_VERSION, {
        upgrade(db, oldVersion, newVersion, transaction) {
            console.log(`[DB] Upgrade: v${oldVersion} -> v${newVersion}`);

            // ... (previous versions preserved)

            // v13: Multi-ADSG y Costes de Referencia por Especie
            if (oldVersion < 13) {
                // ADSGs independientes (una finca puede tener varias)
                if (!db.objectStoreNames.contains('adsgs')) {
                    const store = db.createObjectStore('adsgs', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('codigo', 'codigo', { unique: true });
                }

                // Costes de referencia (alimentación estimada)
                if (!db.objectStoreNames.contains('config_costes_referencia')) {
                    const store = db.createObjectStore('config_costes_referencia', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('especie', 'especie');
                }
            }

            // v14: Silos Persistentes (Configuración de Almacén)
            if (oldVersion < 14) {
                if (!db.objectStoreNames.contains('config_silos')) {
                    const store = db.createObjectStore('config_silos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('tipo', 'tipo'); // carne, leche, hibrido
                }
            }

            // v19: Botiquín/Almacén veterinario — inventario de medicamentos/vacunas
            // (gestión interna de la finca, no es un dato exigido por SIGGAN/BADIGEX).
            // Ver docs/AUDITAR/AUDITORIA-BASEDEDATOS-LEGACY.md ("Ingreso Almacén").
            if (oldVersion < 19) {
                if (!db.objectStoreNames.contains('config_botiquin')) {
                    const store = db.createObjectStore('config_botiquin', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('tipo', 'tipo'); // vacuna, medicamento, desparasitante, otro
                }
            }

            // v20: Campo de pago pendiente para compras y ventas
            // NOTA (2026-07): compras_ganado quedó huérfano — Produccion.saveCompras/
            // listCompras (y el módulo js/compras.js) se eliminaron por no tener nunca
            // una UI real ni caso de uso confirmado. El equivalente real de "compra" en
            // la BD legacy auditada (INGVAC.DAT) es una entrada de stock de almacén con
            // precio, ya cubierto por precioUnitario/proveedorId/factura en
            // botiquin_lotes y registro_eventos (ver js/views/botiquin-view.js). El store
            // se conserva vacío para no forzar una migración destructiva de IndexedDB.
            if (oldVersion < 20) {
                // Ensure compras_ganado store exists
                if (!db.objectStoreNames.contains('compras_ganado')) {
                    const comprasStore = db.createObjectStore('compras_ganado', { keyPath: 'id', autoIncrement: true });
                }
                // Añadir índice de pago_pendiente a comercializacion_carne si existe
                if (db.objectStoreNames.contains('comercializacion_carne')) {
                    const carneStore = transaction.objectStore('comercializacion_carne');
                    if (!carneStore.indexNames.contains('pago_pendiente')) {
                        carneStore.createIndex('pago_pendiente', 'pago_pendiente');
                    }
                }
                // Añadir índice de pago_pendiente a compras_ganado (now exists)
                const comprasStore = transaction.objectStore('compras_ganado');
                if (!comprasStore.indexNames.contains('pago_pendiente')) {
                    comprasStore.createIndex('pago_pendiente', 'pago_pendiente');
                }
            }

            // v21: Gestión mejorada de lotes y vencimientos para botiquín
            if (oldVersion < 21) {
                // Tabla para lotes de productos de botiquín
                if (!db.objectStoreNames.contains('botiquin_lotes')) {
                    const lotesStore = db.createObjectStore('botiquin_lotes', { keyPath: 'id', autoIncrement: true });
                    lotesStore.createIndex('productoId', 'productoId');
                    lotesStore.createIndex('lote', 'lote');
                    lotesStore.createIndex('caducidad', 'caducidad');
                }
            }

            // v21: Mejora en gestión de lotes y vencimientos para botiquín
            if (oldVersion < 21) {
                // Mantener config_botiquin para compatibilidad hacia atrás
                if (db.objectStoreNames.contains('config_botiquin')) {
                    const botiquinStore = transaction.objectStore('config_botiquin');
                    // Eliminar índices antiguos de lote y caducidad si existen (para recrearlos)
                    if (botiquinStore.indexNames.contains('lote')) {
                        botiquinStore.deleteIndex('lote');
                    }
                    if (botiquinStore.indexNames.contains('caducidad')) {
                        botiquinStore.deleteIndex('caducidad');
                    }
                    // Los campos lote y caducidad se mantendrán por compatibilidad pero no se usarán activamente
                }

                // Crear tabla para lotes de botiquin
                if (!db.objectStoreNames.contains('botiquin_lotes')) {
                    const lotesStore = db.createObjectStore('botiquin_lotes', { keyPath: 'id', autoIncrement: true });
                    lotesStore.createIndex('productoId', 'productoId');
                    lotesStore.createIndex('lote', 'lote');
                    lotesStore.createIndex('caducidad', 'caducidad');
                }
            }

            // v22: Añadir turno y zona a la producción de leche, y motivo, trazabilidad y observaciones a ventas y compras (payload encriptado)
            if (oldVersion < 22) {
                // No cambiamos la estructura de la tienda, pero cambiamos el formato del payload cifrado.
                // Manejaremos la retrocompatibilidad en la lógica de descifrado.
            }

            // v15: Especie y Tipo de Identificador como datos maestros oficiales
            // (ver docs/NORMATIVA-CROTAL-ESPECIE.md). keyPath = código oficial
            // (SIEX del FEGA para especies, RIIA para tipos de identificador),
            // no autoIncrement, para que el id sea estable y coincida con la
            // codificación oficial.
            if (oldVersion < 15) {
                if (!db.objectStoreNames.contains('especies')) {
                    db.createObjectStore('especies', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('tipos_identificador')) {
                    db.createObjectStore('tipos_identificador', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('especie_tipo_identificador')) {
                    const store = db.createObjectStore('especie_tipo_identificador', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('especieId', 'especieId');
                }
            }

            // v16: Raza como dato maestro oficial (catálogo RAZAS/CLASIFICACION_RAZAS
            // del FEGA, ver docs/NORMATIVA-CROTAL-ESPECIE.md sección "Catálogo de razas").
            if (oldVersion < 16) {
                if (!db.objectStoreNames.contains('razas')) {
                    const store = db.createObjectStore('razas', { keyPath: 'id' });
                    store.createIndex('especieId', 'especieId');
                }
            }

            // v17: Vacunaciones como modelo jerárquico (ADSG), separado del libro de
            // tratamientos genérico ya existente (sanitarios_ganado). Ver
            // docs/PLAN-MEJORA-SIGGAN.md punto 3 y docs/AUDITAR/ADSGVacunacionesRumiantes.pdf.
            // Cabecera con array embebido `tipos_vacuna` (máx. 4 por normativa) y flag
            // `cerrada` que, una vez true, bloquea edición (mismo patrón de anulación
            // trazable que movimientos, no borrado físico).
            if (oldVersion < 17) {
                if (!db.objectStoreNames.contains('vacunaciones')) {
                    const store = db.createObjectStore('vacunaciones', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('rebanoId', 'rebanoId');
                    store.createIndex('fecha', 'fecha');
                    store.createIndex('cerrada', 'cerrada');
                }
            }

            // v18: Catálogo de tipos de instalación (dato maestro oficial FEGA,
            // ver docs/PLAN-MEJORA-SIGGAN.md punto 5). Las instalaciones concretas
            // de cada finca se guardan como array embebido `finca.instalaciones[]`
            // (mismo patrón ya usado para `finca.zonas[]`) — no requieren tabla
            // propia porque `fincas` no fuerza schema.
            if (oldVersion < 18) {
                if (!db.objectStoreNames.contains('instalaciones_tipo')) {
                    db.createObjectStore('instalaciones_tipo', { keyPath: 'id' });
                }
            }

            // v1: Estructura base
            if (oldVersion < 1) {
                if (!db.objectStoreNames.contains('fincas')) {
                    db.createObjectStore('fincas', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('rebanos')) {
                    const store = db.createObjectStore('rebanos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
                if (!db.objectStoreNames.contains('animales')) {
                    const store = db.createObjectStore('animales', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('rebanoId', 'rebanoId');
                    store.createIndex('caravana', 'numero_identificacion', { unique: true });
                }
                if (!db.objectStoreNames.contains('produccion_carne')) {
                    const store = db.createObjectStore('produccion_carne', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('animalId', 'animalId');
                }
                if (!db.objectStoreNames.contains('produccion_leche')) {
                    db.createObjectStore('produccion_leche', { keyPath: 'id', autoIncrement: true });
                }
                if (!db.objectStoreNames.contains('ventas_ganado')) {
                    const store = db.createObjectStore('ventas_ganado', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
                if (!db.objectStoreNames.contains('sanitarios_ganado')) {
                    const store = db.createObjectStore('sanitarios_ganado', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('rebanoId', 'rebanoId');
                }
                if (!db.objectStoreNames.contains('gastos_ganaderia')) {
                    const store = db.createObjectStore('gastos_ganaderia', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
            }

            // v2: Configuración
            if (oldVersion < 2) {
                if (!db.objectStoreNames.contains('config_especies')) db.createObjectStore('config_especies', { keyPath: 'id', autoIncrement: true });
                if (!db.objectStoreNames.contains('config_tipos_produccion')) db.createObjectStore('config_tipos_produccion', { keyPath: 'id', autoIncrement: true });
            }

            // v3: Comercialización mejorada
            if (oldVersion < 3) {
                if (!db.objectStoreNames.contains('comercializacion_carne')) {
                    const store = db.createObjectStore('comercializacion_carne', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('animalId', 'animalId');
                }
                if (!db.objectStoreNames.contains('comercializacion_leche')) {
                    const store = db.createObjectStore('comercializacion_leche', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                }
            }

            // v4: Metadatos y Migración
            if (oldVersion < 4) {
                if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta', { keyPath: 'key' });
            }

            // v5: Registro Maestro de Eventos (Trazabilidad 360)
            if (oldVersion < 5) {
                if (!db.objectStoreNames.contains('registro_eventos')) {
                    const store = db.createObjectStore('registro_eventos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('entidad_id', 'entidad_id');
                    store.createIndex('tipo_entidad', 'tipo_entidad');
                    store.createIndex('snap_zona', 'snap_zona');
                    store.createIndex('snap_tipo', 'snap_tipo');
                    store.createIndex('motivo_tarea', 'motivo_tarea');
                    store.createIndex('fecha', 'fecha');
                }
            }

            // v6: Módulo de Reproducción
            if (oldVersion < 6) {
                if (!db.objectStoreNames.contains('reproduccion_eventos')) {
                    const store = db.createObjectStore('reproduccion_eventos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('animalId', 'animalId');
                    store.createIndex('tipo_evento', 'tipo_evento'); // celo, inseminacion, diagnostico, parto, aborto
                    store.createIndex('fecha', 'fecha');
                }
            }

            // v7: Índices adicionales para Módulo Lácteo
            if (oldVersion < 7) {
                const lecheStore = transaction.objectStore('comercializacion_leche');
                if (!lecheStore.indexNames.contains('comunidad_autonoma')) {
                    lecheStore.createIndex('comunidad_autonoma', 'comunidad_autonoma');
                }
                if (!lecheStore.indexNames.contains('fechaRecogida')) {
                    lecheStore.createIndex('fechaRecogida', 'fechaRecogida');
                }
                if (!lecheStore.indexNames.contains('contrato_numero')) {
                    lecheStore.createIndex('contrato_numero', 'contrato_numero');
                }
            }

            // v8: Compradores, Proveedores y Contratos
            if (oldVersion < 8) {
                if (!db.objectStoreNames.contains('compradores')) {
                    const store = db.createObjectStore('compradores', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nif_cif', 'nif_cif', { unique: true });
                    store.createIndex('tipo_comprador', 'tipo_comprador');
                    store.createIndex('activo', 'activo');
                }
                if (!db.objectStoreNames.contains('proveedores')) {
                    const store = db.createObjectStore('proveedores', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nif_cif', 'nif_cif', { unique: true });
                    store.createIndex('activo', 'activo');
                }
                if (!db.objectStoreNames.contains('contratos_compra')) {
                    const store = db.createObjectStore('contratos_compra', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('compradorId', 'compradorId');
                    store.createIndex('activo', 'activo');
                    store.createIndex('tipo', 'tipo');
                }
                // Añadir índices a stores existentes
                const carneStore = transaction.objectStore('comercializacion_carne');
                if (!carneStore.indexNames.contains('compradorId')) {
                    carneStore.createIndex('compradorId', 'compradorId');
                }
                if (!carneStore.indexNames.contains('contratoId')) {
                    carneStore.createIndex('contratoId', 'contratoId');
                }
                const lecheStore = transaction.objectStore('comercializacion_leche');
                if (!lecheStore.indexNames.contains('compradorId')) {
                    lecheStore.createIndex('compradorId', 'compradorId');
                }
                if (!lecheStore.indexNames.contains('contratoId')) {
                    lecheStore.createIndex('contratoId', 'contratoId');
                }
                const gastosStore = transaction.objectStore('gastos_ganaderia');
                if (!gastosStore.indexNames.contains('proveedorId')) {
                    gastosStore.createIndex('proveedorId', 'proveedorId');
                }
            }

            // v9: Transportistas, Documentos Legales y nuevos índices de trazabilidad
            if (oldVersion < 9) {
                // TRANSPORTISTAS
                if (!db.objectStoreNames.contains('transportistas')) {
                    const store = db.createObjectStore('transportistas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('nif_cif', 'nif_cif', { unique: true });
                    store.createIndex('activo', 'activo');
                    store.createIndex('matricula', 'matricula');
                }

                // DOCUMENTOS LEGALES (DIMOE, Facturas, Certificados)
                if (!db.objectStoreNames.contains('documentos_legales')) {
                    const store = db.createObjectStore('documentos_legales', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('tipo', 'tipo');          // dimoe, factura, certificado, dib
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('animalId', 'animalId');
                    store.createIndex('numero', 'numero', { unique: true });
                    store.createIndex('fecha_emision', 'fecha_emision');
                }

                // Nuevos índices en FINCAS
                const fincasStore = transaction.objectStore('fincas');
                if (!fincasStore.indexNames.contains('rega')) {
                    fincasStore.createIndex('rega', 'rega', { unique: true });
                }

                // Nuevos índices en ANIMALES
                const animalesStore = transaction.objectStore('animales');
                if (!animalesStore.indexNames.contains('dib')) {
                    animalesStore.createIndex('dib', 'dib', { unique: true });
                }
                if (!animalesStore.indexNames.contains('categoria')) {
                    animalesStore.createIndex('categoria', 'categoria');
                }
                if (!animalesStore.indexNames.contains('madre_id')) {
                    animalesStore.createIndex('madre_id', 'madre_id');
                }

                // Nuevos índices en COMERCIALIZACION_CARNE
                const carneStore = transaction.objectStore('comercializacion_carne');
                if (!carneStore.indexNames.contains('numero_albaran')) {
                    carneStore.createIndex('numero_albaran', 'numero_albaran', { unique: true });
                }
                if (!carneStore.indexNames.contains('dimoe')) {
                    carneStore.createIndex('dimoe', 'dimoe');
                }
                if (!carneStore.indexNames.contains('transportistaId')) {
                    carneStore.createIndex('transportistaId', 'transportistaId');
                }
                if (!carneStore.indexNames.contains('autorizacion_veterinaria')) {
                    carneStore.createIndex('autorizacion_veterinaria', 'autorizacion_veterinaria');
                }
            }

            // v11: SIGGAN — Notificaciones a REGA (migración desde localStorage)
            if (oldVersion < 11) {
                if (!db.objectStoreNames.contains('notificaciones_rega')) {
                    const store = db.createObjectStore('notificaciones_rega', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('animal_id', 'animal_id');
                    store.createIndex('finca_id', 'finca_id');
                    store.createIndex('fecha_notificacion', 'fecha_notificacion');
                    store.createIndex('estado_notificacion', 'estado_notificacion');
                }
            }

            // v12: SIGGAN — Pedidos de Crotales
            if (oldVersion < 12) {
                if (!db.objectStoreNames.contains('pedidos_crotales')) {
                    const store = db.createObjectStore('pedidos_crotales', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId', { unique: false });
                    store.createIndex('fecha_pedido', 'fecha_pedido', { unique: false });
                    store.createIndex('numero_seguimiento', 'numero_seguimiento', { unique: true });
                }
            }

            // v10: SIGGAN — Movimientos oficiales inter-explotación y Saneamientos
            if (oldVersion < 10) {
                // MOVIMIENTOS DE GANADO (guía de origen y sanidad pecuaria)
                if (!db.objectStoreNames.contains('movimientos_ganado')) {
                    const store = db.createObjectStore('movimientos_ganado', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('tipo', 'tipo');                 // entrada | salida
                    store.createIndex('numero_guia', 'numero_guia');
                    store.createIndex('rega_origen', 'rega_origen');
                    store.createIndex('rega_destino', 'rega_destino');
                    store.createIndex('fecha', 'fecha');
                    store.createIndex('animalId', 'animalId', { multiEntry: true });
                }

                // SANEAMIENTOS (campañas oficiales: TBC, brucelosis, etc.)
                if (!db.objectStoreNames.contains('saneamientos')) {
                    const store = db.createObjectStore('saneamientos', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('campana', 'campana');
                    store.createIndex('fecha', 'fecha');
                    store.createIndex('calificacion', 'calificacion');
                }
            }

            // v23: Sistema Unificado de Eventos, Tareas y Alertas (Agenda)
            if (oldVersion < 23) {
                if (!db.objectStoreNames.contains('agenda_tareas')) {
                    const store = db.createObjectStore('agenda_tareas', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('fincaId', 'fincaId');
                    store.createIndex('modulo_id', 'modulo_id');
                    store.createIndex('entidad_id', 'entidad_id');
                    store.createIndex('fecha_planificada', 'fecha_planificada');
                    store.createIndex('estado', 'estado');
                    store.createIndex('prioridad', 'prioridad');
                    store.createIndex('es_alerta', 'es_alerta');
                }
            }
        },
    });
    } catch (e) {
        console.warn("[DB] Error de IndexedDB (normal en entornos de iframe restringidos o sandboxed como Open Design). Usando base de datos simulada en memoria. Detalle:", e);
        return new InMemoryMockDB();
    }
}

async function populateDefaults(db) {
    console.log("[DB] Verificando datos por defecto...");
    
    // Especies por defecto
    const especiesCount = await db.count('config_especies');
    if (especiesCount === 0) {
        const especies = [
            { nombre: 'Vacas', consumoAguaL: 60 },
            { nombre: 'Ovejas', consumoAguaL: 8 },
            { nombre: 'Cabras', consumoAguaL: 8 },
            { nombre: 'Cerdos', consumoAguaL: 12 }
        ];
        for (let e of especies) { await db.add('config_especies', { ...e, creadoEn: Date.now() }); }
    }

    // Tipos de producción por defecto
    const tiposCount = await db.count('config_tipos_produccion');
    if (tiposCount === 0) {
        const tipos = [
            { nombre: 'Cárnica' },
            { nombre: 'Láctea' },
            { nombre: 'Mixto' },
            { nombre: 'Ibérico' }
        ];
        for (let t of tipos) { await db.add('config_tipos_produccion', { ...t, creadoEn: Date.now() }); }
    }

    // Especies (dato maestro oficial, código SIEX del FEGA) — ver docs/NORMATIVA-CROTAL-ESPECIE.md
    const especiesOficialesCount = await db.count('especies');
    if (especiesOficialesCount === 0) {
        for (const e of ESPECIES_SEED) { await db.put('especies', { ...e }); }
    }

    // Tipos de identificador (dato maestro oficial, código RIIA del FEGA)
    const tiposIdentificadorCount = await db.count('tipos_identificador');
    if (tiposIdentificadorCount === 0) {
        for (const t of TIPOS_IDENTIFICADOR_SEED) { await db.put('tipos_identificador', { ...t }); }
    }

    // Asociación especie <-> tipo de identificador válido + patrón de crotal
    const especieTipoCount = await db.count('especie_tipo_identificador');
    if (especieTipoCount === 0) {
        for (const a of ESPECIE_TIPO_IDENTIFICADOR_SEED) { await db.add('especie_tipo_identificador', { ...a }); }
    }

    // Razas (dato maestro oficial, catálogo RAZAS/CLASIFICACION_RAZAS del FEGA)
    const razasCount = await db.count('razas');
    if (razasCount === 0) {
        for (const r of RAZAS_SEED) { await db.put('razas', { ...r }); }
    }

    // Tipos de instalación ganadera (dato maestro oficial, catálogo EDIFICACIONES_INSTALACIONES del FEGA)
    const instalacionesTipoCount = await db.count('instalaciones_tipo');
    if (instalacionesTipoCount === 0) {
        for (const i of INSTALACIONES_TIPO_SEED) { await db.put('instalaciones_tipo', { ...i }); }
    }
}

/**
 * Migración v8: Extraer compradores y proveedores únicos de registros existentes
 * y crear entidades en los nuevos stores.
 */
async function migrarV8(windowDb) {
    try {
        console.log("[DB] Migración v8: compradores y proveedores...");

        // --- COMPRADORES desde comercializacion_carne ---
        const ventasCarne = await windowDb.getAll('comercializacion_carne');
        const paresUnicos = new Map();
        for (const v of ventasCarne) {
            const key = (v.nifComprador || '').trim().toUpperCase() || (v.razonSocial || '').trim().toLowerCase();
            if (!key) continue;
            if (!paresUnicos.has(key)) {
                paresUnicos.set(key, {
                    nif_cif: (v.nifComprador || '').trim(),
                    nombre: (v.razonSocial || '').trim(),
                    tipo_comprador: 'híbrido'
                });
            }
        }

        // Crear compradores si no existen por NIF
        for (const [_, datos] of paresUnicos) {
            if (!datos.nif_cif && !datos.nombre) continue;
            try {
                const existente = datos.nif_cif ? await windowDb.getFromIndex('compradores', 'nif_cif', datos.nif_cif.toUpperCase()).catch(() => null) : null;
                if (!existente) {
                    const newId = await windowDb.add('compradores', {
                        nombre: datos.nombre || datos.nif_cif || 'Comprador migrado',
                        nif_cif: (datos.nif_cif || '').toUpperCase(),
                        tipo_comprador: datos.tipo_comprador || 'híbrido',
                        activo: true,
                        creadoEn: new Date().toISOString(),
                        notas: 'Creado automáticamente desde registros de ventas existentes.'
                    });
                    // Asignar compradorId a las ventas de este comprador
                    for (const v of ventasCarne) {
                        const vKey = (v.nifComprador || '').trim().toUpperCase() || (v.razonSocial || '').trim().toLowerCase();
                        const dKey = (datos.nif_cif || '').toUpperCase() || (datos.nombre || '').trim().toLowerCase();
                        if (vKey === dKey) {
                            v.compradorId = newId;
                            await windowDb.put('comercializacion_carne', v);
                        }
                    }
                } else {
                    // Asignar compradorId a las ventas ya existentes
                    for (const v of ventasCarne) {
                        if (!v.compradorId) {
                            const vKey = (v.nifComprador || '').trim().toUpperCase() || (v.razonSocial || '').trim().toLowerCase();
                            const eKey = (existente.nif_cif || '').toUpperCase() || (existente.nombre || '').trim().toLowerCase();
                            if (vKey === eKey) {
                                v.compradorId = existente.id;
                                await windowDb.put('comercializacion_carne', v);
                            }
                        }
                    }
                }
            } catch (e) {
                console.warn("[DB] Error migrando comprador:", e.message);
            }
        }

        // --- PROVEEDORES desde gastos_ganaderia ---
        const gastos = await windowDb.getAll('gastos_ganaderia');
        const proveedoresUnicos = new Map();
        for (const g of gastos) {
            const prov = (g.proveedor || '').trim();
            if (!prov) continue;
            const key = prov.toLowerCase();
            if (!proveedoresUnicos.has(key)) {
                proveedoresUnicos.set(key, prov);
            }
        }

        for (const [_, nombre] of proveedoresUnicos) {
            try {
                const existente = await windowDb.getFromIndex('proveedores', 'nif_cif', nombre.toUpperCase()).catch(() => null);
                if (!existente) {
                    const newId = await windowDb.add('proveedores', {
                        nombre: nombre,
                        nif_cif: '',
                        categorias: [],
                        activo: true,
                        creadoEn: new Date().toISOString(),
                        notas: 'Creado automáticamente desde registros de gastos existentes.'
                    });
                    for (const g of gastos) {
                        if ((g.proveedor || '').trim().toLowerCase() === nombre.toLowerCase() && !g.proveedorId) {
                            g.proveedorId = newId;
                            await windowDb.put('gastos_ganaderia', g);
                        }
                    }
                } else {
                    for (const g of gastos) {
                        if ((g.proveedor || '').trim().toLowerCase() === nombre.toLowerCase() && !g.proveedorId) {
                            g.proveedorId = existente.id;
                            await windowDb.put('gastos_ganaderia', g);
                        }
                    }
                }
            } catch (e) {
                console.warn("[DB] Error migrando proveedor:", e.message);
            }
        }

        // Marcar migración completada
        await windowDb.put('meta', { key: 'migracion_v8', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración v8 completada.");
    } catch (e) {
        console.warn("[DB] Error en migración v8:", e);
    }
}

/**
 * Migración v9: Asignar números de albarán secuenciales a registros existentes
 * y crear documentos_legales DIMOE para ventas sin ellos.
 */
async function migrarV9(windowDb) {
    try {
        console.log("[DB] Migración v9: albaranes y documentos legales...");

        const ventasCarne = await windowDb.getAll('comercializacion_carne');
        const metaSerie = await windowDb.get('meta', 'contador_albaran').catch(() => null);
        let contador = metaSerie ? (metaSerie.valor || 0) : 0;
        const year = new Date().getFullYear();

        for (const v of ventasCarne) {
            if (!v.numero_albaran) {
                contador++;
                v.numero_albaran = `${year}-${String(contador).padStart(4, '0')}`;
                await windowDb.put('comercializacion_carne', v);
            }
        }

        await windowDb.put('meta', { key: 'contador_albaran', valor: contador, actualizadoEn: new Date().toISOString() });

        // --- Crear documentos_legales (DIMOE) ---
        const docsExistentes = await windowDb.getAll('documentos_legales').catch(() => []);
        const dimoeExistentes = new Set(docsExistentes.filter(d => d.tipo === 'dimoe').map(d => d.ventaId));

        let dimoeContador = 0;
        for (const v of ventasCarne) {
            if (!v.numero_albaran) continue;
            if (dimoeExistentes.has(v.id)) continue;

            dimoeContador++;
            const finca = await windowDb.get('fincas', Number(v.fincaId)).catch(() => null);
            const dimoe = {
                tipo: 'dimoe',
                ventaId: v.id,
                animalId: v.animalId || null,
                fincaId: v.fincaId || null,
                numero: `DIMOE-${v.numero_albaran}`,
                fecha_emision: v.fechaSacrificio || new Date().toISOString().split('T')[0],
                origen_rega: finca?.codigo_REGA || finca?.rega || '',
                destino: v.codigoMatadero || '',
                motivo: 'sacrificio',
                created_at: new Date().toISOString()
            };
            await windowDb.add('documentos_legales', dimoe).catch(() => {});
        }

        await windowDb.put('meta', { key: 'migracion_v9', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración v9 completada.");
    } catch (e) {
        console.warn("[DB] Error en migración v9:", e);
    }
}

/**
 * Migración v15: calcula y guarda `especieId` (código SIEX oficial) en los
 * animales existentes, reutilizando ComunidadesService.getGrupoEspecie() para
 * mapear el texto libre histórico ("Vacas", "Ovejas"...) al grupo zootécnico.
 * NO modifica el campo `especie` (string) original — es puramente aditivo,
 * para no romper ningún código existente que ya lea `especie` como texto.
 * Ver docs/NORMATIVA-CROTAL-ESPECIE.md.
 */
async function migrarV15(windowDb) {
    try {
        console.log("[DB] Migración v15: especieId en animales existentes...");

        const GRUPO_A_ESPECIE_ID = { bovino: 1, porcino: 2, ovino: 3, caprino: 4, equino: 5 };
        const animales = await windowDb.getAll('animales');

        for (const a of animales) {
            if (a.especieId) continue; // ya migrado o ya asignado por la UI
            const grupo = window.ComunidadesService
                ? window.ComunidadesService.getGrupoEspecie(a.especie)
                : null;
            const especieId = grupo ? GRUPO_A_ESPECIE_ID[grupo] : null;
            if (especieId) {
                a.especieId = especieId;
                await windowDb.put('animales', a);
            }
        }

        await windowDb.put('meta', { key: 'migracion_v15', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración v15 completada.");
    } catch (e) {
        console.warn("[DB] Error en migración v15:", e);
    }
}

/**
 * Migración de datos: añade codigo_espe_siggan/espe_id_siggan a los registros
 * de `especies` que ya existían antes de incorporar estos campos a
 * ESPECIES_SEED (instalaciones con datos sembrados en v15, antes de que este
 * mapeo existiera). No requiere bump de DB_VERSION porque no crea tablas
 * nuevas, solo actualiza campos de registros existentes por id. Ver
 * docs/NORMATIVA-CROTAL-ESPECIE.md y docs/PLAN-MEJORA-SIGGAN.md punto 2.
 */
async function migrarEspeSiggan(windowDb) {
    try {
        console.log("[DB] Migración: codigo_espe_siggan en especies existentes...");

        for (const seed of ESPECIES_SEED) {
            const actual = await windowDb.get('especies', seed.id);
            if (actual && actual.codigo_espe_siggan == null) {
                await windowDb.put('especies', { ...actual, codigo_espe_siggan: seed.codigo_espe_siggan, espe_id_siggan: seed.espe_id_siggan });
            }
        }

        await windowDb.put('meta', { key: 'migracion_espe_siggan', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración codigo_espe_siggan completada.");
    } catch (e) {
        console.warn("[DB] Error en migración codigo_espe_siggan:", e);
    }
}

/**
 * Migración de datos: añade la fila { especieId: 5, tipoIdentificadorId: 3,
 * formato: 'equino_microchip' } a `especie_tipo_identificador` en
 * instalaciones donde ya se sembró ese store antes de cerrar la normativa
 * equina (microchip UELN 15 dígitos, ISO 11784/11785). No requiere bump de
 * DB_VERSION. Ver docs/NORMATIVA-CROTAL-ESPECIE.md y
 * docs/PLAN-MEJORA-SIGGAN.md punto 4.
 */
async function migrarEquinoMicrochip(windowDb) {
    try {
        console.log("[DB] Migración: microchip equino en especie_tipo_identificador...");

        const existentes = await windowDb.getAllFromIndex('especie_tipo_identificador', 'especieId', 5);
        const yaTiene = existentes.some((a) => a.tipoIdentificadorId === 3);
        if (!yaTiene) {
            await windowDb.add('especie_tipo_identificador', { especieId: 5, tipoIdentificadorId: 3, formato: 'equino_microchip' });
        }

        await windowDb.put('meta', { key: 'migracion_equino_microchip', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración microchip equino completada.");
    } catch (e) {
        console.warn("[DB] Error en migración microchip equino:", e);
    }
}

/**
 * Migración v21: migra los datos existentes de config_botiquin a botiquin_lotes
 * para mejorar la gestión de lotes y vencimientos. Cada registro de producto
 * se convierte en un lote con la cantidad actual.
 */
async function migrarV21(windowDb) {
    try {
        console.log("[DB] Migración v21: migrando lotes de botiquin...");

        // Obtener todos los productos de botiquin existentes
        const productos = await windowDb.getAll('config_botiquin');

        for (const producto of productos) {
            // Solo migrar si tiene lote o caducidad definidos, o si tiene cantidad > 0
            if ((producto.lote && producto.lote.trim() !== '') ||
                (producto.caducidad && producto.caducidad !== null) ||
                (producto.cantidadActual && producto.cantidadActual > 0)) {

                // Crear un lote para este producto
                await windowDb.add('botiquin_lotes', {
                    productoId: producto.id,
                    lote: producto.lote || `LOTE-${producto.id}`, // Lote por defecto si no tiene
                    caducidad: producto.caducidad || null,
                    cantidad: producto.cantidadActual || 0,
                    creadoEn: producto.creadoEn || new Date().toISOString()
                });
            }
        }

        await windowDb.put('meta', { key: 'migracion_v21', value: true, migradoEn: new Date().toISOString() });
        console.log("[DB] Migración v21 completada.");
    } catch (e) {
        console.warn("[DB] Error en migración v21:", e);
    }
}

console.log("[DB] Iniciando window.dbPromise...");
const dbTimeout = new Promise((_, reject) => setTimeout(() => reject(new Error('DB_TIMEOUT: IndexedDB no respondió en 15s')), 15000));
window.dbPromise = Promise.race([initDB(), dbTimeout]).then(async database => {
    window.db = database;
    await populateDefaults(database);
    // Ejecutar migración v8 si no se ha ejecutado antes
    try {
        const meta = await database.get('meta', 'migracion_v8');
        if (!meta) {
            await migrarV8(database);
        }
    } catch (e) {
        // La meta store puede no existir si es primera ejecución
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    // Ejecutar migración v9 si no se ha ejecutado antes
    try {
        const metaV9 = await database.get('meta', 'migracion_v9');
        if (!metaV9) {
            await migrarV9(database);
        }
    } catch (e) {
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    // Ejecutar migración v15 (especieId en animales) si no se ha ejecutado antes
    try {
        const metaV15 = await database.get('meta', 'migracion_v15');
        if (!metaV15) {
            await migrarV15(database);
        }
    } catch (e) {
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    // Ejecutar migración codigo_espe_siggan (especies existentes) si no se ha ejecutado antes
    try {
        const metaEspeSiggan = await database.get('meta', 'migracion_espe_siggan');
        if (!metaEspeSiggan) {
            await migrarEspeSiggan(database);
        }
    } catch (e) {
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    // Ejecutar migración microchip equino si no se ha ejecutado antes
    try {
        const metaEquinoMicrochip = await database.get('meta', 'migracion_equino_microchip');
        if (!metaEquinoMicrochip) {
            await migrarEquinoMicrochip(database);
        }
    } catch (e) {
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    // Ejecutar migración v21 (lotes de botiquin) si no se ha ejecutado antes
    try {
        const metaV21 = await database.get('meta', 'migracion_v21');
        if (!metaV21) {
            await migrarV21(database);
        }
    } catch (e) {
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    // Ejecutar migración v21 (mejora en gestión de lotes para botiquín) si no se ha ejecutado antes
    try {
        const metaV21 = await database.get('meta', 'migracion_v21');
        if (!metaV21) {
            await migrarV21(database);
        }
    } catch (e) {
        console.log("[DB] Primera ejecución o store meta no disponible aún.");
    }

    console.log("[DB] Inicialización completada con éxito.");
    return database;
}).catch(err => {
    console.error("[DB] ERROR CRÍTICO:", err);
    // Intentar mostrar el error en pantalla si el DOM está listo
    const msg = "Error Base de Datos: " + err.message;
    if (document.getElementById('app-content')) {
        document.getElementById('app-content').innerHTML = `<div style="color:red; padding:20px; background:black; border:1px solid red;">${msg}</div>`;
    }
    throw err;
});
