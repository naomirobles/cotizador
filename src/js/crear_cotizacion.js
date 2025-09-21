let itemCounter = 0;
let currentImageRow = null;
let isEditing = false;
let editingId = null;

document.getElementById('hojaExcel').addEventListener('change', onHojaExcelChanged);

// Inicializar formulario
document.addEventListener('DOMContentLoaded', function() {
    const cotizacionForm = document.getElementById('cotizacionForm');
    cotizacionForm.addEventListener('submit', agregar_cotizacion);

    // Establecer fecha actual
    const fechaInput = document.getElementById('fecha');
    fechaInput.value = new Date().toISOString().split('T')[0];
    
    // Verificar si estamos editando
    const urlParams = new URLSearchParams(window.location.search);
    const cotizacionId = urlParams.get('id');
    
    if (cotizacionId) {
        isEditing = true;
        editingId = cotizacionId;
        cargarCotizacionParaEditar(cotizacionId);
    } else {
        // Agregar dos items por defecto
        mostrarMensajeNoProductos();
    }

    mostrarMensajeNoProductos();
});

// Event listener para cargar imagen
document.addEventListener('DOMContentLoaded', function() {
    const imageInput = document.getElementById('imageInput');
    if (imageInput) {
        imageInput.addEventListener('change', function(e) {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                console.log('Archivo seleccionado:', file.name, 'Tamaño:', file.size, 'Tipo:', file.type);
                
                // Validar tipo de archivo
                const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/webp'];
                if (!validTypes.includes(file.type)) {
                    alert('Por favor seleccione un archivo de imagen válido (JPG, PNG, GIF, BMP, WEBP)');
                    e.target.value = '';
                    return;
                }
                
                // Validar tamaño (máximo 5MB)
                const maxSize = 5 * 1024 * 1024; // 5MB
                if (file.size > maxSize) {
                    alert('La imagen es demasiado grande. El tamaño máximo es de 5MB');
                    e.target.value = '';
                    return;
                }
            }
        });
    }
});

document.getElementById('hojaExcel').addEventListener('change', onHojaExcelChanged)

// Texto por defecto (debe coincidir con el DEFAULT de la base de datos)
const TERMINOS_POR_DEFECTO = `El tiempo de entrega es de 2 días hábiles contados a partir de la autorización correspondiente y de la recepción del anticipo correspondiente.
La forma de pago es 50% de anticipo y 50% contra entrega del material terminado`;

// Función para restaurar términos por defecto
function restaurarTerminosPorDefecto() {
    if (confirm('¿Restaurar términos y condiciones por defecto? Se perderán los cambios actuales.')) {
        document.getElementById('terminos_condiciones').value = TERMINOS_POR_DEFECTO;
    }
}

// Función para verificar si el texto es el mismo que el por defecto
function sonTerminosPorDefecto(texto) {
    return texto.trim() === TERMINOS_POR_DEFECTO.trim();
}

