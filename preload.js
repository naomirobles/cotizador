const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Cotizaciones
  obtenerCotizaciones: () => ipcRenderer.invoke('obtener-cotizaciones'),
  obtenerCotizacionId: (id) => ipcRenderer.invoke('obtener-cotizacion-id', id),
  agregarCotizacion: (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) => 
    ipcRenderer.invoke('agregar-cotizacion', empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio),
  eliminarCotizacion: (id) => ipcRenderer.invoke('eliminar-cotizacion', id),
  //actualizarCotizacion: (id, empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) => 
  //  ipcRenderer.invoke('actualizar-cotizacion', id, empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio),

  // Productos
  agregarProducto: (id_cotizacion, precio_unitario, concepto, unidades, imagen) =>
  ipcRenderer.invoke('agregar-producto', id_cotizacion, precio_unitario, concepto, unidades, imagen),
  obtenerProductos: (id_cotizacion) => ipcRenderer.invoke('obtener-productos', id_cotizacion),
  //actualizarProducto: (id, nombre_producto, precio_unitario, concepto, unidades) => 
  //  ipcRenderer.invoke('actualizar-producto', id, nombre_producto, precio_unitario, concepto, unidades),
  //eliminarProducto: (id) => ipcRenderer.invoke('eliminar-producto', id),
  //eliminarProductosCotizacion: (id_cotizacion) => ipcRenderer.invoke('eliminar-productos-cotizacion', id_cotizacion),

  // Utilidades
  selectImage: () => ipcRenderer.invoke('select-image'),
  getImagePath: (fileName) => ipcRenderer.invoke('get-image-path', fileName),
  imageExists: (fileName) => ipcRenderer.invoke('image-exists', fileName)
});