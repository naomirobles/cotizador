let cotizacionAEliminar = null;

// Cargar cotizaciones al iniciar
document.addEventListener('DOMContentLoaded', cargarCotizaciones);

async function cargarCotizaciones() {
    const cotizaciones = await window.api.obtenerCotizaciones();
    const tbody = document.getElementById('cotizacionesTable');
    
    tbody.innerHTML = '';
    
    if (cotizaciones.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="px-6 py-8 text-center text-gray-500">
                    <i class="fas fa-file-invoice text-4xl mb-4 opacity-50"></i>
                    <p>No hay cotizaciones guardadas</p>
                    <button onclick="abrirNuevaCotizacion()" class="mt-4 text-blue-600 hover:text-blue-800">
                        Crear primera cotización
                    </button>
                </td>
            </tr>
        `;
        return;
    }

    cotizaciones.forEach(cotizacion => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50';
        row.innerHTML = `
            <td class="px-6 py-4 text-sm text-gray-900">${cotizacion.id_cotizacion}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${cotizacion.empresa}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${cotizacion.proyecto_servicio}</td>
            <td class="px-6 py-4 text-sm text-gray-900">${cotizacion.fecha}</td>
            <td class="px-6 py-4 text-center">
                <div class="flex justify-center space-x-2">
                    <button 
                        onclick="editarCotizacion('${cotizacion.id_cotizacion}')"
                        class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded text-sm transition-colors"
                    >
                        <i class="fa-solid fa-pencil"></i>
                    </button>
                    <button 
                        onclick="copiarCotizacion(${cotizacion.id_cotizacion})" 
                        class="bg-indigo-500 hover:bg-indigo-600 text-white px-4 py-2 rounded text-sm transition-colors"
                    >
                        <i class="fa-solid fa-copy"></i>
                    </button>
                    <button 
                        onclick="generarPDF('${cotizacion.id_cotizacion}')"
                        class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded text-sm transition-colors"
                    >
                        <i class="fa-solid fa-file-pdf"></i>
                    </button>
                    <button 
                        onclick="eliminarCotizacion('${cotizacion.id_cotizacion}')"
                        class="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded text-sm transition-colors"
                    >
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function abrirNuevaCotizacion() {
    window.location.href = 'crear-cotizacion.html';
}

function editarCotizacion(id) {
    window.location.href = `crear-cotizacion.html?id=${id}`;
}

function eliminarCotizacion(id) {
    cotizacionAEliminar = id;
    document.getElementById('deleteModal').classList.remove('hidden');
    document.getElementById('deleteModal').classList.add('flex');
}

function cerrarModalEliminar() {
    document.getElementById('deleteModal').classList.add('hidden');
    document.getElementById('deleteModal').classList.remove('flex');
    cotizacionAEliminar = null;
}

// Función para copiar cotización
async function copiarCotizacion(id) {
    try {
        mostrarCargando('Copiando cotización...');
        const resultado = await window.api.copiarCotizacion(id);
        ocultarCargando();

        if (resultado.success) {
            mostrarNotificacion('Cotización copiada exitosamente', 'success');
            cargarCotizaciones(); // refrescar tabla
        } else {
            throw new Error('Error al copiar cotización');
        }
    } catch (error) {
        ocultarCargando();
        console.error('Error copiando cotización:', error);
        mostrarNotificacion('Error al copiar cotización: ' + error.message, 'error');
    }
}


async function confirmarEliminar() {
    if (cotizacionAEliminar) {
        await window.api.eliminarCotizacion(cotizacionAEliminar);
        cargarCotizaciones();
        cerrarModalEliminar();
    }
}

// Función para generar pdf
async function generarPDF(id_cotizacion) {
    try{
        mostrarCargando('Generando PDF...');
        console.log('Generando PDF para cotización: ',id_cotizacion);
        const resultado = await window.api.generarPDF(id_cotizacion);
        ocultarCargando();

        if(resultado.success){

            await window.api.abrirPDF(resultado.filePath);
            // Mostrar notificación de éxito
            mostrarNotificacion('PDF generado exitosamente', 'success');
        }else{
            throw new Error('Error al generar PDF.');
        }
    }catch (error) {
        ocultarCargando();
        console.error('Error al generar PDF:', error);
        mostrarNotificacion('Error al generar PDF: ' + error.message, 'error');
    }
}

// Búsqueda en tiempo real
document.getElementById('searchInput').addEventListener('input', function(e) {
    const busqueda = e.target.value.toLowerCase();
    const filas = document.querySelectorAll('#cotizacionesTable tr');
    
    filas.forEach(fila => {
        const texto = fila.textContent.toLowerCase();
        if (texto.includes(busqueda)) {
            fila.style.display = '';
        } else {
            fila.style.display = 'none';
        }
    });
});

// Función para mostrar indicador de carga
function mostrarCargando(mensaje = 'Cargando...') {
    const loader = document.createElement('div');
    loader.id = 'pdf-loader';
    loader.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
    loader.innerHTML = `
        <div class="bg-white p-6 rounded-lg shadow-lg flex items-center space-x-4">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span class="text-gray-700">${mensaje}</span>
        </div>
    `;
    document.body.appendChild(loader);
}

function ocultarCargando() {
    const loader = document.getElementById('pdf-loader');
    if (loader) {
        loader.remove();
    }
}

// Función para mostrar notificaciones
function mostrarNotificacion(mensaje, tipo = 'info') {
    const colores = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        info: 'bg-blue-500',
        warning: 'bg-yellow-500'
    };

    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 ${colores[tipo]} text-white p-4 rounded shadow-lg z-50 transform transition-all duration-300`;
    notification.textContent = mensaje;
    
    document.body.appendChild(notification);
    
    // Remover después de 3 segundos
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}