// Función para agregar cotización
async function agregar_cotizacion(event) {
    event.preventDefault(); // Prevenir envío normal del formulario
    
    const nombre_empresa = document.getElementById('cliente').value.trim();
    const nombre_contacto = document.getElementById('nombre_contacto').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const email = document.getElementById('email').value.trim();
    const proyecto_servicio = document.getElementById('proyecto_servicio').value.trim();
    const fecha = document.getElementById('fecha').value.trim();
    const terminos_condiciones = document.getElementById('terminos_condiciones').value;
    
    // Validaciones básicas
    if (!nombre_empresa || !nombre_contacto || !proyecto_servicio || !fecha) {
        alert('Por favor complete los campos obligatorios');
        return;
    }
    
    // Determinar si enviar los términos o dejar que la BD use el DEFAULT
    const enviarTerminos = !sonTerminosPorDefecto(terminos_condiciones);
    const terminosParam = enviarTerminos ? terminos_condiciones : null;
    
    try {
        // Guardar cotización
        if (isEditing) {
            // Para edición, siempre enviamos los términos (aunque sean los por defecto)
            await window.api.actualizarCotizacion(
                nombre_empresa, 
                fecha, 
                nombre_contacto, 
                telefono, 
                email, 
                proyecto_servicio, 
                terminos_condiciones, // Siempre enviar en actualización
                editingId
            );
            alert('Cotización actualizada exitosamente');

            await window.api.eliminarProductosCotizacion(editingId);
            await guardarProductos(editingId);
        } else {
            // Para nueva cotización, usamos la lógica de términos
            const cotizacionId = await window.api.agregarCotizacion(
                nombre_empresa, 
                fecha, 
                nombre_contacto, 
                telefono, 
                email, 
                proyecto_servicio,
                terminosParam // Puede ser null para usar DEFAULT
            );
            await guardarProductos(cotizacionId);
            alert('Cotización guardada exitosamente');
        }        
        
        // Redirigir a la página principal
        window.location.href = 'index.html';
        
    } catch (err) {
        console.error('Error al agregar cotización:', err);
        alert("Error al agregar cotización: " + err.message);
    }
}

// Función para guardar todos los productos de la cotización
async function guardarProductos(cotizacionId) {
    const tbody = document.getElementById('productosTable');
    const rows = tbody.children;
    
    for (let row of rows) {
        const nombreProducto = row.querySelector('input[name^="nombre_producto_"]').value.trim();
        const concepto = row.querySelector('input[name^="concepto_"]').value.trim();
        const unidades = parseInt(row.querySelector('input[name^="unidades_"]').value) || 0;
        const precio = parseFloat(row.querySelector('input[name^="precio_"]').value) || 0;
        const imagen = row.querySelector('input[name^="imagen_"]').value.trim();
        
        if (nombreProducto && concepto && unidades > 0 && precio > 0) {
            try {
                await window.api.agregarProducto(cotizacionId, nombreProducto, precio, concepto, unidades, imagen);
                console.log('Producto guardado:', { nombreProducto, concepto, unidades, precio, imagen });
            } catch (error) {
                console.error('Error al guardar producto:', error);
                throw new Error('Error al guardar productos');
            }
        }
    }
}

// Función para cargar cotización para editar
// Función para cargar cotización para editar
async function cargarCotizacionParaEditar(cotizacionId) {
    try {
        // Cargar datos de la cotización
        const cotizacion = await window.api.obtenerCotizacionId(cotizacionId);
        
        if (cotizacion) {
            // Llenar campos del formulario
            document.getElementById('cliente').value = cotizacion.empresa || '';
            document.getElementById('nombre_contacto').value = cotizacion.nombre_contacto || '';
            document.getElementById('telefono').value = cotizacion.telefono || '';
            document.getElementById('email').value = cotizacion.email || '';
            document.getElementById('proyecto_servicio').value = cotizacion.proyecto_servicio || '';
            document.getElementById('fecha').value = cotizacion.fecha || '';
            
            // Cargar términos y condiciones
            const terminosTextarea = document.getElementById('terminos_condiciones');
            if (cotizacion.terminos_condiciones) {
                terminosTextarea.value = cotizacion.terminos_condiciones;
            } else {
                // Si no hay términos en la BD, usar los por defecto
                terminosTextarea.value = TERMINOS_POR_DEFECTO;
            }
        }
        
        // Cargar productos de la cotización
        const productos = await window.api.obtenerProductos(cotizacionId);
        
        // Limpiar tabla
        document.getElementById('productosTable').innerHTML = '';
        itemCounter = 0;
        
        // Agregar productos existentes
        if (productos && productos.length > 0) {
            productos.forEach(producto => {
                const datosItem = {
                    nombre_producto: producto.nombre_producto || 'Producto',
                    concepto: producto.concepto || '',
                    unidades: producto.unidades || 0,
                    precio_unitario: producto.precio_unitario || 0,
                    imagen: producto.imagen || ''
                };
                agregarItem(datosItem);
            });
        } else {
            // Si no hay productos, agregar 1 item por defecto
            agregarItem();
        }
        
        // Cambiar texto del botón
        const submitButton = document.querySelector('button[type="submit"]');
        submitButton.innerHTML = '<i class="fas fa-check"></i> <span>Actualizar Cotización</span>';
        
    } catch (error) {
        console.error('Error al cargar cotización:', error);
        alert('Error al cargar la cotización');
        window.location.href = 'index.html';
    }
}


