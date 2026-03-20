const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================================================
// 1. CONFIGURACIÓN DEL SERVIDOR
// ==========================================================================
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ==========================================================================
// 2. CONEXIÓN A LA BASE DE DATOS POSTGRESQL (Render)
// ==========================================================================
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://dbstudyco_user:Vq9vifByVWuCIy5nhUYjLRONmturDQ2m@dpg-d6javl3uibrs73ahmipg-a.frankfurt-postgres.render.com/dbstudyco',
    ssl: { rejectUnauthorized: false }
});

// Verificar conexión y crear tablas
async function inicializarBD() {
    try {
        await pool.query('SELECT NOW()');
        console.log('✅ Base de datos PostgreSQL conectada y lista.');

        // Crear las tablas si no existen
        await pool.query(`
            CREATE TABLE IF NOT EXISTS usuarios (
                id SERIAL PRIMARY KEY,
                nombre TEXT NOT NULL,
                apellidos TEXT NOT NULL,
                correo TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                rol TEXT DEFAULT 'estudiante',
                preferencias JSONB DEFAULT '{}',
                eventos JSONB DEFAULT '{}'
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_logs (
                id SERIAL PRIMARY KEY,
                tipo TEXT NOT NULL,
                texto TEXT NOT NULL,
                fecha TIMESTAMP DEFAULT NOW()
            )
        `);

        await pool.query(`
            CREATE TABLE IF NOT EXISTS admin_messages (
                id SERIAL PRIMARY KEY,
                usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
                tipo TEXT NOT NULL,
                texto TEXT NOT NULL,
                fecha TIMESTAMP DEFAULT NOW()
            )
        `);

        console.log('✅ Tablas verificadas/creadas correctamente.');
    } catch (err) {
        console.error('❌ Error al conectar/inicializar la base de datos:', err.message);
    }
}

inicializarBD();

// ==========================================================================
// 3. RUTAS DE LA API (Endpoints)
// ==========================================================================

// --- REGISTRO DE USUARIO ---
app.post('/api/auth/registro', async (req, res) => {
    const { nombre, apellidos, correo, password } = req.body;
    const rol = correo.endsWith('@studyco.com') ? 'admin' : 'estudiante';

    try {
        const hash = await bcrypt.hash(password, 10);
        const query = `INSERT INTO usuarios (nombre, apellidos, correo, password, rol, preferencias, eventos) 
                       VALUES ($1, $2, $3, $4, $5, '{}', '{}') RETURNING id`;

        const result = await pool.query(query, [nombre, apellidos, correo, hash, rol]);
        res.status(201).json({ mensaje: 'Usuario registrado con éxito', usuarioId: result.rows[0].id, rol: rol });
    } catch (err) {
        if (err.code === '23505') { // PostgreSQL unique violation
            return res.status(400).json({ error: 'El correo ya está registrado' });
        }
        console.error('Error en registro:', err.message);
        res.status(500).json({ error: 'Error al registrar en la base de datos' });
    }
});

// --- INICIO DE SESIÓN ---
app.post('/api/auth/login', async (req, res) => {
    const { correo, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE correo = $1', [correo]);
        const usuario = result.rows[0];

        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        const esValida = await bcrypt.compare(password, usuario.password);
        if (!esValida) return res.status(401).json({ error: 'Contraseña incorrecta' });

        res.json({
            mensaje: 'Login exitoso',
            usuario: {
                id: usuario.id,
                nombre: usuario.nombre,
                correo: usuario.correo,
                rol: usuario.rol,
                preferencias: usuario.preferencias || {},
                eventos: usuario.eventos || {}
            }
        });
    } catch (err) {
        console.error('Error en login:', err.message);
        res.status(500).json({ error: 'Error en la base de datos' });
    }
});

