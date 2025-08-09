const { app, BrowserWindow, ipcMain, dialog } = require('electron'); // ← AGREGAR dialog aquí
const path = require('path');
const fs = require('fs');
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

// Tabla productos 
ipcMain.handle('agregar-producto', (event, id_cotizacion, precio_unitario, concepto, unidades, imagen = null) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO Productos (id_cotizacion, precio_unitario, concepto, unidades, imagen) VALUES (?, ?, ?, ?, ?)`, 
    [id_cotizacion, precio_unitario, concepto, unidades, imagen], function(err) {
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

ipcMain.handle('eliminar-producto', (event, id) => {
  return new Promise((resolve, reject) => {
    db.run(`DELETE FROM Productos WHERE id_producto = ?`, [id], function(err) {
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