function agregarItem(datosItem = null) {
    itemCounter++;
    const tbody = document.getElementById('productosTable');
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-100';
    row.id = `item-${itemCounter}`;

    // Determinar el estado del botón de imagen
    const hasImage = datosItem && datosItem.imagen;
    const buttonClass = hasImage ? 'bg-blue-500 hover:bg-blue-600' : 'bg-green-500 hover:bg-green-600';
    const buttonText = hasImage ? '<i class="fas fa-check"></i> <span>Imagen agregada</span>' : '<i class="fas fa-image"></i> <span>Agregar imagen</span>';

    row.innerHTML =`
         <td class="py-1 px-1 text-sm align-top">
    <div class="flex space-x-1 items-center">
      <input
        type="text"
        name="nombre_producto_${itemCounter}"
        value="${datosItem ? (datosItem.nombre_producto || '') : ''}"
        class="min-w-0 max-w-xs px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm truncate"
        placeholder="Nombre del producto"
      >
      <button
        type="button"
        onclick="importarCampo('nombre_producto_${itemCounter}')"
        class="w-7 h-7 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
        title="Importar desde Excel"
      >
        <i class="fas fa-download"></i>
      </button>
    </div>
  </td>

  <td class="py-1 px-1 text-sm align-top">
    <div class="flex space-x-1 items-center">
      <input
        type="text"
        name="concepto_${itemCounter}"
        value="${datosItem ? (datosItem.concepto || '') : ''}"
        class="min-w-0 max-w-md px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm truncate"
        placeholder="Descripción"
      >
      <button
        type="button"
        onclick="importarCampo('concepto_${itemCounter}')"
        class="w-7 h-7 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
        title="Importar desde Excel"
      >
        <i class="fas fa-download"></i>
      </button>
    </div>
  </td>

  <td class="py-1 px-1 text-sm align-top">
    <div class="flex space-x-1 items-center">
      <input
        type="number"
        name="unidades_${itemCounter}"
        value="${datosItem ? (datosItem.unidades || '') : ''}"
        class="min-w-0 w-20 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm text-center"
        placeholder="0"
        min="1"
        onchange="calcularTotal()"
      >
      <button
        type="button"
        onclick="importarCampo('unidades_${itemCounter}')"
        class="w-7 h-7 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
        title="Importar desde Excel"
      >
        <i class="fas fa-download"></i>
      </button>
    </div>
  </td>

  <td class="py-1 px-1 text-sm align-top">
    <div class="flex space-x-1 items-center">
      <input
        type="number"
        name="precio_${itemCounter}"
        value="${datosItem ? (datosItem.precio_unitario || '') : ''}"
        step="0.01"
        class="min-w-0 w-24 px-2 py-1 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm text-right"
        placeholder="0.00"
        min="0"
        onchange="calcularTotal()"
      >
      <button
        type="button"
        onclick="importarCampo('precio_${itemCounter}')"
        class="w-7 h-7 flex items-center justify-center bg-blue-500 hover:bg-blue-600 text-white rounded text-xs transition-colors"
        title="Importar desde Excel"
      >
        <i class="fas fa-download"></i>
      </button>
    </div>
  </td>

  <td class="py-1 px-1 text-sm align-top">
    <div class="flex flex-col space-y-1 items-start">
      <button
        type="button"
        onclick="seleccionarImagen(${itemCounter})"
        class="${buttonClass} text-white px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
        title="${hasImage ? `Imagen: ${datosItem.imagen}` : 'Seleccionar imagen'}"
      >
        ${buttonText}
      </button>

      ${hasImage ? `
      <button
        type="button"
        onclick="eliminarImagen(${itemCounter})"
        class="w-7 h-7 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white rounded text-xs"
        title="Eliminar imagen"
      >
        <i class="fas fa-trash"></i>
      </button>
      ` : ''}
    </div>

    <input type="hidden" name="imagen_${itemCounter}" value="${datosItem ? (datosItem.imagen || '') : ''}">
  </td>

  <td class="py-1 px-1 text-center align-top">
    <div class="flex items-center justify-center space-x-1">
      <button
        type="button"
        onclick="agregarItem()"
        class="bg-green-500 hover:bg-green-600 text-white w-7 h-7 rounded-full transition-colors"
        title="Agregar fila"
      >
        <i class="fas fa-plus text-xs"></i>
      </button>

      <button
        type="button"
        onclick="eliminarItem(${itemCounter})"
        class="bg-red-500 hover:bg-red-600 text-white w-7 h-7 rounded-full transition-colors"
        title="Eliminar fila"
      >
        <i class="fas fa-minus text-xs"></i>
      </button>
    </div>
  </td>
    `;

    tbody.appendChild(row);
    
    // Si hay datos de imagen, mostrar preview
    if (hasImage) {
        console.log('El itemcounter es: ',itemCounter)
        console.log('Mostrando preview de imagen para item:', itemCounter, datosItem.imagen);
        mostrarPreviewImagen(itemCounter, datosItem.imagen);
    }
    
    mostrarMensajeNoProductos();
    calcularTotal();
}

