const { app, BrowserWindow, ipcMain, dialog } = require('electron'); // ← AGREGAR dialog aquí
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
//SQLITE UWU
const sqlite3 = require('sqlite3').verbose();

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
    icon: path.join(__dirname, 'assets/icon.png'),
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