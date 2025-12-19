// useAuth.js - Hook Reutilizable de Autenticación
import { useState, useEffect } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore'; // Firestore imports
import { auth, db } from '../config/firebase'; // Ensure db is exported from firebase config
import { handleFirebaseError } from '../utils/errorHandler';

/**
 * Hook personalizado para gestionar autenticación
 * @returns {Object} - Estado y funciones de autenticación
 */
export const useAuth = () => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        // Listener para cambios en autenticación
        const unsubscribe = onAuthStateChanged(
            auth,
            async (currentUser) => {
                if (currentUser) {
                    // Si hay usuario, buscar su rol en Firestore
                    try {
                        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            // Combinar usuario de Auth con datos de Firestore
                            setUser({ ...currentUser, ...userData });
                        } else {
                            // Si no existe documento (ej: usuario antiguo), tratar como user básico
                            setUser(currentUser);
                        }
                    } catch (err) {
                        // Senior Fix: Check specifically for offline/network errors to avoid red console spam
                        const isOfflineError = err.code === 'unavailable' || err.message.includes('offline');

                        if (isOfflineError) {
                            console.warn("⚠️ Modo Offline detectado: No se pudo verificar el rol en Firestore.");
                            // Fallback seguro: Asumimos rol 'parent' temporalmente y marcamos el flag isOffline
                            setUser({ ...currentUser, role: 'parent', isOffline: true });
                        } else {
                            // Solo logueamos errores críticos reales
                            console.error("Error crítico fetching user role:", err);
                            setUser(currentUser);
                        }
                    }
                } else {
                    setUser(null);
                }
                setLoading(false);
            },
            (error) => {
                setError(handleFirebaseError(error));
                setLoading(false);
            }
        );

        return () => unsubscribe();
    }, []);

    /**
     * Iniciar sesión con email y contraseña
     * @param {string} email
     * @param {string} password
     * @returns {Promise<UserCredential>}
     */
    const login = async (email, password) => {
        setLoading(true);
        setError(null);
        try {
            await signInWithEmailAndPassword(auth, email, password);
            // El listener onAuthStateChanged se encargará de actualizar el estado
            return { success: true };
        } catch (err) {
            const msg = handleFirebaseError(err);
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Crear nueva cuenta con Rol
     * @param {string} email
     * @param {string} password
     * @param {string} role - 'parent' | 'driver'
     * @returns {Promise<UserCredential>}
     */
    const signup = async (email, password, role = 'parent') => {
        setLoading(true);
        setError(null);
        try {
            // 1. Crear usuario en Auth
            const result = await createUserWithEmailAndPassword(auth, email, password);

            // 2. Crear documento de usuario en Firestore
            await setDoc(doc(db, 'users', result.user.uid), {
                email: email,
                role: role,
                createdAt: new Date().toISOString()
            });

            // El listener actualizará el estado
            return { success: true, user: result.user };
        } catch (err) {
            const msg = handleFirebaseError(err);
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Cerrar sesión
     * @returns {Promise<void>}
     */
    const logout = async () => {
        setLoading(true);
        setError(null);
        try {
            await signOut(auth);
            return { success: true };
        } catch (err) {
            const msg = handleFirebaseError(err);
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setLoading(false);
        }
    };

    /**
     * Restablecer contraseña
     * @param {string} email
     * @returns {Promise<void>}
     */
    const resetPassword = async (email) => {
        setLoading(true);
        setError(null);
        try {
            await sendPasswordResetEmail(auth, email);
            return { success: true };
        } catch (err) {
            const msg = handleFirebaseError(err);
            setError(msg);
            return { success: false, error: msg };
        } finally {
            setLoading(false);
        }
    };

    return {
        user,
        loading,
        error,
        isAuthenticated: !!user,
        role: user?.role, // Exponer rol fácilmente
        login,
        signup,
        logout,
        resetPassword
    };
};

export default useAuth;
