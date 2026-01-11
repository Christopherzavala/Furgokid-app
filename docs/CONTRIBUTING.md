# Contributing to FurgoKid

¡Gracias por tu interés en contribuir a FurgoKid! 🎉

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Commit Guidelines](#commit-guidelines)
- [Pull Request Process](#pull-request-process)
- [Testing Requirements](#testing-requirements)

---

## 📜 Code of Conduct

Este proyecto sigue el [Contributor Covenant Code of Conduct](https://www.contributor-covenant.org/).
Esperamos que todos los contribuidores sean respetuosos y profesionales.

---

## 🚀 Getting Started

### Requisitos Previos

- Node.js 18+
- npm 9+
- Expo CLI
- Git

### Setup Local

```bash
# 1. Fork el repositorio en GitHub

# 2. Clonar tu fork
git clone https://github.com/TU_USUARIO/Furgokid-app.git
cd Furgokid-app

# 3. Agregar upstream remote
git remote add upstream https://github.com/Christopherzavala/Furgokid-app.git

# 4. Instalar dependencias
npm install

# 5. Copiar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de desarrollo

# 6. Iniciar servidor
npm start
```

---

## 🔄 Development Workflow

### Branch Strategy

```
main                    # Producción (protected)
  ├── develop           # Integración (protected)
      ├── feature/XXX   # Nuevas features
      ├── fix/XXX       # Bug fixes
      ├── hotfix/XXX    # Hotfixes urgentes
      └── docs/XXX      # Documentación
```

### Crear una Branch

```bash
# Actualizar develop
git checkout develop
git pull upstream develop

# Crear feature branch
git checkout -b feature/nombre-descriptivo

# Ejemplo:
git checkout -b feature/add-real-time-notifications
git checkout -b fix/login-button-crash
git checkout -b docs/update-readme
```

### Naming Conventions

**Branches**:

- `feature/descripcion-corta` - Nuevas funcionalidades
- `fix/descripcion-del-bug` - Correcciones
- `hotfix/critical-issue` - Fixes urgentes para producción
- `docs/tema` - Cambios de documentación
- `refactor/componente` - Refactorización sin cambio funcional
- `test/componente` - Agregar/mejorar tests

**Commits**:
Seguimos [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types**:

- `feat`: Nueva feature
- `fix`: Bug fix
- `docs`: Documentación
- `style`: Formato (sin cambio de código)
- `refactor`: Refactorización
- `test`: Agregar tests
- `chore`: Mantenimiento (deps, build, etc)
- `perf`: Mejora de performance
- `ci`: Cambios en CI/CD

**Ejemplos**:

```bash
feat(auth): add biometric login support

Implemented fingerprint/FaceID authentication for iOS and Android.
Uses expo-local-authentication module.

Closes #123

---

fix(maps): resolve marker clustering crash

Fixed memory leak in TrackingMap component when unmounting
with 100+ active markers.

Fixes #456

---

docs(readme): update setup instructions

Added troubleshooting section for common Firebase errors.
```

---

## 🎨 Coding Standards

### TypeScript/JavaScript

```typescript
// ✅ GOOD
interface UserProfile {
  id: string;
  name: string;
  email: string;
}

const getUserById = async (userId: string): Promise<UserProfile> => {
  const doc = await firestore.collection('users').doc(userId).get();
  return doc.data() as UserProfile;
};

// ❌ BAD
const getUser = async (id) => {
  const doc = await firestore.collection('users').doc(id).get();
  return doc.data();
};
```

### Naming Conventions

- **Components**: PascalCase (`UserProfile.tsx`)
- **Files**: camelCase (`authService.ts`)
- **Constants**: UPPER_SNAKE_CASE (`API_BASE_URL`)
- **Functions**: camelCase (`fetchUserData`)
- **Interfaces/Types**: PascalCase (`UserProfile`)

### File Structure

```typescript
// 1. Imports (agrupados)
import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { firestore } from '@/config/firebase';

// 2. Types/Interfaces
interface Props {
  userId: string;
}

// 3. Constants
const DEFAULT_TIMEOUT = 5000;

// 4. Component
const MyComponent: React.FC<Props> = ({ userId }) => {
  // 4a. Hooks
  const [loading, setLoading] = useState(false);

  // 4b. Effects
  useEffect(() => {
    // ...
  }, []);

  // 4c. Handlers
  const handlePress = () => {
    // ...
  };

  // 4d. Render
  return (
    <View>
      <Text>Hello</Text>
    </View>
  );
};

// 5. Export
export default MyComponent;
```

### ESLint Rules

Corremos ESLint con **0 warnings**:

```bash
npm run lint        # Check
npm run lint:fix    # Auto-fix
```

### Prettier

Formateamos con Prettier:

```bash
npm run format        # Auto-format
npm run format:check  # Verify
```

---

## ✅ Testing Requirements

### Requisitos Mínimos

- ✅ Unit tests para servicios nuevos
- ✅ Integration tests para flujos críticos
- ✅ TypeScript sin errores
- ✅ 0 ESLint warnings

```bash
# Correr tests
npm test

# Coverage
npm run test:coverage

# Type check
npm run type-check

# Validación completa
npm run validate
```

### Test Structure

```typescript
// src/services/__tests__/myService.test.ts

describe('MyService', () => {
  beforeEach(() => {
    // Setup
  });

  describe('methodName', () => {
    it('should do something correctly', async () => {
      // Arrange
      const input = 'test';

      // Act
      const result = await myService.methodName(input);

      // Assert
      expect(result).toBe('expected');
    });

    it('should handle errors gracefully', async () => {
      // Test error scenarios
    });
  });
});
```

---

## 🔀 Pull Request Process

### Antes de Crear PR

```bash
# 1. Asegurar que develop está actualizado
git checkout develop
git pull upstream develop

# 2. Rebase tu branch
git checkout feature/mi-feature
git rebase develop

# 3. Correr validaciones
npm run validate

# 4. Correr tests
npm test

# 5. Push
git push origin feature/mi-feature
```

### Crear el PR

1. **Título**: Descriptivo y claro

   ```
   feat(auth): Add biometric login support
   fix(maps): Resolve marker clustering crash
   ```

2. **Descripción**: Usar template

```markdown
## 📝 Descripción

Breve descripción de los cambios

## 🎯 Motivación

Por qué es necesario este cambio

## 🧪 Testing

Cómo se testeó (manual + automated)

## 📸 Screenshots (si aplica)

[Agregar imágenes]

## ✅ Checklist

- [ ] Tests agregados/actualizados
- [ ] Documentación actualizada
- [ ] `npm run validate` pasa
- [ ] Sin merge conflicts
- [ ] Branch actualizado con develop
```

### Review Process

- **Mínimo**: 1 approval requerido
- **CI/CD**: Debe pasar todos los checks
- **Changes Requested**: Resolver todos los comentarios

### Merge Strategy

- **Feature branches**: Squash and merge
- **Hotfixes**: Merge commit
- **Release branches**: Merge commit

---

## 📚 Documentation

### Cuándo Actualizar Docs

- ✅ Nueva feature: Agregar en README + docs específico
- ✅ API change: Actualizar JSDoc/TSDoc
- ✅ Breaking change: Actualizar CHANGELOG
- ✅ Configuración nueva: Actualizar .env.example

### JSDoc Example

````typescript
/**
 * Fetches user profile from Firestore
 *
 * @param userId - The unique user identifier
 * @returns Promise resolving to user profile data
 * @throws {Error} If user not found or network error
 *
 * @example
 * ```typescript
 * const profile = await getUserProfile('user123');
 * console.log(profile.name);
 * ```
 */
const getUserProfile = async (userId: string): Promise<UserProfile> => {
  // Implementation
};
````

---

## 🐛 Bug Reports

### Template para Issues

```markdown
**Descripción del Bug**
Descripción clara del problema

**Pasos para Reproducir**

1. Ir a '...'
2. Hacer click en '...'
3. Ver error

**Comportamiento Esperado**
Qué debería pasar

**Comportamiento Actual**
Qué pasa actualmente

**Screenshots**
Si aplica

**Entorno**

- OS: [ej. iOS 17.1, Android 14]
- Dispositivo: [ej. iPhone 15, Pixel 8]
- App Version: [ej. 1.0.0]
- Expo SDK: [ej. 54]

**Logs**
```

Pegar logs relevantes

```

**Adicional**
Cualquier contexto adicional
```

---

## 🎁 Feature Requests

### Template

```markdown
**Problema que Resuelve**
Descripción del problema/necesidad

**Solución Propuesta**
Cómo debería funcionar

**Alternativas Consideradas**
Otras opciones evaluadas

**Contexto Adicional**
Screenshots, ejemplos, referencias
```

---

## ❓ Questions?

- **Slack**: #furgokid-dev (si existe)
- **GitHub Discussions**: Para preguntas generales
- **Email**: dev@furgokid.app

---

## 🏆 Contributors

Agradecemos a todos los contribuidores:

<!-- ALL-CONTRIBUTORS-LIST:START -->
<!-- Automatizado con all-contributors -->
<!-- ALL-CONTRIBUTORS-LIST:END -->

---

## 📄 License

Al contribuir, aceptas que tus contribuciones sean licenciadas bajo la misma licencia del proyecto.

---

**¡Gracias por contribuir a FurgoKid!** 🚀