function eliminarItem(id) {
    const row = document.getElementById(`item-${id}`);
    if (row) {
        // Confirmar eliminación si hay datos
        const inputs = row.querySelectorAll('input[type="text"], input[type="number"]');
        const hasData = Array.from(inputs).some(input => input.value.trim() !== '');
        
        if (hasData) {
            if (!confirm('¿Está seguro de eliminar este producto?')) {
                return;
            }
        }
        
        row.remove();
        mostrarMensajeNoProductos();
        calcularTotal();
    }
}

function mostrarMensajeNoProductos() {
    const tbody = document.getElementById('productosTable');
    const mensaje = document.getElementById('noProductsMessage');
    
    if (tbody.children.length === 0) {
        mensaje.classList.remove('hidden');
    } else {
        mensaje.classList.add('hidden');
    }
}

function calcularTotal() {
    let total = 0;
    const tbody = document.getElementById('productosTable');
    
    Array.from(tbody.children).forEach(row => {
        const unidades = parseFloat(row.querySelector('input[name^="unidades_"]').value) || 0;
        const precio = parseFloat(row.querySelector('input[name^="precio_"]').value) || 0;
        total += unidades * precio;
    });

    document.getElementById('totalAmount').textContent = `$${total.toFixed(2)}`;
}

// Funciones para manejo de imágenes
async function seleccionarImagen(itemId) {
    try {
        console.log('Seleccionando imagen para item:', itemId);
        
        // Llamar directamente a la función de Electron sin modal
        const fileName = await window.api.selectImage();
        
        if (fileName) {
            console.log('Imagen seleccionada:', fileName);
            
            // Guardar nombre de archivo en input hidden
            const hiddenInput = document.querySelector(`input[name="imagen_${itemId}"]`);
            if (hiddenInput) {
                hiddenInput.value = fileName.fileName;
                console.log('Valor guardado en input hidden:', fileName.fileName);
            }
            
            // Cambiar apariencia del botón
            const button = document.querySelector(`#item-${itemId} button[onclick*="seleccionarImagen"]`);
            if (button) {
                button.innerHTML = '<i class="fas fa-check"></i> <span>Imagen agregada</span>';
                button.classList.remove('bg-green-500', 'hover:bg-green-600');
                button.classList.add('bg-blue-500', 'hover:bg-blue-600');
                button.title = `Imagen: ${fileName.fileName}`;
            }
            
            // Mostrar preview
            await mostrarPreviewImagen(itemId, fileName.fileName);
            
            alert('Imagen agregada exitosamente');
        } else {
            console.log('No se seleccionó ninguna imagen');
        }
    } catch (error) {
        console.error('Error al seleccionar imagen:', error);
        alert('Error al seleccionar la imagen: ' + error.message);
    }
}

