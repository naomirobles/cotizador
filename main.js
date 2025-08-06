const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('cotizaciones_productos.db');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,      // ✅ Desactivado por seguridad
      contextIsolation: true,     // ✅ Activado por seguridad
      preload: path.join(__dirname, 'preload.js')  // ✅ Archivo puente
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
    db.all(`SELECT * FROM COTIZACIONES ORDER BY fecha`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
});

ipcMain.handle('obtener-cotizacion-id', (event, id) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM COTIZACIONES ORDER BY fecha WHERE id = ?`, [id], function(err) {
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

ipcMain.handle('obtener-productos', (event, id) => {
  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM PRODUCTOS WHERE id = ? ORDER BY concepto`, [id], function(err) {
      if (err) reject(err);
      else resolve(this.changes);
    });
  });
});

ipcMain.handle('agregar-cotizacion', (event, empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) => {
  return new Promise((resolve, reject) => {
    db.run(`INSERT INTO Cotizaciones (empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio) VALUES (?, ?, ?, ?, ?, ?)`, [empresa, fecha, nombre_contacto, telefono, email, proyecto_servicio], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
});