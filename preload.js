const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  obtenerCotizaciones: () => ipcRenderer.invoke('obtener-cotizaciones'),
  obtenerProductos: (id) => ipcRenderer.invoke('obtener-productos', id),
  agregarCotizacion: (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) => ipcRenderer.invoke('agregar-cotizacion', empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio),
  obtenerCotizacionId: (id) => ipcRenderer.invoke('obtener-cotizacion-id', id),
  eliminarCotizacion: (id) => ipcRenderer.invoke('eliminar-cotizacion', id),
  eliminarProductosCotizacion: (id) => ipcRenderer.invoke('eliminar-productos-cotizacion', id),
  eliminarProducto: (id) => ipcRenderer.invoke('eliminar-producto', id),
  agregarProducto: (id_cotizacion, concepto, unidades, precio_unitario, imagen) => ipcRenderer.invoke('agregar-producto', id_cotizacion, concepto, unidades, precio_unitario, imagen),
});