// Función para mostrar preview de imagen
async function mostrarPreviewImagen(itemId, fileName) {
    try {
        // Verificar si la imagen existe
        const exists = await window.api.imageExists(fileName);
        if (!exists) {
            console.warn('La imagen no existe:', fileName);
            return;
        }
        
        // Obtener ruta completa de la imagen
        const imagePath = await window.api.getImagePath(fileName);
        console.log('Ruta de imagen para preview:', imagePath);
        
        // Buscar si ya existe un preview
        let previewContainer = document.querySelector(`#preview-container-${itemId}`);
        console.log('El id del item es: ',itemId)
        console.log('Preview container existente:', previewContainer);
        
        if (!previewContainer) {
            // Crear contenedor de preview
            const row = document.getElementById(`item-${itemId}`);
            const imageCell = row.querySelector('td:nth-child(5)'); // Columna de imagen
            
            previewContainer = document.createElement('div');
            previewContainer.id = `preview-container-${itemId}`;
            previewContainer.className = 'mt-2';
            
            previewContainer.innerHTML = `
                <div class="border rounded p-2 bg-gray-50">
                    <img 
                        id="preview_${itemId}" 
                        src="file://${imagePath}" 
                        alt="Preview" 
                        class="w-16 h-16 object-cover rounded border mx-auto block"
                        onload="console.log('Imagen preview cargada correctamente')"
                        onerror="console.error('Error al cargar imagen preview:', this.src); this.style.display='none';"
                    >
                    <p class="text-xs text-gray-600 mt-1 text-center truncate" title="${fileName}">
                        ${fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName}
                    </p>
                </div>
            `;
            
            imageCell.appendChild(previewContainer);
        } else {
            // Actualizar preview existente
            const img = previewContainer.querySelector('img');
            const text = previewContainer.querySelector('p');
            
            if (img) {
                img.src = `file://${imagePath}`;
                img.alt = fileName;
            }
            if (text) {
                text.textContent = fileName.length > 20 ? fileName.substring(0, 17) + '...' : fileName;
                text.title = fileName;
            }
        }
        
    } catch (error) {
        console.error('Error al mostrar preview:', error);
    }
}

// Función para eliminar imagen
function eliminarImagen(itemId) {
    const hiddenInput = document.querySelector(`input[name="imagen_${itemId}"]`);
    const previewContainer = document.querySelector(`#preview-container-${itemId}`);
    const button = document.querySelector(`#item-${itemId} button[onclick*="seleccionarImagen"]`);
    
    if (hiddenInput) {
        hiddenInput.value = '';
    }
    
    if (previewContainer) {
        previewContainer.remove();
    }
    
    if (button) {
        button.innerHTML = '<i class="fas fa-image"></i> <span>Agregar imagen</span>';
        button.classList.remove('bg-blue-500', 'hover:bg-blue-600');
        button.classList.add('bg-green-500', 'hover:bg-green-600');
        button.title = '';
    }
}


function cerrarModalImagen() {

}

async function confirmarImagen() {
  
}


// Funciones de navegación
function volverAtras() {
    if (confirm('¿Está seguro de salir? Los cambios no guardados se perderán.')) {
        window.location.href = 'index.html';
    }
}

