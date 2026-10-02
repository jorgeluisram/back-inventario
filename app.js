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

// 📋 Obtener todos los productos con categoría y precios
app.get('/api/productos', (req, res) => {
  const query = `
    SELECT 
      p.id, p.nombre, p.descripcion, p.stock, p.stock_minimo, p.estado, p.creado_en,
      p.categoria_id, c.nombre AS categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    ORDER BY p.nombre ASC
  `;

  db.query(query, (err, productos) => {
    if (err) {
      console.error('Error al obtener productos:', err);
      return res.status(500).json({ mensaje: 'Error al obtener productos.' });
    }
    if (productos.length === 0) return res.json([]);

    const ids = productos.map(p => p.id);
    db.query('SELECT * FROM precios_producto WHERE producto_id IN (?)', [ids], (err, precios) => {
      if (err) {
        console.error('Error al obtener precios:', err);
        return res.status(500).json({ mensaje: 'Error al obtener precios.' });
      }
      const resultado = productos.map(p => ({
        ...p,
        precios: precios.filter(pr => pr.producto_id === p.id)
      }));
      res.json(resultado);
    });
  });
});

// ➕ Crear producto con sus 4 precios
app.post('/api/productos', (req, res) => {
  const { nombre, descripcion, categoria_id, stock, stock_minimo, estado, precios } = req.body;

  if (!nombre || !categoria_id) {
    return res.status(400).json({ mensaje: 'Nombre y categoría son obligatorios.' });
  }
  if (!Array.isArray(precios) || precios.length === 0) {
    return res.status(400).json({ mensaje: 'Debes registrar al menos un precio.' });
  }

  const insertProducto = `
    INSERT INTO productos (nombre, descripcion, categoria_id, stock, stock_minimo, estado)
    VALUES (?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insertProducto,
    [nombre, descripcion || null, categoria_id, stock || 0, stock_minimo || 0, estado || 'Activo'],
    (err, result) => {
      if (err) {
        console.error('Error al crear producto:', err);
        return res.status(500).json({ mensaje: 'Error al crear producto.' });
      }

      const productoId = result.insertId;
      const valoresPrecios = precios.map(p => [productoId, p.tipo_cliente, p.unidad_medida, p.precio]);

      db.query(
        'INSERT INTO precios_producto (producto_id, tipo_cliente, unidad_medida, precio) VALUES ?',
        [valoresPrecios],
        (err) => {
          if (err) {
            console.error('Error al guardar precios:', err);
            return res.status(500).json({ mensaje: 'Producto creado pero falló el registro de precios.' });
          }
          res.status(201).json({ mensaje: 'Producto creado correctamente.', id: productoId });
        }
      );
    }
  );
});

// ✏️ Actualizar producto y reemplazar sus precios
app.put('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, categoria_id, stock, stock_minimo, estado, precios } = req.body;

  if (!nombre || !categoria_id) {
    return res.status(400).json({ mensaje: 'Nombre y categoría son obligatorios.' });
  }

  const updateProducto = `
    UPDATE productos
    SET nombre = ?, descripcion = ?, categoria_id = ?, stock = ?, stock_minimo = ?, estado = ?
    WHERE id = ?
  `;

  db.query(
    updateProducto,
    [nombre, descripcion || null, categoria_id, stock || 0, stock_minimo || 0, estado, id],
    (err, result) => {
      if (err) {
        console.error('Error al actualizar producto:', err);
        return res.status(500).json({ mensaje: 'Error al actualizar producto.' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Producto no encontrado.' });
      }
      if (!Array.isArray(precios) || precios.length === 0) {
        return res.json({ mensaje: 'Producto actualizado correctamente.' });
      }

      db.query('DELETE FROM precios_producto WHERE producto_id = ?', [id], (err) => {
        if (err) {
          console.error('Error al limpiar precios:', err);
          return res.status(500).json({ mensaje: 'Producto actualizado pero falló la actualización de precios.' });
        }
        const valoresPrecios = precios.map(p => [id, p.tipo_cliente, p.unidad_medida, p.precio]);
        db.query(
          'INSERT INTO precios_producto (producto_id, tipo_cliente, unidad_medida, precio) VALUES ?',
          [valoresPrecios],
          (err) => {
            if (err) {
              console.error('Error al guardar precios:', err);
              return res.status(500).json({ mensaje: 'Producto actualizado pero falló el registro de precios.' });
            }
            res.json({ mensaje: 'Producto actualizado correctamente.' });
          }
        );
      });
    }
  );
});

// 🗑️ Eliminar producto
app.delete('/api/productos/:id', (req, res) => {
  const { id } = req.params;
  db.query('DELETE FROM productos WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error al eliminar producto:', err);
      return res.status(500).json({ mensaje: 'No se puede eliminar: el producto tiene movimientos asociados.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Producto no encontrado.' });
    }
    res.json({ mensaje: 'Producto eliminado correctamente.' });
  });
});

// 📋 Obtener todos los clientes
app.get('/api/clientes', (req, res) => {
  const query = `
    SELECT id, nombre, nit, telefono, correo, contacto, direccion, tipo_cliente, activo, creado_en
    FROM clientes
    ORDER BY nombre ASC
  `;
  db.query(query, (err, results) => {
    if (err) {
      console.error('Error al obtener clientes:', err);
      return res.status(500).json({ mensaje: 'Error al obtener clientes.' });
    }
    res.json(results);
  });
});

// ➕ Crear cliente
app.post('/api/clientes', (req, res) => {
  const { nombre, nit, telefono, correo, contacto, direccion, tipo_cliente, activo } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ mensaje: 'El nombre es requerido.' });
  }

  const insertQuery = `
    INSERT INTO clientes (nombre, nit, telefono, correo, contacto, direccion, tipo_cliente, activo)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    insertQuery,
    [
      nombre,
      nit || 'CF',
      telefono || null,
      correo || null,
      contacto || null,
      direccion || null,
      tipo_cliente || 'publico',
      activo === false ? 0 : 1,
    ],
    (err, result) => {
      if (err) {
        console.error('Error al crear cliente:', err);
        return res.status(500).json({ mensaje: 'Error al crear cliente.' });
      }
      res.status(201).json({ mensaje: 'Cliente registrado correctamente.', id: result.insertId });
    }
  );
});

