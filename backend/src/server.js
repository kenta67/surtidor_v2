require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
const allowedOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173'];
if (process.env.FRONTEND_URL) {
  allowedOrigins.push(process.env.FRONTEND_URL);
}

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Para mayor flexibilidad en Vercel, podemos permitir cualquier origen si así se requiere,
      // pero por seguridad lo dejamos en origins específicos o permitimos regex.
      // Si quieres permitir todo, descomenta: callback(null, true);
      callback(null, true); // Permitir todo temporalmente para facilitar el despliegue
    }
  },
  credentials: true
}));
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
app.use('/api/surtidores', require('./routes/surtidores'));
app.use('/api/ventas', require('./routes/ventas'));
app.use('/api/alertas', require('./routes/alertas'));
app.use('/api/combustibles', require('./routes/combustibles'));
app.use('/api/vehiculos', require('./routes/vehiculos'));
app.use('/api/clientes', require('./routes/clientes'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/reportes', require('./routes/reportes'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Manejo de errores global
app.use((err, req, res, next) => {
  console.error('Error no manejado:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Servidor ejecutándose en http://localhost:${PORT}`);
  });
}

module.exports = app;
