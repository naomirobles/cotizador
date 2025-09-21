const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const os = require('os');
//SQLITE 
const sqlite3 = require('sqlite3').verbose();
// PUPPETEER PARA GENERAR PDF
const puppeteer = require('puppeteer-core');


// =============== CLASE FILEMANAGER ===============
class FileManager {
  constructor() {
    // Definir directorios según si está empaquetado o no
    this.appDataPath = app.getPath('userData');
    this.documentsPath = app.getPath('documents');
    this.tempPath = app.getPath('temp');
    
    // Crear carpetas necesarias
    this.initDirectories();
  }

  initDirectories() {
    // Crear carpeta para PDFs en Documentos
    this.pdfDir = path.join(this.documentsPath, 'Cotizador', 'PDFs');
    
    // Crear carpeta para imágenes en AppData (persistent)
    this.imagesDir = path.join(this.appDataPath, 'images');
    
    // Crear carpeta temporal para PDFs
    this.tempPdfDir = path.join(this.appDataPath, 'temp_pdfs');

    // Crear directorios si no existen
    [this.pdfDir, this.imagesDir, this.tempPdfDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log('Directorio creado:', dir);
      }
    });
  }

  // Copiar imagen seleccionada a carpeta de trabajo
  async copyImageToWorkspace(originalPath) {
    try {
      if (!fs.existsSync(originalPath)) {
        throw new Error(`Archivo no encontrado: ${originalPath}`);
      }

      const fileName = path.basename(originalPath);
      const timestamp = Date.now();
      const newFileName = `${timestamp}_${fileName}`;
      const destinationPath = path.join(this.imagesDir, newFileName);

      // Copiar archivo
      fs.copyFileSync(originalPath, destinationPath);
      console.log('Imagen copiada a:', destinationPath);

      return newFileName; // Retornar solo el nombre del archivo
    } catch (error) {
      console.error('Error copiando imagen:', error);
      throw error;
    }
  }

  // Obtener ruta completa de imagen
  getImagePath(fileName) {
    if (!fileName) return null;
    return path.join(this.imagesDir, fileName);
  }

  // Verificar si imagen existe
  imageExists(fileName) {
    if (!fileName) return false;
    const imagePath = path.join(this.imagesDir, fileName);
    return fs.existsSync(imagePath);
  }

  // Generar ruta para PDF temporal
  generateTempPdfPath(fileName) {
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substr(2, 9);
    const pdfFileName = `${fileName}_${timestamp}_${randomId}.pdf`;
    return path.join(this.tempPdfDir, pdfFileName);
  }

  // Generar ruta para PDF permanente
  generatePermanentPdfPath(fileName) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const pdfFileName = `${fileName}_${timestamp}.pdf`;
    return path.join(this.pdfDir, pdfFileName);
  }

  // Obtener imagen como base64
  getImageAsBase64(fileName) {
    try {
      if (!fileName) return null;
      
      const imagePath = path.join(this.imagesDir, fileName);
      
      if (!fs.existsSync(imagePath)) {
        console.warn('Imagen no encontrada:', imagePath);
        return null;
      }

      const imageBuffer = fs.readFileSync(imagePath);
      const ext = path.extname(fileName).toLowerCase().substring(1);
      const mimeType = this.getMimeType(ext);
      
      return `data:${mimeType};base64,${imageBuffer.toString('base64')}`;
    } catch (error) {
      console.error('Error convirtiendo imagen a base64:', error);
      return null;
    }
  }

  // Obtener tipo MIME de la imagen
  getMimeType(extension) {
    const mimeTypes = {
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'bmp': 'image/bmp',
      'webp': 'image/webp'
    };
    return mimeTypes[extension] || 'image/jpeg';
  }

  // Limpiar archivos temporales antiguos
  cleanOldFiles(daysOld = 7) {
    const directories = [this.tempPdfDir];
    const cutoffDate = Date.now() - (daysOld * 24 * 60 * 60 * 1000);

    directories.forEach(dir => {
      try {
        if (!fs.existsSync(dir)) return;
        
        const files = fs.readdirSync(dir);
        files.forEach(file => {
          const filePath = path.join(dir, file);
          const stats = fs.statSync(filePath);
          
          if (stats.mtime.getTime() < cutoffDate) {
            fs.unlinkSync(filePath);
            console.log('Archivo temporal eliminado:', filePath);
          }
        });
      } catch (error) {
        console.error('Error limpiando archivos:', error);
      }
    });
  }
}

