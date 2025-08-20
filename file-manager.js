

//=========================================================
const { app, BrowserWindow, ipcMain, dialog } = require('electron'); // ← AGREGAR dialog aquí
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
//SQLITE 
const sqlite3 = require('sqlite3').verbose();
// PUPPETEER PARA GENERAR PDF
const puppeteer = require('puppeteer');

// Crear directorio de imágenes si no existe
const imageDir = path.join(__dirname, 'imagenes');
if (!fs.existsSync(imageDir)) {
  fs.mkdirSync(imageDir, { recursive: true });
}

const db = new sqlite3.Database('cotizaciones_productos.db');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon:'assets/icon.png',
    show: false
  });

  mainWindow.loadFile('src/index.html');

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.webContents.openDevTools();
  }
}

db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS Cotizaciones (
      id_cotizacion INTEGER PRIMARY KEY AUTOINCREMENT,
      empresa TEXT NOT NULL,
      fecha TEXT NOT NULL,
      nombre_contacto TEXT NOT NULL,
      telefono TEXT NOT NULL,
      email TEXT NOT NULL,
      proyecto_servicio TEXT NOT NULL
    )`);
      
  db.run(`
    CREATE TABLE IF NOT EXISTS Productos(
      id_producto INTEGER PRIMARY KEY AUTOINCREMENT,
      id_cotizacion INTEGER NOT NULL,
      nombre_producto TEXT NOT NULL,
      precio_unitario REAL NOT NULL, 
      concepto TEXT NOT NULL,
      unidades INTEGER NOT NULL,
      imagen TEXT,
      FOREIGN KEY(id_cotizacion) REFERENCES Cotizaciones(id_cotizacion)
    )`);
});

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// IPC handlers
ipcMain.handle('obtener-cotizaciones', () => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM Cotizaciones ORDER BY fecha DESC`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle('obtener-cotizacion-id', (event, id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM Cotizaciones WHERE id_cotizacion = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
});

