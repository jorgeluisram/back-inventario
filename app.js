//db clinina dental
require('dotenv').config();
const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const bcrypt = require('bcrypt');

const jwt = require('jsonwebtoken')
const JWT_SECRET = 'lngCHo6nYpS8XzT3'; // Clave secreta para JWT (en producción, usar variable de entorno)

const app = express();
app.use(cors());
app.use(express.json()); // Para recibir JSON

const ExcelJS = require("exceljs");

// Conexión a MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306
});

// Test de conexión
db.getConnection((err, connection) => {
  if (err) {
    console.error('Error conectando a MySQL:', err.message);
  } else {
    console.log('Conectado a la base de datos MySQL');
    connection.release();
  }
});

// ================== Rutas ==================

app.get('/', (req, res) => {
  res.send('Servidor funcionando en Railway inventario');
});

app.get('/api/ok', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Servicio activo',
    timestamp: new Date()
  });
});


//  Registrar nuevo usuario

app.post('/api/usuarios', (req, res) => {
  const {
    nombre,
    apellido,
    usuario,
    correo,
    password,
    rol,
    estado
  } = req.body;

  // Validar campos obligatorios
  if (!nombre || !usuario || !password) {
    return res.status(400).json({ mensaje: 'Faltan campos obligatorios.' });
  }

  // Verificar si ya existe el usuario
  
  const checkQuery = 'SELECT id FROM usuarios WHERE usuario = ? OR correo = ?';

  db.query(checkQuery, [usuario, correo], (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error en la validación.' });
    if (rows.length > 0) {
      return res.status(400).json({ mensaje: 'El usuario o correo ya existe.' });
    }

    // Encriptar contraseña
    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ mensaje: 'Error al encriptar contraseña.' });
      const insertQuery = `
        INSERT INTO usuarios (nombre, apellido, usuario, correo, password, rol, estado)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      db.query(
        insertQuery,
        [nombre, apellido, usuario, correo, hash, rol, estado],
        (err, result) => {
          console.log('error usuario', err);
          if (err) return res.status(500).json({ mensaje: 'Error al registrar usuario.' });

          res.status(201).json({
            mensaje: 'Usuario registrado correctamente.',
            idUsuario: result.insertId
          });
        }
      );
    });
  });
});

// 📋 Obtener todos los usuarios
app.get('/api/usuarios', (req, res) => {
  const query = `
    SELECT 
      id, 
      nombre, 
      apellido, 
      usuario, 
      correo, 
      rol, 
      estado
    FROM usuarios
    ORDER BY id DESC
  `;

  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener usuarios:', err);
      return res.status(500).json({ mensaje: 'Error al obtener la lista de usuarios.' });
    }

    res.json(results);
  });
});

// 📌 Actualizar usuario
app.put('/api/usuarios/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, apellido, usuario, correo, rol, estado } = req.body;

  const query = `
    UPDATE usuarios
    SET nombre = ?, apellido = ?, usuario = ?, correo = ?, rol = ?, estado = ?
    WHERE id = ?
  `;

  db.query(query, [nombre, apellido, usuario, correo, rol, estado, id], (err, result) => {
    if (err) {
      console.error('Error al actualizar usuario:', err);
      return res.status(500).json({ mensaje: 'Error al actualizar usuario.' });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Usuario no encontrado.' });
    }

    res.json({ mensaje: 'Usuario actualizado correctamente.' });
  });
});
// ==========================================

// 📌 Login
app.post('/api/login', (req, res) => {
  const { usuario, password } = req.body
  if (!usuario || !password) {
    return res.status(400).json({ error: 'Faltan credenciales' })
  }

  // Buscar usuario en la base de datos
  const query = 'SELECT * FROM usuarios WHERE usuario = ? AND estado = "Activo"'

  db.query(query, [usuario], async (err, results) => {
    if (err) {
      console.error('Error al consultar usuario:', err)
      return res.status(500).json({ error: 'Error interno del servidor' })
    }
    if (results.length === 0) {
      return res.status(401).json({ error: 'Usuario no encontrado o inactivo' })
    }

    const user = results[0]
    try {
      // Comparar contraseña ingresada con la almacenada (encriptada)
     const passwordMatch = await bcrypt.compare(password, user.password)

      if (!passwordMatch) {
        return res.status(401).json({ error: 'Contraseña incorrecta' })
      }

      // Crear token con datos básicos
      const token = jwt.sign(
        {
          id: user.id,
          usuario: user.usuario,
          rol: user.rol
        },
        JWT_SECRET,
        { expiresIn: '2h' } // duración del token
      )

      res.json({
        mensaje: 'Inicio de sesión exitoso',
        token,
        usuario: {
          id: user.id,
          nombre: user.nombre,
          apellido: user.apellido,
          rol: user.rol
        }
      })
    } catch (error) {
      console.error('Error al comparar contraseña:', error)
      res.status(500).json({ error: 'Error interno al validar usuario' })
    }
  })
})

// 🔐 Resetear contraseña a 123456
app.put('/api/usuarios/:id/reset-password', async (req, res) => {
  const { id } = req.params
console.log('reset password para id:', id);
  try {
    const nuevaPassword = '123456'
    const hash = await bcrypt.hash(nuevaPassword, 10)

    const query = `
      UPDATE usuarios
      SET password = ?
      WHERE id = ?
    `

    db.query(query, [hash, id], (err, result) => {
      if (err) {
        console.error(err)
        return res.status(500).json({ error: 'Error al reiniciar contraseña' })
      }

      res.json({ mensaje: 'Contraseña reiniciada correctamente' })
    })
  } catch (error) {
    res.status(500).json({ error: 'Error interno' })
  }
})


const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');

app.get('/api/alumnos/qr/pdf', async (req, res) => {

  const query = `
    SELECT 
      a.idAlumno,
      a.nombre1,
      a.nombre2,
      a.apellido1,
      a.apellido2,
      g.nombreGrado,
      g.seccion
    FROM alumnos a
    LEFT JOIN grados g ON a.idGrado = g.idGrado
    ORDER BY a.apellido1 ASC
  `;

  db.query(query, async (err, alumnos) => {

    if (err) return res.status(500).json(err);

    const doc = new PDFDocument({
      margin: 20
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename=qr_alumnos.pdf');

    doc.pipe(res);

    let x = 40;
    let y = 40;

    for (let alumno of alumnos) {

      const nombreCompleto =
        `${alumno.nombre1} ${alumno.nombre2} ${alumno.apellido1} ${alumno.apellido2}`;

      const grado =
        `${alumno.nombreGrado || ''} ${alumno.seccion || ''}`;

      // QR contiene el ID alumno
      const qr = await QRCode.toDataURL(alumno.idAlumno.toString());

      const base64Data = qr.replace(/^data:image\/png;base64,/, "");
      const buffer = Buffer.from(base64Data, 'base64');

      // Marco tipo carnet
      doc.rect(x - 10, y - 10, 120, 150).stroke();

      // ID Alumno
      doc.fontSize(10)
         .text("ID: " + alumno.idAlumno, x, y);

      // Nombre
      doc.fontSize(9)
         .text(nombreCompleto, x, y + 15, { width: 100 });

      // Grado
      doc.fontSize(9)
         .text("Grado:", x, y + 40);

      doc.fontSize(9)
         .text(grado, x, y + 52);

      // QR
      doc.image(buffer, x, y + 70, { width: 80 });

      x += 140;

      if (x > 450) {
        x = 40;
        y += 170;
      }

      if (y > 700) {
        doc.addPage();
        x = 40;
        y = 40;
      }

    }

    doc.end();

  });

});

// 📋 Obtener todas las categorías
app.get('/api/categorias', (req, res) => {
  const query = 'SELECT id, nombre, descripcion, creado_en FROM categorias ORDER BY nombre ASC';
 
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener categorías:', err);
      return res.status(500).json({ mensaje: 'Error al obtener categorías.' });
    }
    res.json(results);
  });
});

// ➕ Crear categoría
app.post('/api/categorias', (req, res) => {
  const { nombre, descripcion } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ mensaje: 'El nombre es requerido.' });
  }

  const checkQuery = 'SELECT id FROM categorias WHERE nombre = ?';
  db.query(checkQuery, [nombre], (err, rows) => {
    if (err) return res.status(500).json({ mensaje: 'Error en la validación.' });
    if (rows.length > 0) {
      return res.status(400).json({ mensaje: 'Ya existe una categoría con ese nombre.' });
    }

    const insertQuery = 'INSERT INTO categorias (nombre, descripcion) VALUES (?, ?)';
    db.query(insertQuery, [nombre, descripcion || null], (err, result) => {
      if (err) {
        console.error('Error al crear categoría:', err);
        return res.status(500).json({ mensaje: 'Error al crear categoría.' });
      }
      res.status(201).json({
        mensaje: 'Categoría creada correctamente.',
        id: result.insertId
      });
    });
  });
});

// ✏️ Actualizar categoría
app.put('/api/categorias/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ mensaje: 'El nombre es requerido.' });
  }

  const query = 'UPDATE categorias SET nombre = ?, descripcion = ? WHERE id = ?';
  db.query(query, [nombre, descripcion || null, id], (err, result) => {
    if (err) {
      console.error('Error al actualizar categoría:', err);
      return res.status(500).json({ mensaje: 'Error al actualizar categoría.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Categoría no encontrada.' });
    }
    res.json({ mensaje: 'Categoría actualizada correctamente.' });
  });
});

// 🗑️ Eliminar categoría
app.delete('/api/categorias/:id', (req, res) => {
  const { id } = req.params;

  const query = 'DELETE FROM categorias WHERE id = ?';
  db.query(query, [id], (err, result) => {
    if (err) {
      // Si tiene productos asociados con FK RESTRICT, caerá aquí
      console.error('Error al eliminar categoría:', err);
      return res.status(500).json({ mensaje: 'No se puede eliminar: la categoría tiene productos asociados.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Categoría no encontrada.' });
    }
    res.json({ mensaje: 'Categoría eliminada correctamente.' });
  });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});