// =============== VARIABLES GLOBALES ===============
let mainWindow;
let fileManager;
const db = new sqlite3.Database('cotizaciones_productos.db');

// =============== INICIALIZACIÓN ===============
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
      proyecto_servicio TEXT NOT NULL,
      terminos_condiciones TEXT DEFAULT ('El tiempo de entrega es de 2 días hábiles contados a partir de la autorización correspondiente y de la recepción del anticipo correspondiente.
                La forma de pago es 50% de anticipo y 50% contra entrega del material terminado')
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

app.whenReady().then(() => {
  // Inicializar gestor de archivos
  fileManager = new FileManager();
  
  // Limpiar archivos antiguos al iniciar
  fileManager.cleanOldFiles(7);
  
  // Crear ventana
  createWindow();
});

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

// =============== IPC HANDLERS PARA BASE DE DATOS ===============

ipcMain.handle('copiar-cotizacion', async (event, id_cotizacion) => {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // 1. Obtener cotización original
      db.get(`SELECT * FROM Cotizaciones WHERE id_cotizacion = ?`, [id_cotizacion], (err, cotizacion) => {
        if (err) return reject(err);
        if (!cotizacion) return reject(new Error("Cotización no encontrada"));

        // 2. Insertar nueva cotización duplicada
        const stmt = db.prepare(`
          INSERT INTO Cotizaciones (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `);

        const nuevaFecha = new Date().toISOString().split("T")[0]; // fecha actual
        stmt.run([
          cotizacion.empresa,
          nuevaFecha,
          cotizacion.nombre_contacto,
          cotizacion.telefono,
          cotizacion.email,
          cotizacion.proyecto_servicio + " (Copia)",
          cotizacion.terminos_condiciones
        ], function (err) {
          if (err) return reject(err);

          const nuevoId = this.lastID;

          // 3. Copiar productos relacionados
          db.all(`SELECT * FROM Productos WHERE id_cotizacion = ?`, [id_cotizacion], (err, productos) => {
            if (err) return reject(err);

            const prodStmt = db.prepare(`
              INSERT INTO Productos (id_cotizacion, nombre_producto, precio_unitario, concepto, unidades, imagen)
              VALUES (?, ?, ?, ?, ?, ?)
            `);

            productos.forEach(p => {
              prodStmt.run([nuevoId, p.nombre_producto, p.precio_unitario, p.concepto, p.unidades, p.imagen]);
            });

            prodStmt.finalize(() => {
              resolve({ success: true, nuevoId });
            });
          });
        });

        stmt.finalize();
      });
    });
  });
});

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

