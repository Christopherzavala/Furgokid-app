# 🧹 Linting & Code Quality - Quick Reference

## 🔧 Herramientas Configuradas

### **ESLint** (JavaScript/Functions)

- Config: `functions/.eslintrc.json`
- Extensiones: `eslint-config-google`
- Reglas personalizadas para Firebase Functions

### **Prettier** (Formateo automático)

- Config: `.prettierrc`
- Formato consistente en todo el proyecto
- Integrado con ESLint (sin conflictos)

---

## 🚀 Comandos Rápidos

### **Lint Functions**

```powershell
cd functions
npm run lint

# Auto-fix
npm run lint -- --fix
```

### **Format Code (Prettier)**

```powershell
# Formatear todo el proyecto
npx prettier --write .

# Solo archivos específicos
npx prettier --write "src/**/*.js"

# Check sin modificar
npx prettier --check .
```

### **Pre-commit Hook (Recomendado)**

```powershell
# Instalar husky
npm install --save-dev husky lint-staged

# Configurar en package.json:
{
  "lint-staged": {
    "*.js": ["prettier --write", "eslint --fix"],
    "*.{json,md}": ["prettier --write"]
  }
}
```

---

## 📋 Reglas Clave

### **ESLint (Functions)**

- ✅ No usar `var` (usar `const`/`let`)
- ✅ Preferir arrow functions
- ✅ Single quotes para strings
- ✅ No variables sin usar
- ✅ Nombres de variables descriptivos

### **Prettier**

- Semi-colon: ✅ Sí
- Single quotes: ✅ Sí
- Trailing comma: ✅ ES5
- Tab width: 2 espacios
- Print width: 100 caracteres

---

## 🔍 VSCode Integration

**Instalar extensiones:**

1. ESLint (dbaeumer.vscode-eslint)
2. Prettier (esbenp.prettier-vscode)

**Settings (`.vscode/settings.json`):**

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "[javascript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

---

## ✅ Best Practices

### **Antes de commitear:**

```powershell
# 1. Formatear código
npx prettier --write .

# 2. Lint Functions
cd functions
npm run lint -- --fix

# 3. Run tests
npm test

# 4. Commit
git add .
git commit -m "feat: add feature"
```

### **CI/CD automático:**

- GitHub Actions ejecuta lint en cada push
- PRs deben pasar lint antes de merge
- Ver: `.github/workflows/ci-cd.yml`

---

## 🐛 Troubleshooting

**Error: "Parsing error"**

```powershell
# Reinstalar dependencies
cd functions
rm -rf node_modules
npm install
```

**Error: "Prettier conflicts with ESLint"**

```powershell
# Instalar plugin de integración
npm install --save-dev eslint-config-prettier
```

**Error: "Command not found: prettier"**

```powershell
# Instalar Prettier globalmente
npm install -g prettier

# O usar npx
npx prettier --version
```

---

## 📚 Referencias

- [ESLint Rules](https://eslint.org/docs/rules/)
- [Prettier Options](https://prettier.io/docs/en/options.html)
- [Google JavaScript Style Guide](https://google.github.io/styleguide/jsguide.html)