// --- GUARDAR EVENTOS O PREFERENCIAS DEL USUARIO ---
app.put('/api/usuarios/:id', async (req, res) => {
    const { preferencias, eventos } = req.body;
    const id = req.params.id;

    try {
        const result = await pool.query('SELECT preferencias, eventos FROM usuarios WHERE id = $1', [id]);
        const usuario = result.rows[0];

        if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });

        const nuevasPreferencias = preferencias ? JSON.stringify(preferencias) : JSON.stringify(usuario.preferencias);
        const nuevosEventos = eventos ? JSON.stringify(eventos) : JSON.stringify(usuario.eventos);

        await pool.query('UPDATE usuarios SET preferencias = $1, eventos = $2 WHERE id = $3',
            [nuevasPreferencias, nuevosEventos, id]
        );
        res.json({ mensaje: 'Datos actualizados correctamente' });
    } catch (err) {
        console.error('Error al actualizar usuario:', err.message);
        res.status(500).json({ error: 'Error al guardar los datos' });
    }
});

// --- OBTENER TODOS LOS ESTUDIANTES (para panel Admin) ---
app.get('/api/admin/estudiantes', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, nombre, apellidos, correo FROM usuarios WHERE rol = $1 ORDER BY nombre ASC',
            ['estudiante']
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener estudiantes:', err.message);
        res.status(500).json({ error: 'Error al obtener los estudiantes' });
    }
});

// --- GUARDAR MENSAJES Y ALERTAS DE ADMINISTRADOR ---
app.post('/api/admin/logs', async (req, res) => {
    const { tipo, texto } = req.body;

    try {
        const result = await pool.query(
            'INSERT INTO admin_logs (tipo, texto) VALUES ($1, $2) RETURNING id',
            [tipo, texto]
        );
        res.status(201).json({ mensaje: 'Publicado correctamente', id: result.rows[0].id });
    } catch (err) {
        console.error('Error al guardar log:', err.message);
        res.status(500).json({ error: 'Error al guardar en el panel de admin' });
    }
});

// --- OBTENER MENSAJES Y ALERTAS ---
app.get('/api/admin/logs', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM admin_logs ORDER BY fecha DESC');
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener logs:', err.message);
        res.status(500).json({ error: 'Error al obtener el historial' });
    }
});

// --- BORRAR USUARIO (BANEAR) ---
app.delete('/api/admin/usuarios/:id', async (req, res) => {
    const id = req.params.id;

    try {
        // admin_messages se borran automáticamente por ON DELETE CASCADE
        const result = await pool.query('DELETE FROM usuarios WHERE id = $1 RETURNING id', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json({ mensaje: 'Usuario eliminado correctamente' });
    } catch (err) {
        console.error('Error al eliminar usuario:', err.message);
        res.status(500).json({ error: 'Error al eliminar el usuario' });
    }
});

// --- GUARDAR MENSAJE/ALERTA POR USUARIO ---
app.post('/api/admin/usuarios/:id/mensajes', async (req, res) => {
    const { tipo, texto } = req.body;
    const usuario_id = req.params.id;

    try {
        const result = await pool.query(
            'INSERT INTO admin_messages (usuario_id, tipo, texto) VALUES ($1, $2, $3) RETURNING id, fecha',
            [usuario_id, tipo, texto]
        );
        res.status(201).json({ mensaje: 'Guardado correctamente', id: result.rows[0].id, fecha: result.rows[0].fecha });
    } catch (err) {
        console.error('Error al guardar mensaje:', err.message);
        res.status(500).json({ error: 'Error al guardar el mensaje' });
    }
});

// --- OBTENER MENSAJES/ALERTAS DE UN USUARIO ---
app.get('/api/admin/usuarios/:id/mensajes', async (req, res) => {
    const usuario_id = req.params.id;

    try {
        const result = await pool.query(
            'SELECT * FROM admin_messages WHERE usuario_id = $1 ORDER BY fecha DESC',
            [usuario_id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error('Error al obtener mensajes:', err.message);
        res.status(500).json({ error: 'Error al obtener los mensajes' });
    }
});

// --- OBTENER INFORMACIÓN DE UN USUARIO (sin contraseña) ---
app.get('/api/admin/usuarios/:id/info', async (req, res) => {
    const id = req.params.id;

    try {
        const result = await pool.query(
            'SELECT id, nombre, apellidos, correo FROM usuarios WHERE id = $1',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        console.error('Error al obtener info usuario:', err.message);
        res.status(500).json({ error: 'Error al obtener la información' });
    }
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