ipcMain.handle('agregar-cotizacion', (event, empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones = null) => {
  return new Promise((resolve, reject) => {
    // Si terminos_condiciones es null, la base de datos usará el valor DEFAULT
    // Si tiene un valor, se usará ese valor
    const params = terminos_condiciones !== null ? 
      [empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones] :
      [empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio];
    
    const sql = terminos_condiciones !== null ?
      `INSERT INTO Cotizaciones (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones) VALUES (?, ?, ?, ?, ?, ?, ?)` :
      `INSERT INTO Cotizaciones (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) VALUES (?, ?, ?, ?, ?, ?)`;
    
    db.run(sql, params, function(err) {
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

ipcMain.handle('actualizar-cotizacion', (event, empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones, id_cotizacion) => {
  return new Promise((resolve, reject) => {
    db.run(`UPDATE Cotizaciones SET empresa = ?, fecha = ?, nombre_contacto = ?, telefono = ?, email = ?, proyecto_servicio = ?, terminos_condiciones = ? WHERE id_cotizacion = ?`, 
    [empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio, terminos_condiciones, id_cotizacion], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});

// =============== IPC HANDLERS PARA PRODUCTOS ===============
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

// =============== IPC HANDLERS PARA IMÁGENES (MEJORADOS) ===============
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
      
      console.log('Archivo seleccionado:', filePath);

      // Verificar que el archivo origen existe
      if (!fs.existsSync(filePath)) {
        throw new Error('El archivo seleccionado no existe');
      }

      // Copiar archivo al directorio de imágenes usando FileManager
      try {
        const fileName = await fileManager.copyImageToWorkspace(filePath);
        console.log('Imagen copiada exitosamente:', fileName);
        return { success: true, fileName: fileName };
      } catch (copyError) {
        console.error('Error al copiar imagen:', copyError);
        throw new Error('Error al copiar la imagen: ' + copyError.message);
      }
    }

    console.log('No se seleccionó ninguna imagen');
    return { success: false, fileName: null };
  } catch (error) {
    console.error('Error en select-image:', error);
    return { success: false, error: error.message };
  }
});

// Obtener ruta completa de imagen 
ipcMain.handle('get-image-path', (event, fileName) => {
  const imagePath = fileManager.getImagePath(fileName);
  console.log('Ruta de imagen solicitada:', imagePath);
  return imagePath;
});

// Verificar si imagen existe 
ipcMain.handle('image-exists', (event, fileName) => {
  const exists = fileManager.imageExists(fileName);
  console.log('Verificando si existe:', fileName, 'Resultado:', exists);
  return exists;
});

// NUEVO: Obtener imagen como base64
ipcMain.handle('get-image-base64', (event, fileName) => {
  try {
    const base64 = fileManager.getImageAsBase64(fileName);
    return { success: true, base64 };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// =============== IPC HANDLERS PARA PDF (MEJORADOS) ===============
ipcMain.handle('generar-pdf-puppeteer', async (event, id_cotizacion) => {
    let browser = null;
    
    try {
        const puppeteer = require('puppeteer-core');
        console.log('Iniciando generación de PDF para cotización:', id_cotizacion);

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
        const browser = await puppeteer.launch({
            executablePath: getChromiumPath(),
            headless: true,
            args: [
              '--no-sandbox', 
              '--disable-setuid-sandbox',
              '--disable-dev-shm-usage',
              '--disable-gpu',
              '--disable-extensions',
              '--no-first-run'
            ]
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

        // Guardar archivo temporal con nombre único usando FileManager
        const fileName = `cotizacion_${datos.cotizacion.empresa}`;
        const filePath = fileManager.generateTempPdfPath(fileName);
        
        fs.writeFileSync(filePath, pdfBuffer);

        console.log('PDF temporal generado:', filePath);

        return { 
            success: true, 
            filePath, 
            fileName: path.basename(filePath),
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

ipcMain.handle('generar-pdf-electron', async (event, id_cotizacion) => {
    let pdfWindow = null;
    let tempHtmlPath = null;
    
    try {
        console.log('=== INICIO GENERACIÓN PDF ELECTRON ===');
        console.log('ID Cotización:', id_cotizacion);
        
        // Obtener datos completos
        console.log('Obteniendo datos de BD...');
        const datos = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('Timeout en consulta BD')), 10000);
            
            db.get(`SELECT * FROM Cotizaciones WHERE id_cotizacion = ?`, [id_cotizacion], (err, cotizacion) => {
                if (err) {
                    clearTimeout(timeout);
                    reject(err);
                } else {
                    db.all(`SELECT * FROM Productos WHERE id_cotizacion = ? ORDER BY concepto`, [id_cotizacion], (err, productos) => {
                        clearTimeout(timeout);
                        if (err) {
                            reject(err);
                        } else {
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

        console.log('Datos obtenidos:', datos.cotizacion.empresa);

        // Generar solo el contenido del body (sin HTML/HEAD/BODY)
        console.log('Generando contenido HTML...');
        // Crear HTML completo con header y footer - VERSIÓN CORREGIDA
        const fullHtmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Cotización</title>
            <style>
                @page {
                    margin: 0;
                    size: A4;
                }
                
                body {
                    font-family: Arial, sans-serif;
                    margin: 0;
                    padding: 0;
                    position: relative;
                    width: 100%;
                    height: 100%;
                }
                
                .header {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 80px;
                    display: flex;
                    align-items: center;
                    z-index: 1000;
                    border-bottom: 2px solid white;
                    background: white;
                }
                
                .header-left {
                    flex: 2;
                    background-color: #c4ce7f;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    padding: 15px;
                    box-sizing: border-box;
                }
                
                .header-left h1 {
                    color: rgba(255, 255, 255, 0.3);
                    font-size: 40px;
                    margin: 0;
                    font-weight: normal;
                }
                
                .header-right {
                    flex: 1;
                    background-color: white;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 5px;
                    box-sizing: border-box;
                }
                
                .header-right img {
                    max-width: 120px;
                    height: auto;
                }
                
                .content {
                    margin: 100px 20px 90px 20px; /* Top, Right, Bottom, Left */
                    padding-top: 10px;
                    min-height: calc(100vh - 190px);
                }
                
                .footer {
                    position: fixed;
                    bottom: 0;
                    left: 0;
                    right: 0;
                    background-color: #1f3a78;
                    color: white;
                    text-align: center;
                    padding: 12px 8px;
                    font-size: 12px;
                    border-top: 3px solid #1f3a78;
                    height: 60px;
                    box-sizing: border-box;
                }
                
                .footer p {
                    margin: 0;
                    color: white;
                    line-height: 1.3;
                }
                
                .footer a {
                    color: #a8c4ff;
                    text-decoration: none;
                }

                /* ESTILOS DEL CONTENIDO (los mismos que antes) */
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
                
                /* Forzar impresión de colores */
                * {
                    -webkit-print-color-adjust: exact !important;
                    color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-left">
                    <h1>cotización</h1>
                </div>
                <div class="header-right">
                    <img src="${getLogoBase64("assets/logo.png")}" alt="Logo">
                </div>
            </div>
            
            <div class="content">
                ${generarBodyContentCotizacion(datos)}
            </div>
            
            <div class="footer">
                <p>
                    NORTE 19 No. 3470, COL. GERTRUDIS SÁNCHEZ 2A. SECCIÓN C.P. 07839, DEL. GUSTAVO A. MADERO, CDMX  
                    <span style="font-weight: bold; color: white;">TELS: 9180 3871 • 5590 9935</span>  
                    <a href="http://www.laligacomunicacion.com">www.laligacomunicacion.com</a>
                </p>
            </div>
        </body>
        </html>
        `;

        // Guardar HTML en archivo temporal
        tempHtmlPath = path.join(os.tmpdir(), `cotizacion_${Date.now()}.html`);
        fs.writeFileSync(tempHtmlPath, fullHtmlContent, 'utf8');
        console.log('HTML temporal creado:', tempHtmlPath);
        
        // Crear ventana invisible
        console.log('Creando ventana PDF...');
        pdfWindow = new BrowserWindow({
            width: 1024,
            height: 768,
            show: false,
            webPreferences: {
                nodeIntegration: false,
                contextIsolation: true,
                webSecurity: false
            }
        });

        // Cargar desde archivo temporal
        console.log('Cargando archivo HTML...');
        await pdfWindow.loadFile(tempHtmlPath);
        
        // Dar tiempo para renderizar
        console.log('Esperando renderizado...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        // Generar PDF - SIN MÁRGINES EXPLÍCITOS
        console.log('Generando PDF...');
        const pdfBuffer = await pdfWindow.webContents.printToPDF({
            pageSize: 'A4',
            printBackground: true,
            landscape: false
            // REMOVIDO: margins configuration
        });
        
        console.log('PDF generado, tamaño:', pdfBuffer.length, 'bytes');
        
        // Guardar PDF final
        const fileName = `cotizacion_${datos.cotizacion.empresa.replace(/[^a-zA-Z0-9]/g, '_')}`;
        const filePath = fileManager.generateTempPdfPath(fileName);
        
        fs.writeFileSync(filePath, pdfBuffer);
        console.log('PDF guardado en:', filePath);

        // Limpiar archivo temporal HTML
        if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
            fs.unlinkSync(tempHtmlPath);
        }

        console.log('=== PDF GENERADO EXITOSAMENTE ===');

        return { 
            success: true, 
            filePath, 
            fileName: path.basename(filePath),
            datos: datos.cotizacion
        };

    } catch (error) {
        console.error('=== ERROR EN PDF ELECTRON ===');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        
        // Limpiar archivo temporal en caso de error
        if (tempHtmlPath && fs.existsSync(tempHtmlPath)) {
            try {
                fs.unlinkSync(tempHtmlPath);
            } catch (cleanupError) {
                console.warn('No se pudo limpiar archivo temporal:', cleanupError);
            }
        }
        
        throw new Error(`Error PDF Electron: ${error.message}`);
        
    } finally {
        if (pdfWindow && !pdfWindow.isDestroyed()) {
            console.log('Cerrando ventana PDF...');
            pdfWindow.close();
        }
    }
});

// Función que solo genera el contenido del body
function generarBodyContentCotizacion(datos) {
    const tieneImagenes = datos.productos.some(p => p.imagen && p.imagen.trim() !== "");

    return `
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
                <p>${datos.cotizacion.terminos_condiciones}</p>
            </div>

            <div class="signature">
                <p>C o r d i a l m e n t e .</p>
                <br><br>
                <p class="name">Alejandro Galindo M.</p>
                <p class="title">Gerente de Proyectos</p>
            </div>
        </div>
    `;
}

// IPC Handler para abrir PDF y eliminarlo después (MEJORADO)
ipcMain.handle('abrir-pdf', async (event, filePath) => {
    try {
        // Abrir el archivo
        await shell.openPath(filePath);
        
        // Programar eliminación después de un breve delay
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
        return { success: false, error: error.message };
    }
});

// NUEVO: Abrir carpeta de PDFs ******
ipcMain.handle('open-pdf-folder', async () => {
    try {
        await shell.openPath(fileManager.pdfDir);
        return { success: true };
    } catch (error) {
        console.error('Error abriendo carpeta de PDFs:', error);
        return { success: false, error: error.message };
    }
});

// NUEVO: Guardar PDF permanentemente *******
ipcMain.handle('save-pdf-permanent', async (event, tempFilePath, customName) => {
    try {
        const fileName = customName || 'cotizacion';
        const permanentPath = fileManager.generatePermanentPdfPath(fileName);
        
        // Copiar archivo temporal a ubicación permanente
        fs.copyFileSync(tempFilePath, permanentPath);
        
        console.log('PDF guardado permanentemente en:', permanentPath);
        
        return { success: true, filePath: permanentPath };
    } catch (error) {
        console.error('Error guardando PDF permanente:', error);
        return { success: false, error: error.message };
    }
});

// =============== FUNCIONES DE PUPPETEER  =====================

function getChromiumPath() {
  if (app.isPackaged) {
    // En aplicación empaquetada, Forge copia a resources/node_modules/puppeteer/.local-chromium
    const resourcesPath = process.resourcesPath;
    
    // Posibles ubicaciones donde puede estar Chromium
    const possiblePaths = [
      path.join(resourcesPath, 'node_modules', 'puppeteer', '.local-chromium'),
      path.join(resourcesPath, '.local-chromium'),
      path.join(resourcesPath, 'chromium'),
      path.join(resourcesPath, 'app', 'node_modules', 'puppeteer', '.local-chromium')
    ];
    
    for (const basePath of possiblePaths) {
      try {
        if (fs.existsSync(basePath)) {
          console.log('Chromium encontrado en:', basePath);
          
          // Buscar recursivamente chrome.exe
          const findChrome = (dir) => {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const item of items) {
              const fullPath = path.join(dir, item.name);
              
              if (item.isDirectory()) {
                const found = findChrome(fullPath);
                if (found) return found;
              } else if (item.name === 'chrome.exe') {
                return fullPath;
              }
            }
            return null;
          };
          
          const chromePath = findChrome(basePath);
          if (chromePath) {
            console.log('Chrome ejecutable encontrado:', chromePath);
            return chromePath;
          }
        }
      } catch (error) {
        console.log('Error buscando en:', basePath, error.message);
      }
    }
    
    throw new Error('No se encontró Chromium en la aplicación empaquetada');
  } else {
    // En desarrollo
    const puppeteer = require('puppeteer');
    return puppeteer.executablePath();
  }
}

// =============== FUNCIONES DE UTILIDAD (SIN CAMBIOS) ===============
// Función para convertir fecha de '2025-08-12' a '12 de agosto de 2025'
function formatearFechaEspanol(fechaString) {
    // Verificar si la fecha tiene el formato correcto
    if (!fechaString || typeof fechaString !== 'string') {
        return 'Fecha inválida';
    }
    
    // Verificar formato YYYY-MM-DD
    const formatoRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!formatoRegex.test(fechaString)) {
        return 'Formato de fecha inválido';
    }
    
    try {
        // Crear objeto Date desde la cadena
        const fecha = new Date(fechaString + 'T00:00:00'); // Agregar tiempo para evitar problemas de zona horaria
        
        // Verificar si la fecha es válida
        if (isNaN(fecha.getTime())) {
            return 'Fecha inválida';
        }
        
        // Array con los nombres de los meses en español
        const meses = [
            'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
            'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
        ];
        
        // Obtener día, mes y año
        const dia = fecha.getDate();
        const mes = meses[fecha.getMonth()];
        const año = fecha.getFullYear();
        
        // Retornar fecha formateada
        return `${dia} de ${mes} de ${año}`;
        
    } catch (error) {
        return 'Error al procesar la fecha';
    }
}

function getImagenBase64(nombreArchivo) {
    try {
        const rutaImagen = fileManager.getImagePath(nombreArchivo); ;
        const data = fs.readFileSync(rutaImagen);
        const extension = path.extname(nombreArchivo).substring(1); // "png" o "jpg"
        return `data:image/${extension};base64,${data.toString('base64')}`;
    } catch (err) {
        console.error('Error leyendo la imagen:', err);
        return null;
    }
}

function getLogoBase64() {
    try {
        const rutaLogo = path.resolve(__dirname, 'assets', 'logo.png');
        console.log('Cargando logo desde:', rutaLogo);
        
        if (!fs.existsSync(rutaLogo)) {
            console.error('Logo no encontrado en:', rutaLogo);
            return null;
        }
        
        const data = fs.readFileSync(rutaLogo);
        return `data:image/png;base64,${data.toString('base64')}`;
    } catch (err) {
        console.error('Error cargando logo:', err);
        return null;
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

// Llamar la función de limpieza al iniciar la aplicación
limpiarArchivosTemporales();

// IPC handler para seleccionar archivo Excel y devolver { name, base64 }
ipcMain.handle('select-and-parse-excel', () => {
  try {
    const result = dialog.showOpenDialogSync({
      title: 'Seleccionar archivo Excel',
      properties: ['openFile'],
      filters: [
        { name: 'Excel/CSV', extensions: ['xlsx', 'xls', 'csv'] },
        { name: 'Todos',    extensions: ['*'] }
      ]
    });

    if (!result || result.length === 0) {
      return null; // usuario canceló
    }

    const filePath = result[0];
    const name = path.basename(filePath);

    // Leer archivo como Buffer de forma sincrónica
    const buffer = fs.readFileSync(filePath);

    // Parsear workbook usando SheetJS
    const wb = XLSX.read(buffer, { type: 'buffer' });

    // Convertir cada hoja a array-of-arrays (AOA)
    const sheetDataMap = {};
    wb.SheetNames.forEach(sheetName => {
      const sheet = wb.Sheets[sheetName];
      const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
      sheetDataMap[sheetName] = aoa;
    });

    // Devolver al renderer
    return { name, sheetNames: wb.SheetNames, sheetDataMap };

  } catch (err) {
    console.error('Error en select-and-parse-excel:', err);
    return { error: err.message || String(err) };
  }
});

let excelWindow = null;
let resolveSelection = null; // Para resolver la promesa cuando se seleccione una celda
ipcMain.handle('importar-datos-excel', async (event, sheetDataMap, currentSheetName) => {
  return new Promise((resolve, reject) => {
    try {
      // Cerrar ventana existente si hay una
      if (excelWindow && !excelWindow.isDestroyed()) {
        excelWindow.close();
        excelWindow = null;
      }

      excelWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
          preload: path.join(__dirname, 'preload.js'),
          contextIsolation: true,
          nodeIntegration: false
        },
        show: false // No mostrar hasta que esté listo
      });

      // Guardar el resolve para usarlo cuando se seleccione una celda
      resolveSelection = resolve;

      // Cargar el archivo HTML
      excelWindow.loadFile('src/excel-render.html');

      // Cuando la ventana esté lista, enviar los datos
      excelWindow.webContents.once('did-finish-load', () => {
        console.log('Ventana Excel cargada, enviando datos...');
        
        const sheetData = sheetDataMap[currentSheetName] || [];
        console.log('Enviando datos de hoja:', currentSheetName, 'Filas:', sheetData.length);
        
        excelWindow.webContents.send('load-sheet-data', {
          data: sheetData,
          sheetName: currentSheetName
        });
        
        // Mostrar la ventana después de cargar los datos
        excelWindow.show();
      });

      // Manejar cierre de ventana sin selección
      excelWindow.on('closed', () => {
        console.log('Ventana Excel cerrada');
        if (resolveSelection) {
          resolveSelection(null);
          resolveSelection = null;
        }
        excelWindow = null;
      });

      // Manejar errores de carga
      excelWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('Error al cargar ventana Excel:', errorCode, errorDescription);
        reject(new Error(`Error al cargar: ${errorDescription}`));
      });

    } catch (error) {
      console.error('Error en importar-datos-excel:', error);
      reject(error);
    }
  });
});

// También corrige el handler de selección de celda
ipcMain.on('cell-selected', (event, cellData) => {
  console.log('Celda seleccionada recibida:', cellData);
  
  if (resolveSelection) {
    resolveSelection(cellData);
    resolveSelection = null;
  }
  
  // Cerrar la ventana después de la selección
  if (excelWindow && !excelWindow.isDestroyed()) {
    excelWindow.close();
  }
});

// Función para convertir números a letras (pesos mexicanos)
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
                    <p>${datos.cotizacion.terminos_condiciones}.</p>
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