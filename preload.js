const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  obtenerCotizaciones: () => ipcRenderer.invoke('obtener-cotizaciones'),
  obtenerProductos: (id) => ipcRenderer.invoke('obtener-productos', id),
  agregarCotizacion: (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) => ipcRenderer.invoke('agregar-cotizacion', empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio),
  obtenerCotizacionId: (id) => ipcRenderer.invoke('obtener-cotizacion-id', id),
  eliminarCotizacion: (id) => ipcRenderer.invoke('eliminar-cotizacion', id)
});