const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================================
// 1. CONFIGURACIÓN DEL SERVIDOR
// ==========================================================================
app.use(cors());
app.use(express.json()); // Permite recibir datos en formato JSON
app.use(express.static(path.join(__dirname, 'public'))); // Sirve tu HTML/CSS/JS

// ==========================================================================
// 2. CREACIÓN Y CONEXIÓN A LA BASE DE DATOS SQLITE
// ==========================================================================
// Esto crea automáticamente el archivo "studyco.db" en la carpeta de tu proyecto
const db = new sqlite3.Database('./studyco.db', (err) => {
    if (err) {
        console.error('❌ Error al crear/conectar la base de datos:', err.message);
    } else {
        console.log('✅ Base de datos SQLite conectada y lista.');
    }
});

// Crear las tablas si no existen
db.serialize(() => {
    // Tabla de Usuarios (Guardará también preferencias y eventos como texto JSON)
    db.run(`CREATE TABLE IF NOT EXISTS usuarios (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nombre TEXT NOT NULL,
        apellidos TEXT NOT NULL,
        correo TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        rol TEXT DEFAULT 'estudiante',
        preferencias TEXT DEFAULT '{}',
        eventos TEXT DEFAULT '{}'
    )`);

    // Tabla de Historial del Administrador (Mensajes y Alertas)
    db.run(`CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tipo TEXT NOT NULL,
        texto TEXT NOT NULL,
        fecha DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);
});

// ==========================================================================
// 3. RUTAS DE LA API (Endpoints)
// ==========================================================================

// --- REGISTRO DE USUARIO ---
app.post('/api/auth/registro', (req, res) => {
    const { nombre, apellidos, correo, password } = req.body;
    const rol = correo === 'admin@studyco.com' ? 'admin' : 'estudiante';

    // Encriptar contraseña
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: 'Error interno al procesar la contraseña' });

        const query = `INSERT INTO usuarios (nombre, apellidos, correo, password, rol, preferencias, eventos) 
                       VALUES (?, ?, ?, ?, ?, '{}', '{}')`;
        
        db.run(query, [nombre, apellidos, correo, hash, rol], function(err) {
            if (err) {
                if (err.message.includes('UNIQUE constraint failed')) {
                    return res.status(400).json({ error: 'El correo ya está registrado' });
                }
                return res.status(500).json({ error: 'Error al registrar en la base de datos' });
            }
            res.status(201).json({ mensaje: 'Usuario registrado con éxito', usuarioId: this.lastID });
        });
    });
});

// --- INICIO DE SESIÓN ---
app.post('/api/auth/login', (req, res) => {
    const { correo, password } = req.body;

    db.get(`SELECT * FROM usuarios WHERE correo = ?`, [correo], (err, usuario) => {
        if (err) return res.status(500).json({ error: 'Error en la base de datos' });
        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        // Comparar la contraseña escrita con la encriptada
        bcrypt.compare(password, usuario.password, (err, esValida) => {
            if (!esValida) return res.status(401).json({ error: 'Contraseña incorrecta' });

            // Devolver los datos del usuario (convirtiendo los textos JSON a objetos)
            res.json({
                mensaje: 'Login exitoso',
                usuario: {
                    id: usuario.id,
                    nombre: usuario.nombre,
                    correo: usuario.correo,
                    rol: usuario.rol,
                    preferencias: JSON.parse(usuario.preferencias),
                    eventos: JSON.parse(usuario.eventos)
                }
            });
        });
    });
});

// --- GUARDAR EVENTOS O PREFERENCIAS DEL USUARIO ---
app.put('/api/usuarios/:id', (req, res) => {
    const { preferencias, eventos } = req.body;
    const id = req.params.id;

    // Primero obtenemos los datos actuales para no sobrescribir nada con valores vacíos
    db.get(`SELECT preferencias, eventos FROM usuarios WHERE id = ?`, [id], (err, usuario) => {
        if (err || !usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        const nuevasPreferencias = preferencias ? JSON.stringify(preferencias) : usuario.preferencias;
        const nuevosEventos = eventos ? JSON.stringify(eventos) : usuario.eventos;

        db.run(`UPDATE usuarios SET preferencias = ?, eventos = ? WHERE id = ?`,
            [nuevasPreferencias, nuevosEventos, id], 
            function(err) {
                if (err) return res.status(500).json({ error: 'Error al guardar los datos' });
                res.json({ mensaje: 'Datos actualizados correctamente' });
            }
        );
    });
});

// --- GUARDAR MENSAJES Y ALERTAS DE ADMINISTRADOR ---
app.post('/api/admin/logs', (req, res) => {
    const { tipo, texto } = req.body;

    db.run(`INSERT INTO admin_logs (tipo, texto) VALUES (?, ?)`, [tipo, texto], function(err) {
        if (err) return res.status(500).json({ error: 'Error al guardar en el panel de admin' });
        res.status(201).json({ mensaje: 'Publicado correctamente', id: this.lastID });
    });
});

// --- OBTENER MENSAJES Y ALERTAS ---
app.get('/api/admin/logs', (req, res) => {
    db.all(`SELECT * FROM admin_logs ORDER BY fecha DESC`, [], (err, filas) => {
        if (err) return res.status(500).json({ error: 'Error al obtener el historial' });
        res.json(filas);
    });
});

// ==========================================================================
// 4. RUTA POR DEFECTO PARA EL FRONTEND
// ==========================================================================
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Arrancar servidor
app.listen(PORT, () => {
    console.log(`🚀 Servidor backend funcionando en el puerto ${PORT}`);
});