async function guardarBorrador() {
    const nombre_empresa = document.getElementById('cliente').value.trim();
    const nombre_contacto = document.getElementById('nombre_contacto').value.trim();
    const proyecto_servicio = document.getElementById('proyecto_servicio').value.trim();
    
    if (!nombre_empresa || !nombre_contacto || !proyecto_servicio) {
        alert('Complete al menos los campos básicos para guardar como borrador');
        return;
    }
    
    try {
        // Aquí podrías implementar una función específica para borradores
        // Por ahora, usaremos la función normal
        await agregar_cotizacion(new Event('submit'));
        alert('Borrador guardado exitosamente');
    } catch (error) {
        console.error('Error al guardar borrador:', error);
        alert('Error al guardar el borrador');
    }
}

// Evento para el input de archivo
document.getElementById('imageInput').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
        const fileName = e.target.files[0].name;
        console.log('Archivo seleccionado:', fileName);
    }
});

// Funciones de utilidad
function limpiarFormulario() {
    document.getElementById('cotizacionForm').reset();
    document.getElementById('productosTable').innerHTML = '';
    itemCounter = 0;
    agregarItem();
    agregarItem();
    mostrarMensajeNoProductos();
    calcularTotal();
}

// Auto-guardar cada 5 minutos (opcional)
setInterval(() => {
    const hasData = document.getElementById('cliente').value.trim() !== '';
    if (hasData) {
        console.log('Auto-guardado disponible');
        // Implementar auto-guardado si es necesario
    }
}, 300000); // 5 minutos

// Calcular total inicial después de cargar
setTimeout(() => {
    calcularTotal();
}, 100);

function indexToColumnLabel(index) {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const rem = (n - 1) % 26;
    label = String.fromCharCode(65 + rem) + label;
    n = Math.floor((n - 1) / 26);
  }
  return label;
}

/**
 * Llena un <select> con columnas A..N mostrando un ejemplo (primer valor no vacío)
 * aoa: array of arrays (sheetData)
 * maxCols: número de columnas a generar
 */
function populateColumnSelect(selectElement, aoa, maxCols) {
  if (!selectElement) return;
  selectElement.innerHTML = '<option value="">Seleccionar...</option>';
  for (let c = 0; c < maxCols; c++) {
    const label = indexToColumnLabel(c);
    let example = '';
    for (let r = 0; r < Math.min(20, aoa.length); r++) {
      if (aoa[r] && aoa[r][c] !== undefined && aoa[r][c] !== null && String(aoa[r][c]).trim() !== '') {
        example = String(aoa[r][c]);
        break;
      }
    }
    const opt = document.createElement('option');
    opt.value = label;
    opt.textContent = example ? `${label} — ${example}` : `${label}`;
    selectElement.appendChild(opt);
  }
}

/**
 * Función que se llama cuando cambia el select #hojaExcel
 * Rellena los selects de columnas y (opcionalmente) un preview.
 * Usa window.sheetDataMap si existe (creado por seleccionarArchivoExcel).
 */
function onHojaExcelChanged() {
  const hojaSelect = document.getElementById('hojaExcel');
  if (!hojaSelect) return;
  const selected = hojaSelect.value;
  if (!selected || !window.sheetDataMap || !window.sheetDataMap[selected]) {
    // limpiar selects si no hay hoja
    ['columnaExcel','columnaNombreProducto','columnaConcepto','columnaUnidades','columnaPrecio'].forEach(id => {
      const s = document.getElementById(id);
      if (s) s.innerHTML = '<option value="">Seleccionar...</option>';
    });
    return;
  }

  const aoa = window.sheetDataMap[selected];
  // calcular máximo columnas (basado en filas presentes)
  const maxCols = aoa.reduce((m, row) => Math.max(m, (row && row.length) || 0), 0) || 1;

  // poblar selects si existen en el DOM
  const idsToFill = [
    'columnaExcel', 'columnaNombreProducto', 'columnaConcepto', 'columnaUnidades', 'columnaPrecio'
  ];
  idsToFill.forEach(id => {
    const sel = document.getElementById(id);
    if (sel) populateColumnSelect(sel, aoa, maxCols);
  });

  // Guardar nombre de hoja seleccionada en variable global si es necesario
  window.currentSheetName = selected;
}