// ✏️ Actualizar cliente
app.put('/api/clientes/:id', (req, res) => {
  const { id } = req.params;
  const { nombre, nit, telefono, correo, contacto, direccion, tipo_cliente, activo } = req.body;

  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ mensaje: 'El nombre es requerido.' });
  }

  const query = `
    UPDATE clientes
    SET nombre = ?, nit = ?, telefono = ?, correo = ?, contacto = ?, direccion = ?, tipo_cliente = ?, activo = ?
    WHERE id = ?
  `;

  db.query(
    query,
    [
      nombre,
      nit || 'CF',
      telefono || null,
      correo || null,
      contacto || null,
      direccion || null,
      tipo_cliente || 'publico',
      activo === false ? 0 : 1,
      id,
    ],
    (err, result) => {
      if (err) {
        console.error('Error al actualizar cliente:', err);
        return res.status(500).json({ mensaje: 'Error al actualizar cliente.' });
      }
      if (result.affectedRows === 0) {
        return res.status(404).json({ mensaje: 'Cliente no encontrado.' });
      }
      res.json({ mensaje: 'Cliente actualizado correctamente.' });
    }
  );
});

// 🔒 Activar/Desactivar cliente (no se elimina, solo se inactiva)
app.put('/api/clientes/:id/estado', (req, res) => {
  const { id } = req.params;
  const { activo } = req.body;

  db.query('UPDATE clientes SET activo = ? WHERE id = ?', [activo ? 1 : 0, id], (err, result) => {
    if (err) {
      console.error('Error al cambiar estado:', err);
      return res.status(500).json({ mensaje: 'Error al cambiar el estado del cliente.' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ mensaje: 'Cliente no encontrado.' });
    }
    res.json({ mensaje: `Cliente ${activo ? 'activado' : 'desactivado'} correctamente.` });
  });
});

