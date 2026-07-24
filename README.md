# Surtidor v2 - Sistema de Gestión de Combustible

Sistema de gestión para surtidores de distribución de combustible, desarrollado como PWA (Progressive Web App).

## Tecnologías

- **Frontend**: Vite + JavaScript (Vanilla), Chart.js, PWA
- **Backend**: Node.js + Express
- **Base de datos**: Supabase (PostgreSQL)

## Estructura del Proyecto

```
surtidor_v2/
├── backend/           # API REST (Node.js + Express)
│   ├── src/
│   │   ├── config/    # Configuración de Supabase
│   │   ├── middleware/# Autenticación JWT
│   │   ├── routes/    # Endpoints por módulo
│   │   └── server.js  # Entry point
│   └── .env           # Variables de entorno
├── frontend/          # PWA (Vite + Vanilla JS)
│   ├── public/        # Manifest, Service Worker, iconos
│   ├── src/
│   │   ├── css/       # Estilos
│   │   └── js/        # Lógica de la aplicación
│   │       ├── pages/ # Páginas del sistema
│   │       └── ...    # Router, API client, Auth
│   └── index.html     # Shell de la aplicación
└── database/
    └── schema.sql     # Esquema de base de datos
```

## Instalación

### 1. Base de Datos
Ejecutar el archivo `database/schema.sql` en tu proyecto de Supabase (SQL Editor).

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env   # Configurar credenciales
npm run dev
```

### 3. Frontend
```bash
cd frontend
npm install
npm run dev
```

El frontend se ejecuta en `http://localhost:5173` y el backend en `http://localhost:3000`.

## Módulos

| Módulo | Funcionalidad |
|--------|---------------|
| Dashboard | KPIs, estado de surtidores, alertas activas |
| Surtidores | CRUD con niveles binarios (00, 01, 10, 11) |
| Ventas | Registro con descuento automático de inventario |
| Alertas | Monitoreo de niveles bajo y crítico |
| Combustibles | Gestión de tipos con código binario |
| Vehículos | Registro de vehículos |
| Clientes | Registro con tipo de documento |
| Usuarios | Gestión de usuarios y roles (admin) |
| Reportes | Ventas diarias, inventario, ingresos por combustible |

## Roles

- **Administrador**: Acceso total (CRUD completo, gestión de usuarios)
- **Despachador**: Registro de ventas, consulta de inventario

## Relación con Sistemas Digitales

- Sensores de nivel: representados en binario (00=vacío, 01=25%, 10=50%, 11=100%)
- Alertas: diseñadas con lógica de compuertas (bajo=LED amarillo, crítico=LED rojo)
- Tipos de combustible: codificados con decodificador binario de 2 bits
