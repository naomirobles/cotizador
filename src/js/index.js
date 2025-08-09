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
                        Editar
                    </button>
                    <button 
                        onclick="generarPDF('${cotizacion.id_cotizacion}')"
                        class="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded text-sm transition-colors"
                    >
                        Ver PDF
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

async function confirmarEliminar() {
    if (cotizacionAEliminar) {
        await window.api.eliminarCotizacion(cotizacionAEliminar);
        cargarCotizaciones();
        cerrarModalEliminar();
    }
}

async function generarPDF(id) {
    // Esta función se implementará con el generador de PDF
    const cotizacion = db.obtenerCotizacion(id);
    console.log('Generar PDF para:', cotizacion);
    // TODO: Implementar generación de PDF
    alert('Función de PDF en desarrollo');
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