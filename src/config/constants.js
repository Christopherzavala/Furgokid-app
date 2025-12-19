// constants.js - Constantes Centralizadas del Proyecto

// ============================================
// COLORES DE LA APLICACIÓN
// ============================================
export const COLORS = {
    // Colores principales
    primary: '#2196F3',
    primaryDark: '#1976D2',
    primaryLight: '#BBDEFB',

    // Colores secundarios
    secondary: '#FF9800',
    accent: '#4CAF50',

    // Estados
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',

    // Grises
    background: '#F5F5F5',
    surface: '#FFFFFF',
    divider: '#E0E0E0',

    // Textos
    textPrimary: '#212121',
    textSecondary: '#757575',
    textDisabled: '#BDBDBD',
    textWhite: '#FFFFFF',

    // Transparencias
    overlay: 'rgba(0, 0, 0, 0.5)',
    cardShadow: 'rgba(0, 0, 0, 0.1)',
};

// ============================================
// TAMAÑOS Y ESPACIADOS
// ============================================
export const SIZES = {
    // Padding y márgenes
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,

    // Tamaños de fuente
    fontXS: 12,
    fontSM: 14,
    fontMD: 16,
    fontLG: 18,
    fontXL: 24,
    fontXXL: 32,

    // Border radius
    radiusSM: 8,
    radiusMD: 12,
    radiusLG: 16,
    radiusXL: 24,
    radiusRound: 999,

    // Iconos
    iconSM: 20,
    iconMD: 24,
    iconLG: 32,
    iconXL: 48,
};

// ============================================
// CONFIGURACIÓN DE FIREBASE
// ============================================
export const FIREBASE = {
    // Colecciones
    collections: {
        USERS: 'users',
        PARENTS: 'parents',
        DRIVERS: 'drivers',
        VEHICLES: 'vehicles',
        LOCATIONS: 'locations',
        CHILDREN: 'children',
        NOTIFICATIONS: 'notifications',
    },

    // Configuración de Storage
    storage: {
        AVATARS: 'avatars',
        VEHICLES: 'vehicles',
        DOCUMENTS: 'documents',
    },
};

// ============================================
// CONFIGURACIÓN DE UBICACIÓN
// ============================================
export const LOCATION = {
    // Intervalos de actualización (milisegundos)
    updateInterval: 30000, // 30 segundos
    fastUpdateInterval: 10000, // 10 segundos
    slowUpdateInterval: 60000, // 1 minuto

    // Filtros de distancia (metros)
    distanceFilter: 50, // 50 metros
    fastDistanceFilter: 20, // 20 metros
    slowDistanceFilter: 100, // 100 metros

    // Precisión
    accuracy: {
        HIGH: 'high',
        BALANCED: 'balanced',
        LOW: 'low',
    },
};

// ============================================
// CONFIGURACIÓN DE MAPA
// ============================================
export const MAP = {
    // Región por defecto (Santiago, Chile - ajustar según tu ubicación)
    defaultRegion: {
        latitude: -33.4489,
        longitude: -70.6693,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
    },

    // Estilos de mapa
    mapTypes: {
        STANDARD: 'standard',
        SATELLITE: 'satellite',
        HYBRID: 'hybrid',
        TERRAIN: 'terrain',
    },

    // Zoom levels
    zoom: {
        CITY: 0.05,
        NEIGHBORHOOD: 0.01,
        STREET: 0.005,
        BUILDING: 0.001,
    },
};

// ============================================
// TIPOS DE USUARIO
// ============================================
export const USER_TYPES = {
    PARENT: 'parent',
    DRIVER: 'driver',
    ADMIN: 'admin',
};

// ============================================
// ESTADOS DE VIAJE
// ============================================
export const TRIP_STATUS = {
    PENDING: 'pending',       // Pendiente
    ON_ROUTE: 'onRoute',      // En ruta
    ARRIVED: 'arrived',       // Llegó
    COMPLETED: 'completed',   // Completado
    CANCELLED: 'cancelled',   // Cancelado
};

// ============================================
// TIPOS DE NOTIFICACIÓN
// ============================================
export const NOTIFICATION_TYPES = {
    TRIP_STARTED: 'trip_started',
    TRIP_ARRIVED: 'trip_arrived',
    TRIP_DELAYED: 'trip_delayed',
    EMERGENCY: 'emergency',
    GENERAL: 'general',
};

// ============================================
// MENSAJES DE ERROR
// ============================================
export const ERROR_MESSAGES = {
    // Autenticación
    AUTH_INVALID_EMAIL: 'El email es inválido',
    AUTH_USER_NOT_FOUND: 'No existe una cuenta con este email',
    AUTH_WRONG_PASSWORD: 'Contraseña incorrecta',
    AUTH_WEAK_PASSWORD: 'La contraseña es muy débil',
    AUTH_EMAIL_ALREADY_IN_USE: 'Este email ya está registrado',

    // Ubicación
    LOCATION_PERMISSION_DENIED: 'Permisos de ubicación denegados',
    LOCATION_UNAVAILABLE: 'No se pudo obtener la ubicación',

    // Red
    NETWORK_ERROR: 'Error de conexión. Verifica tu internet',

    // General
    UNKNOWN_ERROR: 'Ha ocurrido un error desconocido',
};

// ============================================
// VALIDACIONES
// ============================================
export const VALIDATION = {
    // Email
    emailRegex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,

    // Contraseña
    minPasswordLength: 6,
    maxPasswordLength: 128,

    // Nombres
    minNameLength: 2,
    maxNameLength: 50,

    // Teléfono (Chile - ajustar según país)
    phoneRegex: /^\+?56?[0-9]{9}$/,
};

// ============================================
// LÍMITES Y CUOTAS
// ============================================
export const LIMITS = {
    maxChildren: 10,          // Máximo de hijos por padre
    maxVehicles: 5,           // Máximo de vehículos
    maxNotifications: 100,    // Máximo de notificaciones guardadas
    locationHistoryDays: 30,  // Días de historial de ubicación
};

// ============================================
// URLs Y ENDPOINTS
// ============================================
export const URLS = {
    privacyPolicy: 'https://furgokid.com/privacy',
    termsOfService: 'https://furgokid.com/terms',
    support: 'https://furgokid.com/support',
    website: 'https://furgokid.com',
};

// ============================================
// CONFIGURACIÓN DE LA APP
// ============================================
export const APP = {
    name: 'FurgoKid',
    version: '1.0.0',
    buildNumber: 1,
    supportEmail: 'support@furgokid.com',
    supportPhone: '+56912345678', // Ajustar
};

export default {
    COLORS,
    SIZES,
    FIREBASE,
    LOCATION,
    MAP,
    USER_TYPES,
    TRIP_STATUS,
    NOTIFICATION_TYPES,
    ERROR_MESSAGES,
    VALIDATION,
    LIMITS,
    URLS,
    APP,
};