app.get('/api/proveedores', (req, res) => {
  db.query('SELECT id, nombre, nit, contacto, telefono, activo FROM proveedores ORDER BY nombre ASC', (err, results) => {
    if (err) return res.status(500).json({ mensaje: 'Error al obtener proveedores.' });
    res.json(results);
  });
});

app.post('/api/proveedores', (req, res) => {
  const { nombre, nit, contacto, telefono } = req.body;
  if (!nombre || !nombre.trim()) {
    return res.status(400).json({ mensaje: 'El nombre es requerido.' });
  }
  db.query(
    'INSERT INTO proveedores (nombre, nit, contacto, telefono) VALUES (?, ?, ?, ?)',
    [nombre, nit || null, contacto || null, telefono || null],
    (err, result) => {
      if (err) return res.status(500).json({ mensaje: 'Error al crear proveedor.' });
      res.status(201).json({ mensaje: 'Proveedor creado correctamente.', id: result.insertId });
    }
  );
});

// Helper: calcula cuántas unidades reales afecta una línea (docena = x12)
function cantidadEnUnidades(cantidad, unidad_medida) {
  return unidad_medida === 'docena' ? Number(cantidad) * 12 : Number(cantidad);
}

// 📋 Listar movimientos con cliente/proveedor/usuario y su detalle
app.get('/api/movimientos', (req, res) => {
  const query = `
    SELECT 
      m.*, 
      c.nombre AS cliente_nombre, c.tipo_cliente,
      p.nombre AS proveedor_nombre,
      u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
    FROM movimientos m
    LEFT JOIN clientes c ON m.cliente_id = c.id
    LEFT JOIN proveedores p ON m.proveedor_id = p.id
    LEFT JOIN usuarios u ON m.usuario_id = u.id
    ORDER BY m.fecha DESC, m.id DESC
  `;

  db.query(query, (err, movimientos) => {
    if (err) {
      console.error('Error al obtener movimientos:', err);
      return res.status(500).json({ mensaje: 'Error al obtener movimientos.' });
    }
    if (movimientos.length === 0) return res.json([]);

    const ids = movimientos.map(m => m.id);
    const queryDetalle = `
      SELECT md.*, pr.nombre AS producto_nombre
      FROM movimientos_detalle md
      JOIN productos pr ON md.producto_id = pr.id
      WHERE md.movimiento_id IN (?)
    `;

    db.query(queryDetalle, [ids], (err, detalles) => {
      if (err) {
        console.error('Error al obtener detalle:', err);
        return res.status(500).json({ mensaje: 'Error al obtener detalle de movimientos.' });
      }
      const resultado = movimientos.map(m => ({
        ...m,
        detalle: detalles.filter(d => d.movimiento_id === m.id)
      }));
      res.json(resultado);
    });
  });
});

