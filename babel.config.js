// babel.config.js - Configuración de Babel Optimizada para FurgoKid
module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      'react-native-reanimated/plugin', // Reanimated debe ir al final
    ],
  };
};