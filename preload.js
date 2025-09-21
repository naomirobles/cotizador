const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Cotizaciones
obtenerCotizaciones: () => ipcRenderer.invoke('obtener-cotizaciones'),
obtenerCotizacionId: (id) => ipcRenderer.invoke('obtener-cotizacion-id', id),
agregarCotizacion: (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones = '') => 
  ipcRenderer.invoke('agregar-cotizacion', empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones),
eliminarCotizacion: (id) => ipcRenderer.invoke('eliminar-cotizacion', id),
actualizarCotizacion: (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones, id_cotizacion) => 
  ipcRenderer.invoke('actualizar-cotizacion', empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones, id_cotizacion),
 copiarCotizacion: (id) => ipcRenderer.invoke('copiar-cotizacion', id),

  // Productos
  agregarProducto: (id_cotizacion, nombre_producto, precio_unitario, concepto, unidades, imagen) =>
  ipcRenderer.invoke('agregar-producto', id_cotizacion, nombre_producto, precio_unitario, concepto, unidades, imagen),
  obtenerProductos: (id_cotizacion) => ipcRenderer.invoke('obtener-productos', id_cotizacion),
  eliminarProductosCotizacion: (id_cotizacion) => ipcRenderer.invoke('eliminar-productos-cotizacion', id_cotizacion),

  // Utilidades
  selectImage: () => ipcRenderer.invoke('select-image'),
  getImagePath: (fileName) => ipcRenderer.invoke('get-image-path', fileName),
  imageExists: (fileName) => ipcRenderer.invoke('image-exists', fileName),

  // generar PDF
  generarPDF: (id) => ipcRenderer.invoke('generar-pdf-puppeteer', id),
  abrirPDF: (filePath) => ipcRenderer.invoke('abrir-pdf', filePath),
  numeroALetras: (numero) => {return `número convertido: ${numero}`;},

  //Excel
  selectAndParseExcel: () => ipcRenderer.invoke('select-and-parse-excel'),
  importarDatosExcel: (sheetDataMap, currentSheetName) => ipcRenderer.invoke('importar-datos-excel', sheetDataMap, currentSheetName),
  onLoadSheetData: (callback) => {
    ipcRenderer.on('load-sheet-data', (event, data) => callback(data));
  },  
  sendSelectedCell: (cellData) => ipcRenderer.send('cell-selected', cellData),
});