// ➕ Crear movimiento (transacción: valida stock, calcula precio, actualiza stock)
app.post('/api/movimientos', (req, res) => {
  const { tipo, referencia, fecha, cliente_id, proveedor_id, motivo, usuario_id, observaciones, detalle } = req.body;

  if (!tipo || !fecha || !usuario_id) {
    return res.status(400).json({ mensaje: 'Tipo, fecha y usuario son obligatorios.' });
  }
  if (!Array.isArray(detalle) || detalle.length === 0) {
    return res.status(400).json({ mensaje: 'Agrega al menos un producto.' });
  }

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ mensaje: 'Error de conexión.' });

    conn.beginTransaction(async (err) => {
      if (err) { conn.release(); return res.status(500).json({ mensaje: 'Error al iniciar transacción.' }); }

      try {
        // 1. Obtener tipo_cliente si es venta a cliente
        let tipoClienteRow = null;
        if (tipo === 'Salida' && cliente_id) {
          tipoClienteRow = await new Promise((resolve, reject) => {
            conn.query('SELECT tipo_cliente FROM clientes WHERE id = ?', [cliente_id], (err, rows) => {
              if (err) return reject(err);
              resolve(rows[0]?.tipo_cliente || 'publico');
            });
          });
        }

        // 2. Procesar cada línea: validar stock, calcular precio, armar updates
        let totalMovimiento = 0;
        const lineasFinal = [];

        for (const linea of detalle) {
          const { producto_id, cantidad, unidad_medida } = linea;
          const unidades = cantidadEnUnidades(cantidad, unidad_medida || 'unidad');

          const producto = await new Promise((resolve, reject) => {
            conn.query('SELECT stock FROM productos WHERE id = ? FOR UPDATE', [producto_id], (err, rows) => {
              if (err) return reject(err);
              resolve(rows[0]);
            });
          });
          if (!producto) throw { codigo: 400, mensaje: `Producto ${producto_id} no encontrado.` };

          if (tipo === 'Salida' && producto.stock < unidades) {
            throw { codigo: 400, mensaje: `Stock insuficiente para el producto ${producto_id} (disponible: ${producto.stock}).` };
          }

          let precio_unitario = null;
          let subtotal = null;

          if (tipo === 'Salida' && cliente_id) {
            const precioRow = await new Promise((resolve, reject) => {
              conn.query(
                'SELECT precio FROM precios_producto WHERE producto_id = ? AND tipo_cliente = ? AND unidad_medida = ?',
                [producto_id, tipoClienteRow, unidad_medida || 'unidad'],
                (err, rows) => {
                  if (err) return reject(err);
                  resolve(rows[0]);
                }
              );
            });
            precio_unitario = precioRow ? Number(precioRow.precio) : 0;
            subtotal = precio_unitario * Number(cantidad);
            totalMovimiento += subtotal;
          }

          let nuevoStock = producto.stock;
          if (tipo === 'Entrada') nuevoStock += unidades;
          else if (tipo === 'Salida') nuevoStock -= unidades;
          else if (tipo === 'Ajuste') nuevoStock = unidades;

          lineasFinal.push({ producto_id, cantidad, unidad_medida: unidad_medida || 'unidad', precio_unitario, subtotal, nuevoStock });
        }

        // 3. Generar número de movimiento
        const numero = await new Promise((resolve, reject) => {
          conn.query('SELECT COUNT(*) AS total FROM movimientos', (err, rows) => {
            if (err) return reject(err);
            resolve(`MOV-${String(rows[0].total + 1).padStart(6, '0')}`);
          });
        });

        // 4. Insertar movimiento
        const movResult = await new Promise((resolve, reject) => {
          conn.query(
            `INSERT INTO movimientos (numero_movimiento, tipo, referencia, fecha, cliente_id, proveedor_id, motivo, usuario_id, observaciones, total)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [numero, tipo, referencia || null, fecha, cliente_id || null, proveedor_id || null, motivo || null, usuario_id, observaciones || null, totalMovimiento],
            (err, result) => { if (err) return reject(err); resolve(result); }
          );
        });

        // 5. Insertar detalle y actualizar stock
        for (const l of lineasFinal) {
          await new Promise((resolve, reject) => {
            conn.query(
              'INSERT INTO movimientos_detalle (movimiento_id, producto_id, cantidad, unidad_medida, precio_unitario, subtotal) VALUES (?, ?, ?, ?, ?, ?)',
              [movResult.insertId, l.producto_id, l.cantidad, l.unidad_medida, l.precio_unitario, l.subtotal],
              (err) => err ? reject(err) : resolve()
            );
          });
          await new Promise((resolve, reject) => {
            conn.query('UPDATE productos SET stock = ? WHERE id = ?', [l.nuevoStock, l.producto_id], (err) => err ? reject(err) : resolve());
          });
        }

        conn.commit((err) => {
          conn.release();
          if (err) return res.status(500).json({ mensaje: 'Error al confirmar movimiento.' });
          res.status(201).json({ mensaje: 'Movimiento registrado correctamente.', numero_movimiento: numero, id: movResult.insertId });
        });

      } catch (error) {
        conn.rollback(() => {
          conn.release();
          console.error('Error en movimiento:', error);
          res.status(error.codigo || 500).json({ mensaje: error.mensaje || 'Error al registrar movimiento.' });
        });
      }
    });
  });
});

// 🚫 Anular movimiento (revierte el stock; no borra el registro)
app.put('/api/movimientos/:id/anular', (req, res) => {
  const { id } = req.params;

  db.getConnection((err, conn) => {
    if (err) return res.status(500).json({ mensaje: 'Error de conexión.' });

    conn.beginTransaction(async (err) => {
      if (err) { conn.release(); return res.status(500).json({ mensaje: 'Error al iniciar transacción.' }); }
      try {
        const mov = await new Promise((resolve, reject) => {
          conn.query('SELECT * FROM movimientos WHERE id = ?', [id], (err, rows) => err ? reject(err) : resolve(rows[0]));
        });
        if (!mov) throw { codigo: 404, mensaje: 'Movimiento no encontrado.' };
        if (mov.estado === 'Anulado') throw { codigo: 400, mensaje: 'Este movimiento ya está anulado.' };

        const detalle = await new Promise((resolve, reject) => {
          conn.query('SELECT * FROM movimientos_detalle WHERE movimiento_id = ?', [id], (err, rows) => err ? reject(err) : resolve(rows));
        });

        for (const d of detalle) {
          const unidades = cantidadEnUnidades(d.cantidad, d.unidad_medida);
          // Revertir: lo opuesto de lo que hizo el movimiento original (Ajuste no se revierte, se marca anulado solamente)
          if (mov.tipo === 'Entrada') {
            await new Promise((resolve, reject) => {
              conn.query('UPDATE productos SET stock = stock - ? WHERE id = ?', [unidades, d.producto_id], (err) => err ? reject(err) : resolve());
            });
          } else if (mov.tipo === 'Salida') {
            await new Promise((resolve, reject) => {
              conn.query('UPDATE productos SET stock = stock + ? WHERE id = ?', [unidades, d.producto_id], (err) => err ? reject(err) : resolve());
            });
          }
        }

        await new Promise((resolve, reject) => {
          conn.query('UPDATE movimientos SET estado = "Anulado" WHERE id = ?', [id], (err) => err ? reject(err) : resolve());
        });

        conn.commit((err) => {
          conn.release();
          if (err) return res.status(500).json({ mensaje: 'Error al confirmar anulación.' });
          res.json({ mensaje: 'Movimiento anulado correctamente.' });
        });
      } catch (error) {
        conn.rollback(() => {
          conn.release();
          res.status(error.codigo || 500).json({ mensaje: error.mensaje || 'Error al anular movimiento.' });
        });
      }
    });
  });
});

// ============ REPORTE DE VENTAS ============
app.get('/api/reportes/ventas', async (req, res) => {
  const { desde, hasta, formato } = req.query;

  let query = `
    SELECT 
      m.id, m.numero_movimiento, m.referencia, m.fecha, m.total,
      c.nombre AS cliente_nombre, c.tipo_cliente,
      u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
    FROM movimientos m
    LEFT JOIN clientes c ON m.cliente_id = c.id
    LEFT JOIN usuarios u ON m.usuario_id = u.id
    WHERE m.tipo = 'Salida' AND m.estado = 'Registrado' AND m.total > 0
  `;
  const params = [];

  if (desde) { query += ' AND m.fecha >= ?'; params.push(desde); }
  if (hasta) { query += ' AND m.fecha <= ?'; params.push(hasta); }
  query += ' ORDER BY m.fecha DESC';

  db.query(query, params, async (err, ventas) => {
    if (err) {
      console.error('Error al generar reporte de ventas:', err);
      return res.status(500).json({ mensaje: 'Error al generar reporte de ventas.' });
    }

    const totalGeneral = ventas.reduce((s, v) => s + Number(v.total), 0);

    if (!formato || formato === 'json') {
      return res.json({ ventas, totalGeneral, cantidad: ventas.length });
    }

    if (formato === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Ventas');
      sheet.columns = [
        { header: 'No. Movimiento', key: 'numero_movimiento', width: 18 },
        { header: 'Referencia', key: 'referencia', width: 18 },
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Cliente', key: 'cliente_nombre', width: 25 },
        { header: 'Tipo Cliente', key: 'tipo_cliente', width: 14 },
        { header: 'Usuario', key: 'usuario', width: 22 },
        { header: 'Total (Q)', key: 'total', width: 14 },
      ];
      sheet.getRow(1).font = { bold: true };

      ventas.forEach(v => {
        sheet.addRow({
          numero_movimiento: v.numero_movimiento,
          referencia: v.referencia || '-',
          fecha: new Date(v.fecha).toLocaleDateString('es-GT'),
          cliente_nombre: v.cliente_nombre || 'Consumo interno',
          tipo_cliente: v.tipo_cliente === 'revendedor' ? 'Revendedor' : 'Público',
          usuario: `${v.usuario_nombre || ''} ${v.usuario_apellido || ''}`,
          total: Number(v.total),
        });
      });

      sheet.addRow({});
      const totalRow = sheet.addRow({ referencia: 'TOTAL GENERAL', total: totalGeneral });
      totalRow.font = { bold: true };

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_ventas.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (formato === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=reporte_ventas.pdf');
      doc.pipe(res);

      doc.fontSize(16).text('Reporte de Ventas', { align: 'center' });
      doc.fontSize(10).fillColor('#64748b').text(
        `Periodo: ${desde || 'inicio'} a ${hasta || 'hoy'}`, { align: 'center' }
      );
      doc.moveDown(1.5);

      ventas.forEach(v => {
        doc.fillColor('#000').fontSize(10).text(
          `${v.numero_movimiento}  |  ${new Date(v.fecha).toLocaleDateString('es-GT')}  |  ${v.cliente_nombre || 'Consumo interno'}  |  Q${Number(v.total).toFixed(2)}`
        );
        doc.moveDown(0.3);
      });

      doc.moveDown(1);
      doc.fontSize(12).fillColor('#000').text(`Total general: Q${totalGeneral.toFixed(2)}`, { align: 'right' });

      doc.end();
      return;
    }

    res.status(400).json({ mensaje: 'Formato no soportado.' });
  });
});


// ============ REPORTE DE STOCK BAJO ============
app.get('/api/reportes/stock-bajo', async (req, res) => {
  const { formato } = req.query;

  const query = `
    SELECT p.id, p.nombre, p.stock, p.stock_minimo, c.nombre AS categoria_nombre
    FROM productos p
    LEFT JOIN categorias c ON p.categoria_id = c.id
    WHERE p.stock <= p.stock_minimo
    ORDER BY p.stock ASC
  `;

  db.query(query, async (err, productos) => {
    if (err) {
      console.error('Error al generar reporte de stock:', err);
      return res.status(500).json({ mensaje: 'Error al generar reporte de stock.' });
    }

    if (!formato || formato === 'json') {
      return res.json({ productos, cantidad: productos.length });
    }

    if (formato === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Stock Bajo');
      sheet.columns = [
        { header: 'Producto', key: 'nombre', width: 30 },
        { header: 'Categoría', key: 'categoria_nombre', width: 22 },
        { header: 'Stock Actual', key: 'stock', width: 14 },
        { header: 'Stock Mínimo', key: 'stock_minimo', width: 14 },
      ];
      sheet.getRow(1).font = { bold: true };
      productos.forEach(p => sheet.addRow(p));

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_stock_bajo.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (formato === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=reporte_stock_bajo.pdf');
      doc.pipe(res);

      doc.fontSize(16).text('Reporte de Stock Bajo', { align: 'center' });
      doc.moveDown(1.5);

      productos.forEach(p => {
        const color = p.stock === 0 ? '#dc2626' : '#ea580c';
        doc.fillColor(color).fontSize(10).text(
          `${p.nombre}  (${p.categoria_nombre || 'Sin categoría'})  —  Stock: ${p.stock} / Mínimo: ${p.stock_minimo}`
        );
        doc.moveDown(0.3);
      });

      doc.end();
      return;
    }

    res.status(400).json({ mensaje: 'Formato no soportado.' });
  });
});


// ============ REPORTE DE MOVIMIENTOS ============
app.get('/api/reportes/movimientos', async (req, res) => {
  const { desde, hasta, tipo, formato } = req.query;

  let query = `
    SELECT 
      m.numero_movimiento, m.tipo, m.referencia, m.fecha, m.motivo, m.estado, m.total,
      c.nombre AS cliente_nombre, p.nombre AS proveedor_nombre,
      u.nombre AS usuario_nombre, u.apellido AS usuario_apellido
    FROM movimientos m
    LEFT JOIN clientes c ON m.cliente_id = c.id
    LEFT JOIN proveedores p ON m.proveedor_id = p.id
    LEFT JOIN usuarios u ON m.usuario_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (desde) { query += ' AND m.fecha >= ?'; params.push(desde); }
  if (hasta) { query += ' AND m.fecha <= ?'; params.push(hasta); }
  if (tipo) { query += ' AND m.tipo = ?'; params.push(tipo); }
  query += ' ORDER BY m.fecha DESC';

  db.query(query, params, async (err, movimientos) => {
    if (err) {
      console.error('Error al generar reporte de movimientos:', err);
      return res.status(500).json({ mensaje: 'Error al generar reporte de movimientos.' });
    }

    if (!formato || formato === 'json') {
      return res.json({ movimientos, cantidad: movimientos.length });
    }

    if (formato === 'excel') {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet('Movimientos');
      sheet.columns = [
        { header: 'No. Movimiento', key: 'numero_movimiento', width: 18 },
        { header: 'Tipo', key: 'tipo', width: 12 },
        { header: 'Referencia', key: 'referencia', width: 18 },
        { header: 'Fecha', key: 'fecha', width: 14 },
        { header: 'Cliente/Proveedor', key: 'destino', width: 25 },
        { header: 'Motivo', key: 'motivo', width: 20 },
        { header: 'Usuario', key: 'usuario', width: 22 },
        { header: 'Estado', key: 'estado', width: 12 },
        { header: 'Total (Q)', key: 'total', width: 14 },
      ];
      sheet.getRow(1).font = { bold: true };

      movimientos.forEach(m => {
        sheet.addRow({
          numero_movimiento: m.numero_movimiento,
          tipo: m.tipo,
          referencia: m.referencia || '-',
          fecha: new Date(m.fecha).toLocaleDateString('es-GT'),
          destino: m.cliente_nombre || m.proveedor_nombre || '-',
          motivo: m.motivo || '-',
          usuario: `${m.usuario_nombre || ''} ${m.usuario_apellido || ''}`,
          estado: m.estado,
          total: Number(m.total || 0),
        });
      });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename=reporte_movimientos.xlsx');
      await workbook.xlsx.write(res);
      return res.end();
    }

    if (formato === 'pdf') {
      const doc = new PDFDocument({ margin: 40 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'inline; filename=reporte_movimientos.pdf');
      doc.pipe(res);

      doc.fontSize(16).text('Reporte de Movimientos', { align: 'center' });
      doc.moveDown(1.5);

      movimientos.forEach(m => {
        doc.fillColor('#000').fontSize(9).text(
          `${m.numero_movimiento}  |  ${m.tipo}  |  ${new Date(m.fecha).toLocaleDateString('es-GT')}  |  ${m.cliente_nombre || m.proveedor_nombre || '-'}  |  ${m.estado}`
        );
        doc.moveDown(0.3);
      });

      doc.end();
      return;
    }

    res.status(400).json({ mensaje: 'Formato no soportado.' });
  });
});

const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`Servidor corriendo en http://${HOST}:${PORT}`);
});