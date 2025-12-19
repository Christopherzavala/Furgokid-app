/**
 * Utilitario para manejo centralizado de errores
 */
import { Alert } from 'react-native';

export const handleFirebaseError = (error) => {
    let message = 'Ha ocurrido un error desconocido.';

    if (error.code) {
        switch (error.code) {
            case 'auth/user-not-found':
            case 'auth/wrong-password':
                message = 'Credenciales incorrectas. Verifique su correo y contraseña.';
                break;
            case 'auth/email-already-in-use':
                message = 'El correo electrónico ya está registrado.';
                break;
            case 'auth/invalid-email':
                message = 'El formato del correo electrónico no es válido.';
                break;
            case 'auth/weak-password':
                message = 'La contraseña debe tener al menos 6 caracteres.';
                break;
            case 'auth/network-request-failed':
            case 'unavailable':
            case 'client-offline':
                message = 'Sin conexión. Revisa tu internet y vuelve a intentar.';
                break;
            case 'permission-denied':
                message = 'No tienes permisos para realizar esta acción.';
                break;
            default:
                message = `Error: ${error.message} (${error.code})`;
        }
    } else if (error.message) {
        message = error.message;
    }

    return message;
};

export const showErrorAlert = (title, error) => {
    const message = handleFirebaseError(error);
    Alert.alert(title, message, [{ text: 'OK' }]);
};
