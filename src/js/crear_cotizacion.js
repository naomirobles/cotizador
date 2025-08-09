let itemCounter = 0;
let currentImageRow = null;
let isEditing = false;
let editingId = null;

// Inicializar formulario
document.addEventListener('DOMContentLoaded', function() {
    
    const cotizacionForm = document.getElementById('cotizacionForm');
    cotizacionForm.addEventListener('submit', agregar_cotizacion);

    // Establecer fecha actual
    fecha.value = new Date().toISOString().split('T')[0];
    
    // Verificar si estamos editando
    const urlParams = new URLSearchParams(window.location.search);
    const cotizacionId = urlParams.get('id');
    
    if (cotizacionId) {
        cargarCotizacionParaEditar(cotizacionId);
    } else {
        // Agregar dos items por defecto (como en la imagen)
        agregarItem();
        agregarItem();
    }

    mostrarMensajeNoProductos();
});

async function cargarCotizacionParaEditar(id) {
  console.log("este es el id: ", id);

  isEditing  = true;
  editingId = id;
  
  // 1) Traer cotización
  const cotizacion = await window.api.obtenerCotizacionId(id);

  // 2) Traer productos asociados (si ya implementaste el handler)
  const items = await window.api.obtenerProductos(id);

  if (cotizacion) {
    // —————— Rellenar los inputs correctamente ——————
    document.getElementById('cliente').value           = cotizacion.empresa;
    document.getElementById('nombre_contacto').value   = cotizacion.nombre_contacto;
    document.getElementById('telefono').value          = cotizacion.telefono;
    document.getElementById('email').value             = cotizacion.email;
    document.getElementById('proyecto_servicio').value = cotizacion.proyecto_servicio;
    document.getElementById('fecha').value = cotizacion.fecha.trim();

    // —————— Cargar filas de productos ——————
    items.forEach(item => {
      agregarItem({
        nombre_producto:  item.nombre_producto || item.concepto, 
        concepto:         item.concepto,
        unidades:         item.unidades,
        precio_unitario:  item.precio_unitario,
        imagen:           item.imagen || ''
      });
    });

    // Ajustar UI
    document.querySelector('h2').textContent = 'Editar Cotización';
    calcularTotal();  // recalcula subtotales
  }
}


async function agregar_cotizacion(event){
    const nombre_empresa = document.getElementById('cliente').value.trim();
    const nombre_contacto = document.getElementById('nombre_contacto').value.trim();
    const telefono = document.getElementById('telefono').value.trim();
    const email = document.getElementById('email').value.trim();
    const proyecto_servicio = document.getElementById('proyecto_servicio').value.trim();
    const fecha = document.getElementById('fecha').value.trim();
    console.log(nombre_empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio)
    try{
        await window.api.agregarCotizacion(
            nombre_empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio
        );
    }catch(err){
        console.log(err);
        alert("Error al agregar cotizacion");
    }
}


function agregarItem(datosItem = null) {
    itemCounter++;
    const tbody = document.getElementById('productosTable');
    const row = document.createElement('tr');
    row.className = 'border-b border-gray-100';
    row.id = `item-${itemCounter}`;

    row.innerHTML = `
        <td class="py-3 px-2">
            <input 
                type="text" 
                name="nombre_producto_${itemCounter}"
                value="${datosItem ? datosItem.nombre_producto : 'Libreta'}"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Nombre del producto"
            >
        </td>
        <td class="py-3 px-2">
            <input 
                type="text" 
                name="concepto_${itemCounter}"
                value="${datosItem ? datosItem.concepto : 'Libreta tamaño carta'}"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="Descripción"
            >
        </td>
        <td class="py-3 px-2">
            <input 
                type="number" 
                name="unidades_${itemCounter}"
                value="${datosItem ? datosItem.unidades : '200'}"
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
                value="${datosItem ? datosItem.precio_unitario : '0.39'}"
                step="0.01"
                class="w-full px-3 py-2 border border-gray-300 rounded focus:ring-1 focus:ring-blue-500 text-sm"
                placeholder="0.00"
                min="0"
                onchange="calcularTotal()"
            >
        </td>
        <td class="py-3 px-2">
            <button 
                type="button" 
                onclick="seleccionarImagen(${itemCounter})"
                class="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded text-sm flex items-center space-x-1 transition-colors"
            >
                <i class="fas fa-image"></i>
                <span>Agregar imagen</span>
            </button>
            <input type="hidden" name="imagen_${itemCounter}" value="${datosItem ? datosItem.imagen || '' : ''}">
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
    mostrarMensajeNoProductos();
    calcularTotal();
}

function eliminarItem(id) {
    const row = document.getElementById(`item-${id}`);
    if (row) {
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

async function seleccionarImagen(itemId) {
    currentImageRow = itemId;
    document.getElementById('imageModal').classList.remove('hidden');
    document.getElementById('imageModal').classList.add('flex');
}

function cerrarModalImagen() {
    document.getElementById('imageModal').classList.add('hidden');
    document.getElementById('imageModal').classList.remove('flex');
    currentImageRow = null;
}

async function confirmarImagen() {
    const fileInput = document.getElementById('imageInput');
    if (fileInput.files.length > 0 && currentImageRow) {
        try {
            const fileName = await ipcRenderer.invoke('select-image');
            if (fileName) {
                const hiddenInput = document.querySelector(`input[name="imagen_${currentImageRow}"]`);
                hiddenInput.value = fileName;
                
                // Cambiar el botón para mostrar que se seleccionó imagen
                const button = document.querySelector(`#item-${currentImageRow} button[onclick*="seleccionarImagen"]`);
                button.innerHTML = '<i class="fas fa-check"></i> <span>Imagen agregada</span>';
                button.classList.remove('bg-green-500', 'hover:bg-green-600');
                button.classList.add('bg-blue-500', 'hover:bg-blue-600');
            }
        } catch (error) {
            console.error('Error al seleccionar imagen:', error);
            alert('Error al seleccionar la imagen');
        }
    }
    cerrarModalImagen();
}

function volverAtras() {
    window.location.href = 'index.html';
}

function guardarBorrador() {
    // Implementar guardado como borrador
    alert('Funcionalidad de borrador en desarrollo');
}

// Evento para el input de archivo
document.getElementById('imageInput').addEventListener('change', function(e) {
    if (e.target.files.length > 0) {
        const fileName = e.target.files[0].name;
        console.log('Archivo seleccionado:', fileName);
    }
});

// Calcular total inicial
setTimeout(() => {
    calcularTotal();
}, 100);