ipcMain.handle('agregar-cotizacion', (event, empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO Cotizaciones (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) VALUES (?, ?, ?, ?, ?, ?)`, 
    [empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

ipcMain.handle('eliminar-cotizacion', (event, id) => {
  return new Promise((resolve, reject) => {
    db.all(`DELETE FROM COTIZACIONES WHERE id_cotizacion = ?`, [id], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

ipcMain.handle('actualizar-cotizacion', (event, empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, id_cotizacion) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE Cotizaciones SET empresa = ?, fecha = ?, nombre_contacto = ?, telefono = ?, email = ?, proyecto_servicio = ? WHERE id_cotizacion = ?`, 
    [empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, id_cotizacion], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

// Tabla productos 
ipcMain.handle('agregar-producto', (event, id_cotizacion, nombre_producto, precio_unitario, concepto, unidades, imagen = null) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO Productos (id_cotizacion, nombre_producto, precio_unitario, concepto, unidades, imagen) VALUES (?, ?, ?, ?, ?, ?)`, 
    [id_cotizacion, nombre_producto, precio_unitario, concepto, unidades, imagen], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

ipcMain.handle('obtener-productos', (event, id_cotizacion) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM Productos WHERE id_cotizacion = ? ORDER BY concepto`, [id_cotizacion], (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
});

ipcMain.handle('obtener-producto-id', (event, id) => {
  return new Promise((resolve, reject) => {
    db.get(`SELECT * FROM Productos WHERE id_producto = ?`, [id], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
});

ipcMain.handle('eliminar-productos-cotizacion', (event, id_cotizacion) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM Productos WHERE id_cotizacion = ?`, [id_cotizacion], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
});

// IPC Handler para obtener datos completos de cotización
ipcMain.handle('obtener-cotizacion-completa', async (event, id_cotizacion) => {
    return new Promise((resolve, reject) => {
        db.get(`SELECT * FROM Cotizaciones WHERE id_cotizacion = ?`, [id_cotizacion], (err, cotizacion) => {
            if (err) {
                reject(err);
                return;
            }
            
            db.all(`SELECT * FROM Productos WHERE id_cotizacion = ? ORDER BY nombre`, [id_cotizacion], (err, productos) => {
                if (err) {
                    reject(err);
                    return;
                }
                
                let subtotal = 0;
                productos.forEach(producto => {
                    subtotal += (producto.unidades * producto.precio_unitario);
                });
                
                const iva = subtotal * 0.16;
                const total = subtotal + iva;
                
                const datosCompletos = {
                    cotizacion,
                    productos,
                    subtotal: subtotal.toFixed(2),
                    iva: iva.toFixed(2),
                    total: total.toFixed(2),
                    totalEnLetras: numeroALetras(total)
                };
                
                resolve(datosCompletos);
            });
        });
    });
});

// FUNCIÓN DE SELECCIONAR IMAGEN --------------------------------------
ipcMain.handle('select-image', async () => {
  try {
    console.log('Iniciando selección de imagen...');
    
    const result = await dialog.showOpenDialog(mainWindow, {
      title: 'Seleccionar imagen',
      filters: [
        { name: 'Imágenes', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: 'Todos los archivos', extensions: ['*'] }
      ],
      properties: ['openFile']
    });

    console.log('Resultado del dialog:', result);

    if (!result.canceled && result.filePaths.length > 0) {
      const filePath = result.filePaths[0];
      const fileName = path.basename(filePath);
      const timestamp = Date.now();
      const uniqueFileName = `${timestamp}_${fileName}`;
      const destPath = path.join(__dirname, 'imagenes', uniqueFileName);

      console.log('Archivo seleccionado:', filePath);
      console.log('Destino:', destPath);

      // Verificar que el archivo origen existe
      if (!fs.existsSync(filePath)) {
        throw new Error('El archivo seleccionado no existe');
      }

      // Copiar archivo al directorio de imágenes
      try {
        fs.copyFileSync(filePath, destPath);
        console.log('Imagen copiada exitosamente:', uniqueFileName);
        return uniqueFileName;
      } catch (copyError) {
        console.error('Error al copiar imagen:', copyError);
        throw new Error('Error al copiar la imagen: ' + copyError.message);
      }
    }

    console.log('No se seleccionó ninguna imagen');
    return null;
  } catch (error) {
    console.error('Error en select-image:', error);
    throw error;
  }
});

// Obtener ruta completa de imagen
ipcMain.handle('get-image-path', (event, fileName) => {
  if (!fileName) return null;
  const imagePath = path.join(__dirname, 'imagenes', fileName);
  console.log('Ruta de imagen solicitada:', imagePath);
  return imagePath;
});

// Verificar si imagen existe
ipcMain.handle('image-exists', (event, fileName) => {
  if (!fileName) return false;
  const imagePath = path.join(__dirname, 'imagenes', fileName);
  const exists = fs.existsSync(imagePath);
  console.log('Verificando si existe:', imagePath, 'Resultado:', exists);
  return exists;
});


// Función para convertir números a letras (pesos mexicanos)-------------------------------------------
function numeroALetras(numero) {
    const unidades = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
    const decenas = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
    const especiales = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
    const centenas = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];
    
    if (numero === 0) return 'cero pesos 00/100 M.N.';
    if (numero === 100) return 'cien pesos 00/100 M.N.';
    
    let entero = Math.floor(numero);
    let centavos = Math.round((numero - entero) * 100);
    
    function convertirGrupo(n) {
        if (n === 0) return '';
        if (n === 100) return 'cien';
        
        let resultado = '';
        let c = Math.floor(n / 100);
        let d = Math.floor((n % 100) / 10);
        let u = n % 10;
        
        if (c > 0) {
            if (n === 100) resultado += 'cien';
            else resultado += centenas[c];
        }
        
        if (d === 1 && u > 0) {
            resultado += (resultado ? ' ' : '') + especiales[u];
        } else {
            if (d === 2 && u > 0) {
                resultado += (resultado ? ' ' : '') + 'veinti' + unidades[u];
            } else {
                if (d > 0) resultado += (resultado ? ' ' : '') + decenas[d];
                if (u > 0) {
                    if (d > 2) resultado += ' y ';
                    else if (resultado) resultado += ' ';
                    resultado += unidades[u];
                }
            }
        }
        
        return resultado;
    }
    
    function convertirNumero(n) {
        if (n === 0) return '';
        if (n === 1) return 'un';
        if (n < 1000) return convertirGrupo(n);
        
        let miles = Math.floor(n / 1000);
        let resto = n % 1000;
        
        let resultado = '';
        if (miles === 1) {
            resultado = 'mil';
        } else if (miles < 1000) {
            resultado = convertirGrupo(miles) + ' mil';
        } else {
            let millones = Math.floor(miles / 1000);
            let milesResto = miles % 1000;
            
            if (millones === 1) {
                resultado = 'un millón';
            } else {
                resultado = convertirGrupo(millones) + ' millones';
            }
            
            if (milesResto > 0) {
                resultado += ' ' + convertirGrupo(milesResto) + ' mil';
            }
        }
        
        if (resto > 0) {
            resultado += ' ' + convertirGrupo(resto);
        }
        
        return resultado;
    }
    
    let letras = convertirNumero(entero);
    if (entero === 1) {
        return `un peso ${centavos.toString().padStart(2, '0')}/100 M.N.`;
    } else {
        return `${letras} pesos ${centavos.toString().padStart(2, '0')}/100 M.N.`;
    }
}

// Template HTML para el PDF - VERSIÓN CON HEADER/FOOTER COMPLETOS
function generarHTMLCotizacion(datos) {
    const tieneImagenes = datos.productos.some(p => p.imagen && p.imagen.trim() !== "");

    return `
    <!DOCTYPE html>
    <html lang="es">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cotización - ${datos.cotizacion.empresa}</title>
        <style>
            body {
                margin: 0;
                padding: 0;
                font-family: Arial, sans-serif;
                font-size: 12px;
                line-height: 1.4;
                color: #333;
            }
            
            /* Contenedor principal con márgenes para header/footer */
            .content {
                margin: 20px;
                padding-top: 10px;
            }
            
            .info-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
                border: 1px solid #ccc;
                border-left: none;
                border-right: none;
            }
            
            .info-table td {
                border-top: 1px solid #ccc;
                border-bottom: 1px solid #ccc;
                border-left: none;
                border-right: none;
                padding: 6px 8px;
            }
            
            .info-table .label {
                background-color: #e7edc1;
                font-weight: bold;
                width: 200px;
            }
            
            .products-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 30px;
                margin-top: 15px;
            }
            
            .products-table th {
                background-color: #34495e;
                color: white;
                padding: 8px;
                text-align: left;
                font-weight: bold;
                border: 1px solid #2c3e50;
            }
            
            .products-table td {
                padding: 6px 8px;
                border: 1px solid #ddd;
                vertical-align: top;
            }
            
            .products-table img {
                max-width: 80px;
                max-height: 80px;
                display: block;
                margin: auto;
                object-fit: contain;
            }
            
            .totals-section {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 20px;
            }
            
            .totals-box {
                width: 300px;
                border: 2px solid #FF8C00;
                border-radius: 5px;
                overflow: hidden;
            }
            
            .totals-row {
                display: flex;
                justify-content: space-between;
                padding: 6px 12px;
                border-bottom: 1px solid #ddd;
            }
            
            .totals-row:last-child {
                border-bottom: none;
                background-color: #FF8C00;
                color: white;
                font-weight: bold;
                font-size: 14px;
            }
            
            .totals-row.subtotal {
                background-color: #f8f9fa;
                font-weight: bold;
            }
            
            .total-letters {
                background-color: #fff3cd;
                border: 2px solid #ffeaa7;
                border-radius: 5px;
                padding: 10px;
                text-align: center;
                margin-bottom: 20px;
                font-weight: bold;
                font-size: 13px;
                color: #856404;
            }
            
            /* Control de saltos de página */
            .terms-signature-container {
                page-break-inside: avoid;
                margin-top: 30px;
                margin-bottom: 20px;
            }
            
            .terms {
                font-size: 11px;
                line-height: 1.5;
                color: #666;
                margin-bottom: 20px;
                padding: 10px;
                background-color: #f8f9fa;
                border-radius: 5px;
                page-break-inside: avoid;
            }
            
            .signature {
                margin-top: 20px;
                margin-bottom: 30px;
                page-break-inside: avoid;
            }
            
            .signature p {
                margin: 5px 0;
            }
            
            .signature .name {
                font-weight: bold;
                font-size: 14px;
                color: #2c3e50;
            }
            
            .signature .title {
                color: #666;
                font-style: italic;
            }
            
            /* Evitar división de elementos importantes */
            .totals-section, .total-letters {
                page-break-inside: avoid;
            }
        </style>
    </head>
    <body>
        <div class="content">
            <table class="info-table">
                <tr><td class="label" style="width:15%;">Fecha:</td><td>${formatearFechaEspanol(datos.cotizacion.fecha) || ''}</td></tr>
                <tr><td class="label">Empresa:</td><td>${datos.cotizacion.empresa || ''}</td></tr>
                <tr><td class="label">Contacto:</td><td>${datos.cotizacion.nombre_contacto || ''}</td></tr>
                <tr><td class="label">Teléfono:</td><td>${datos.cotizacion.telefono || ''} &nbsp;&nbsp;&nbsp; <strong> email: </strong> ${datos.cotizacion.email || ''}</td></tr>
                <tr><td class="label">Proyecto o servicio:</td><td>${datos.cotizacion.proyecto_servicio || ''}</td></tr>
            </table>

            <table class="products-table">
                <thead>
                    <tr>
                        <th>Unidades</th>
                        <th>Concepto</th>
                        ${tieneImagenes ? `<th>Imagen</th>` : ""}
                        <th>Precio unitario</th>
                        <th>Subtotal sin IVA</th>
                    </tr>
                </thead>
                <tbody>
                    ${datos.productos.map(p => {
                        const subtotalProducto = (p.unidades * p.precio_unitario).toFixed(2);
                        const imagenHTML = p.imagen ? `<img src="${getImagenBase64(p.imagen)}" alt="Imagen del producto">` : "";
                        return `
                        <tr>
                            <td>${p.unidades}</td>
                            <td><strong>${p.nombre_producto}</strong><br>${p.concepto || ""}</td>
                            ${tieneImagenes ? `<td>${imagenHTML}</td>` : ""}
                            <td>$${parseFloat(p.precio_unitario).toFixed(2)}</td>
                            <td>$${subtotalProducto}</td>
                        </tr>`;
                    }).join("")}
                </tbody>
            </table>

            <div class="totals-section">
                <div class="totals-box">
                    <div class="totals-row subtotal"><span>TOTAL sin IVA</span><span>$${datos.subtotal}</span></div>
                    <div class="totals-row"><span>IVA</span><span>$${datos.iva}</span></div>
                    <div class="totals-row"><span>TOTAL</span><span>$${datos.total}</span></div>
                </div>
            </div>

            <div class="total-letters">
                ***(${datos.totalEnLetras.charAt(0).toUpperCase() + datos.totalEnLetras.slice(1)})***
            </div>

            <div class="terms-signature-container">
                <div class="terms">
                    <p><strong>Términos y Condiciones:</strong></p>
                    <p>El tiempo de entrega es de 2 días hábiles contados a partir de la autorización correspondiente y de la recepción del anticipo correspondiente.</p>
                    <p>La forma de pago es 50% de anticipo y 50% contra entrega del material terminado.</p>
                </div>

                <div class="signature">
                    <p>C o r d i a l m e n t e .</p>
                    <br><br>
                    <p class="name">Alejandro Galindo M.</p>
                    <p class="title">Gerente de Proyectos</p>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

// IPC Handler con header y footer nativos de Puppeteer
ipcMain.handle('generar-pdf-puppeteer', async (event, id_cotizacion) => {
    let browser = null;
    
    try {
        console.log('Iniciando generación de PDF para cotización:', id_cotizacion);
        browser = await launchPuppeteer();

        // Obtener datos completos
        const datos = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM Cotizaciones WHERE id_cotizacion = ?`, [id_cotizacion], (err, cotizacion) => {
                if (err) reject(err);
                else {
                    db.all(`SELECT * FROM Productos WHERE id_cotizacion = ? ORDER BY concepto`, [id_cotizacion], (err, productos) => {
                        if (err) reject(err);
                        else {
                            let subtotal = 0;
                            productos.forEach(p => subtotal += (p.unidades * p.precio_unitario));
                            const iva = subtotal * 0.16;
                            const total = subtotal + iva;
                            
                            resolve({
                                cotizacion,
                                productos,
                                subtotal: subtotal.toFixed(2),
                                iva: iva.toFixed(2),
                                total: total.toFixed(2),
                                totalEnLetras: numeroALetras(total)
                            });
                        }
                    });
                }
            });
        });

        // Generar HTML
        const htmlContent = generarHTMLCotizacion(datos);
        
        // Iniciar Puppeteer
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        
        const page = await browser.newPage();
        
        // Configurar contenido HTML
        await page.setContent(htmlContent, {
            waitUntil: 'networkidle0'
        });

        // HEADER TEMPLATE 
        const headerTemplate = `
            <div style="
                width: 100%;
                height: 80px;
                margin: 0;
                padding: 0;
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                display: flex;
                border-bottom: 2px solid white;
                font-family: Arial, sans-serif;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
                box-sizing: border-box;
            ">
                <div style="
                    background-color: #c4ce7f !important;
                    background: #c4ce7f !important;
                    flex: 2;
                    padding: 15px;
                    display: flex;
                    align-items: center;
                    -webkit-print-color-adjust: exact;
                    color-adjust: exact;
                    box-sizing: border-box;
                ">
                    <h1 style="
                        color: rgba(255, 255, 255, 0.3) !important;
                        font-size: 40px;
                        margin: 0;
                        font-weight: normal;
                    ">cotización</h1>
                </div>
                <div style="
                    background-color: white !important;
                    background: white !important;
                    flex: 1;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 5px;
                    -webkit-print-color-adjust: exact;
                    color-adjust: exact;
                    box-sizing: border-box;
                ">
                    <img src="${getLogoBase64("assets/logo.png")}" alt="Logo" style="max-width: 120px; height: auto;">
                </div>
            </div>
        `;

        // FOOTER TEMPLATE 
        const footerTemplate = `
            <div style="
                width: 100%;
                background-color: #1f3a78 !important;
                background: #1f3a78 !important;
                color: white !important;
                text-align: center;
                padding: 12px 8px;
                font-size: 12px;
                font-family: Arial, sans-serif;
                margin: 0;
                position: absolute;
                bottom: 0;
                left: 0;
                right: 0;
                border-top: 3px solid #1f3a78;
                -webkit-print-color-adjust: exact;
                color-adjust: exact;
                box-sizing: border-box;
            ">
                <p style="
                    margin: 0;
                    color: white !important;
                    line-height: 1.3;
                ">
                    NORTE 19 No. 3470, COL. GERTRUDIS SÁNCHEZ 2A. SECCIÓN C.P. 07839, DEL. GUSTAVO A. MADERO, CDMX  
                    <span style="font-weight: bold; color: white !important;">TELS: 9180 3871 • 5590 9935</span>  
                    <a href="http://www.laligacomunicacion.com" target="_blank" style="color: #a8c4ff !important; text-decoration: none;">www.laligacomunicacion.com</a>
                </p>
            </div>
        `;

        // Configurar opciones del PDF
        const pdfOptions = {
            format: 'A4',
            printBackground: true,
            preferCSSPageSize: false,
            margin: {
                top: '80px',    
                right: '0mm',    
                bottom: '70px',   
                left: '0mm'      
            },
            displayHeaderFooter: true,
            headerTemplate: headerTemplate,
            footerTemplate: footerTemplate
        };

        // Generar PDF
        const pdfBuffer = await page.pdf(pdfOptions);

        // Crear directorio temporal si no existe
        const tempDir = path.join(__dirname, 'temp_pdfs');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // Guardar archivo temporal con nombre único
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const fileName = `cotizacion_${datos.cotizacion.empresa}_${timestamp}_${randomId}.pdf`;
        const filePath = path.join(tempDir, fileName);
        
        fs.writeFileSync(filePath, pdfBuffer);

        console.log('PDF temporal generado:', filePath);

        return { 
            success: true, 
            filePath, 
            fileName,
            datos: datos.cotizacion
        };

    } catch (error) {
        console.error('Error al generar PDF:', error);
        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
});

// IPC Handler para abrir PDF y eliminarlo después
ipcMain.handle('abrir-pdf', async (event, filePath) => {
    try {
        const { shell } = require('electron');
        
        // Abrir el archivo
        await shell.openPath(filePath);
        
        // Programar eliminación después de un breve delay
        // Esto da tiempo a que el sistema operativo abra el archivo
        setTimeout(() => {
            try {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log('Archivo temporal eliminado:', filePath);
                }
            } catch (deleteError) {
                console.warn('No se pudo eliminar el archivo temporal:', deleteError.message);
            }
        }, 3000); // 3 segundos de delay
        
        return { success: true };
    } catch (error) {
        console.error('Error al abrir PDF:', error);
        throw error;
    }
});

// Función para obtener la ruta correcta de Chromium
function getChromiumExecutablePath() {
  if (app.isPackaged) {
    // Buscar en diferentes ubicaciones posibles
    const possiblePaths = [
      // Ruta en app.asar.unpacked
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'puppeteer', '.local-chromium'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', '@puppeteer', 'browsers'),
      // Ruta en extraResources
      path.join(process.resourcesPath, '.local-chromium'),
      path.join(process.resourcesPath, 'browsers'),
    ];
    
    for (const basePath of possiblePaths) {
      if (fs.existsSync(basePath)) {
        // Buscar el ejecutable dentro de la carpeta
        try {
          const chromiumDirs = fs.readdirSync(basePath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
          
          for (const dir of chromiumDirs) {
            let executablePath;
            if (process.platform === 'win32') {
              executablePath = path.join(basePath, dir, 'chrome.exe');
            } else if (process.platform === 'darwin') {
              executablePath = path.join(basePath, dir, 'Chromium.app', 'Contents', 'MacOS', 'Chromium');
            } else {
              executablePath = path.join(basePath, dir, 'chrome');
            }
            
            if (fs.existsSync(executablePath)) {
              console.log('Chromium encontrado en:', executablePath);
              return executablePath;
            }
          }
        } catch (error) {
          console.log('Error leyendo directorio:', basePath, error.message);
        }
      }
    }
    
    // Si no encuentra Chromium empaquetado, usar Chrome del sistema
    console.log('No se encontró Chromium empaquetado, usando Chrome del sistema');
    return getSystemChromePath();
  } else {
    // En desarrollo, usar el path normal
    try {
      return puppeteer.executablePath();
    } catch (error) {
      console.log('Error obteniendo executablePath, usando Chrome del sistema');
      return getSystemChromePath();
    }
  }
}

// Función para obtener Chrome del sistema
function getSystemChromePath() {
  const chromePaths = {
    win32: [
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
      path.join(process.env.LOCALAPPDATA, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env.PROGRAMFILES, 'Google\\Chrome\\Application\\chrome.exe'),
      path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe')
    ],
    darwin: [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    ],
    linux: [
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium-browser',
      '/snap/bin/chromium'
    ]
  };
  
  const platformPaths = chromePaths[process.platform] || chromePaths.linux;
  
  for (const chromePath of platformPaths) {
    if (chromePath && fs.existsSync(chromePath)) {
      console.log('Chrome del sistema encontrado en:', chromePath);
      return chromePath;
    }
  }
  
  console.error('No se pudo encontrar Chrome en el sistema');
  return null;
}

// Función para lanzar Puppeteer
async function launchPuppeteer() {
  const executablePath = getChromiumExecutablePath();
  
  const launchOptions = {
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--no-first-run',
      '--no-zygote',
      '--single-process',
      '--disable-gpu'
    ]
  };
  
  if (executablePath) {
    launchOptions.executablePath = executablePath;
  }
  
  try {
    console.log('Lanzando Puppeteer con opciones:', launchOptions);
    return await puppeteer.launch(launchOptions);
  } catch (error) {
    console.error('Error al lanzar Puppeteer:', error);
    throw error;
  }
}

// Función opcional para limpiar archivos temporales antiguos al inicio
const limpiarArchivosTemporales = () => {
    const tempDir = path.join(__dirname, 'temp_pdfs');
    
    if (fs.existsSync(tempDir)) {
        try {
            const files = fs.readdirSync(tempDir);
            const now = Date.now();
            const maxAge = 24 * 60 * 60 * 1000; // 24 horas en millisegundos
            
            files.forEach(file => {
                const filePath = path.join(tempDir, file);
                const stats = fs.statSync(filePath);
                
                if (now - stats.mtime.getTime() > maxAge) {
                    fs.unlinkSync(filePath);
                    console.log('Archivo temporal antiguo eliminado:', file);
                }
            });
        } catch (error) {
            console.warn('Error al limpiar archivos temporales:', error.message);
        }
    }
};


