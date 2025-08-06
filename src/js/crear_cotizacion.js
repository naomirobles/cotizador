let itemCounter = 0;
let currentImageRow = null;
let isEditing = false;
let editingId = null;

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

// Función para agregar cotización (corregida)
async function agregar_cotizacion(event) {
    event.preventDefault(); // Prevenir envío normal del formulario
    
    const nombre_empresa = document.getElementById('cliente').value.trim();
    const nombre_contacto = document.getElementById('nombre_contacto').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const email = document.getElementById('email').value.trim();
    const proyecto_servicio = document.getElementById('proyecto_servicio').value.trim();
    const fecha = document.getElementById('fecha').value.trim();
    
    // Validaciones básicas
    if (!nombre_empresa || !nombre_contacto || !proyecto_servicio || !fecha) {
        alert('Por favor complete los campos obligatorios');
        return;
    }
    
    try {
        // Guardar cotización
        const cotizacionId = await window.api.agregarCotizacion(
            nombre_empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio
        );
        
        // Guardar productos
        await guardarProductos(cotizacionId);
        
        alert('Cotización guardada exitosamente');
        
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
                await window.api.agregarProducto(cotizacionId, precio, concepto, unidades, imagen);
                console.log('Producto guardado:', { nombreProducto, concepto, unidades, precio, imagen });
            } catch (error) {
                console.error('Error al guardar producto:', error);
                throw new Error('Error al guardar productos');
            }
        }
    }
}

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
                    nombre_producto: producto.concepto || 'Producto',
                    concepto: producto.concepto || '',
                    unidades: producto.unidades || 0,
                    precio_unitario: producto.precio_unitario || 0,
                    imagen: producto.imagen || ''
                };
                agregarItem(datosItem);
            });
        } else {
            // Si no hay productos, agregar dos items por defecto
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

    row.innerHTML = `
        <td class="py-3 px-2">
            <input 
                type="text" 
                name="nombre_producto_${itemCounter}"
                value="${datosItem ? (datosItem.nombre_producto || '') : ''}"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Nombre del producto"
            >
        </td>
        <td class="py-3 px-2">
            <input 
                type="text" 
                name="concepto_${itemCounter}"
                value="${datosItem ? (datosItem.concepto || '') : ''}"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Descripción"
            >
        </td>
        <td class="py-3 px-2">
            <input 
                type="number" 
                name="unidades_${itemCounter}"
                value="${datosItem ? (datosItem.unidades || '') : ''}"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="0"
                min="1"
                onchange="calcularTotal()"
            >
        </td>
        <td class="py-3 px-2">
            <input 
                type="number" 
                name="precio_${itemCounter}"
                value="${datosItem ? (datosItem.precio_unitario || '') : ''}"
                step="0.01"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="0.00"
                min="0"
                onchange="calcularTotal()"
            >
        </td>
        <td class="py-3 px-2">
            <div class="flex flex-col space-y-2">
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
                    class="bg-red-500 hover:bg-red-600 text-white px-2 py-1 rounded text-xs"
                    title="Eliminar imagen"
                >
                    <i class="fas fa-trash"></i>
                </button>
                ` : ''}
            </div>
            <input type="hidden" name="imagen_${itemCounter}" value="${datosItem ? (datosItem.imagen || '') : ''}">
        </td>
        <td class="py-3 px-2 text-center">
            <button 
                type="button" 
                onclick="agregarItem()"
                class="bg-green-500 hover:bg-green-600 text-white w-8 h-8 rounded-full mr-2 transition-colors"
                title="Agregar fila"
            >
                <i class="fas fa-plus text-sm"></i>
            </button>
            <button 
                type="button" 
                onclick="eliminarItem(${itemCounter})"
                class="bg-red-500 hover:bg-red-600 text-white w-8 h-8 rounded-full transition-colors"
                title="Eliminar fila"
            >
                <i class="fas fa-minus text-sm"></i>
            </button>
        </td>
    `;

    tbody.appendChild(row);
    
    // Si hay datos de imagen, mostrar preview
    if (hasImage) {
        setTimeout(() => {
            mostrarPreviewImagen(itemCounter, datosItem.imagen);
        }, 100);
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
                hiddenInput.value = fileName;
                console.log('Valor guardado en input hidden:', fileName);
            }
            
            // Cambiar apariencia del botón
            const button = document.querySelector(`#item-${itemId} button[onclick*="seleccionarImagen"]`);
            if (button) {
                button.innerHTML = '<i class="fas fa-check"></i> <span>Imagen agregada</span>';
                button.classList.remove('bg-green-500', 'hover:bg-green-600');
                button.classList.add('bg-blue-500', 'hover:bg-blue-600');
                button.title = `Imagen: ${fileName}`;
            }
            
            // Mostrar preview
            await mostrarPreviewImagen(itemId, fileName);
            
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