/* ----------------- Vinculación del evento change para #hojaExcel ----------------- */

// crear_cotizacion.js (fragmento, pega donde quieras)
async function seleccionarArchivoExcel() {
  try {
    const res = await window.api.selectAndParseExcel();
    if (!res) {
      // usuario canceló
      console.log('Selección cancelada');
      return;
    }
    if (res.error) {
      alert('Error al procesar el archivo: ' + res.error);
      return;
    }

    // res: { name, sheetNames, sheetDataMap }
    document.getElementById('archivoExcel').value = res.name;

    // Guardar globalmente para otras funciones
    window.sheetDataMap = res.sheetDataMap;
    window.workbookSheetNames = res.sheetNames;

    // Poblar select de hojas
    const hojaSelect = document.getElementById('hojaExcel');
    if (hojaSelect) {
      hojaSelect.innerHTML = '<option value="">Seleccionar hoja...</option>';
      res.sheetNames.forEach(n => {
        const opt = document.createElement('option');
        opt.value = n;
        opt.textContent = n;
        hojaSelect.appendChild(opt);
      });
      hojaSelect.disabled = false;
      hojaSelect.value = res.sheetNames[0];
    }

    // Disparar la función que llena selects de columnas y preview
    if (typeof onHojaExcelChanged === 'function') {
      onHojaExcelChanged();
    } else {
      console.warn('onHojaExcelChanged no está definida');
    }
  } catch (err) {
    console.error('Error en seleccionarArchivoExcel:', err);
    alert('Error al seleccionar o procesar el archivo: ' + (err.message || err));
  }
}

async function importarCampo(campoNombre) {
  console.log('Importando campo:', campoNombre);
  
  if (!window.sheetDataMap || !window.currentSheetName) {
    alert('Primero seleccione un archivo y una hoja de Excel');
    return;
  }

  try {
    console.log('Llamando a importarDatosExcel con:', window.currentSheetName);
    
    // Llamar a la función que abre la ventana y esperar el resultado
    const cellData = await window.api.importarDatosExcel(window.sheetDataMap, window.currentSheetName);
    
    if (cellData && cellData.value !== undefined) {
      console.log('Datos de celda recibidos:', cellData);
      
      // Buscar el campo y asignar el valor
      const campo = document.getElementById(campoNombre) || document.querySelector(`[name="${campoNombre}"]`);
      
      if (campo) {
        campo.value = cellData.value;
        console.log('Valor asignado al campo:', campoNombre, '=', cellData.value);
        
        // Si es un campo de precio o unidades, recalcular total
        if (campoNombre.includes('precio_') || campoNombre.includes('unidades_')) {
          calcularTotal();
        }
        
        // Mostrar confirmación
        alert(`Valor importado: "${cellData.value}" desde celda ${cellData.address}`);
      } else {
        console.error('Campo no encontrado:', campoNombre);
        alert('Error: No se pudo encontrar el campo destino');
      }
    } else {
      console.log('No se seleccionó ninguna celda o se canceló');
    }
  } catch (error) {
    console.error('Error al importar campo:', error);
    alert('Error al importar datos: ' + (error.message || error));
  }
}

// También agrega esta función de debug para verificar el estado:
function debugExcelState() {
  console.log('Estado de Excel:');
  console.log('- sheetDataMap:', !!window.sheetDataMap);
  console.log('- currentSheetName:', window.currentSheetName);
  console.log('- API disponible:', !!window.api);
  
  if (window.sheetDataMap && window.currentSheetName) {
    const data = window.sheetDataMap[window.currentSheetName];
    console.log('- Datos de hoja actual:', data ? data.length + ' filas' : 'No data');
  }
}