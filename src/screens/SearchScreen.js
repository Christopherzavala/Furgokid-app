import { Ionicons } from '@expo/vector-icons';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import AdInterstitialManager from '../components/AdInterstitialManager';
import { db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import analyticsService from '../services/analyticsService';
import toastService from '../services/toastService';

export default function SearchScreen({ navigation }) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [matches, setMatches] = useState([]);
  const [filterZone, setFilterZone] = useState(userProfile?.zone || 'Zona Norte');
  const [filterSchedule, setFilterSchedule] = useState('Mañana');

  const searchSeqRef = useRef(0);

  // Cache por sesión para evitar re-consultar perfiles repetidamente
  const userProfileCacheRef = useRef(new Map());

  // Monetización segura: mostrar interstitial al volver a la app después de contactar
  const appStateRef = useRef(AppState.currentState);
  const pendingPostContactAdRef = useRef(false);
  const lastContactTsRef = useRef(0);

  useEffect(() => {
    const sub = AppState.addEventListener('change', async (nextState) => {
      const prev = appStateRef.current;
      appStateRef.current = nextState;

      // Solo al volver desde background/inactive a active
      const returningToApp =
        (prev === 'background' || prev === 'inactive') && nextState === 'active';
      if (!returningToApp) return;
      if (!pendingPostContactAdRef.current) return;

      // Evita mostrar si el usuario vuelve inmediatamente (ej: canceló abrir WhatsApp)
      if (Date.now() - lastContactTsRef.current < 2500) return;

      pendingPostContactAdRef.current = false;

      try {
        const role = userProfile?.role || 'unknown';
        const elapsedMs = Date.now() - lastContactTsRef.current;
        analyticsService.trackReturnAfterContact(role, elapsedMs);

        const adsDisabled = Boolean(
          userProfile?.isPremium || userProfile?.subscriptionActive || userProfile?.noAds
        );
        const placement = 'INTERSTITIAL_NAV';
        const loaded = await AdInterstitialManager.loadInterstitial(
          placement,
          userProfile?.role,
          adsDisabled
        );
        const shown = Boolean(
          loaded && AdInterstitialManager.isReady() && (await AdInterstitialManager.show())
        );

        analyticsService.trackPostContactAd(placement, {
          adsDisabled,
          loaded: Boolean(loaded),
          shown,
        });
      } catch {
        // no-op
      }
    });

    return () => {
      try {
        sub.remove();
      } catch {
        // no-op
      }
    };
  }, [
    userProfile?.isPremium,
    userProfile?.subscriptionActive,
    userProfile?.noAds,
    userProfile?.role,
  ]);

  const ZONES = useMemo(
    () => ['Zona Norte', 'Zona Sur', 'Zona Oriente', 'Zona Centro', 'Zona Poniente'],
    []
  );
  const SCHEDULES = useMemo(() => ['Mañana', 'Tarde', 'Ambas'], []);

  useEffect(() => {
    // Sincroniza la zona si el perfil llega tarde (evita UI desfasada)
    if (userProfile?.zone && userProfile.zone !== filterZone) {
      setFilterZone(userProfile.zone);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.zone]);

  useEffect(() => {
    let cancelled = false;

    const currentSeq = (searchSeqRef.current += 1);
    const role = userProfile?.role || 'unknown';
    const startedAt = Date.now();
    analyticsService.trackSearchAttempt(role, filterZone, filterSchedule);

    const getCachedUserProfile = async (uid) => {
      if (!uid) return null;
      const cache = userProfileCacheRef.current;
      if (cache.has(uid)) return cache.get(uid);

      try {
        const userDoc = await getDoc(doc(db, 'users', uid));
        const data = userDoc.exists() ? userDoc.data() : null;
        cache.set(uid, data);
        return data;
      } catch {
        cache.set(uid, null);
        return null;
      }
    };

    const run = async () => {
      setLoading(true);
      try {
        let finalMatches = [];

        // Si es PADRE: busca CONDUCTORES
        if (userProfile?.role === 'parent') {
          const q = query(
            collection(db, 'vacancies'),
            where('zone', '==', filterZone),
            where('status', '==', 'active')
          );
          const querySnapshot = await getDocs(q);

          const eligible = querySnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .filter((vacancy) => {
              const scheduleMatch =
                filterSchedule === 'Ambas' ||
                vacancy.schedule === 'Ambas' ||
                vacancy.schedule === filterSchedule;
              return scheduleMatch;
            });

          // Evita N+1 secuencial: cargar perfiles en paralelo
          const userDocs = await Promise.all(
            eligible.map(async (vacancy) => {
              return getCachedUserProfile(vacancy.driverId);
            })
          );

          const matchedVacancies = eligible
            .map((vacancy, index) => ({
              ...vacancy,
              driverData: userDocs[index],
            }))
            .filter((v) => v.driverData);

          finalMatches = matchedVacancies;
        }
        // Si es CONDUCTOR: busca SOLICITUDES DE PADRES
        else if (userProfile?.role === 'driver') {
          const q = query(
            collection(db, 'requests'),
            where('zone', '==', filterZone),
            where('status', '==', 'active')
          );
          const querySnapshot = await getDocs(q);

          const eligible = querySnapshot.docs
            .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() }))
            .filter((request) => {
              const scheduleMatch =
                filterSchedule === 'Ambas' ||
                request.schedule === 'Ambas' ||
                request.schedule === filterSchedule;
              return scheduleMatch;
            });

          const userDocs = await Promise.all(
            eligible.map(async (request) => {
              return getCachedUserProfile(request.parentId);
            })
          );

          const matchedRequests = eligible
            .map((request, index) => ({
              ...request,
              parentData: userDocs[index],
            }))
            .filter((r) => r.parentData);

          finalMatches = matchedRequests;
        }

        if (!cancelled) {
          setMatches(finalMatches);
          // Evita double-log si un effect anterior termina tarde
          if (currentSeq === searchSeqRef.current) {
            analyticsService.trackSearchResults(
              role,
              filterZone,
              filterSchedule,
              finalMatches.length
            );
            analyticsService.trackPerformance('search_fetch', Date.now() - startedAt, {
              screen: 'Search',
              role,
              resultCount: finalMatches.length,
              ok: true,
            });
            if (__DEV__) {
              console.log(
                `[Search] results=${
                  finalMatches.length
                } role=${role} zone=${filterZone} schedule=${filterSchedule} in ${
                  Date.now() - startedAt
                }ms`
              );
            }
          }
        }
      } catch (error) {
        if (cancelled) return;
        console.error('[Search] Error:', error);
        try {
          analyticsService.trackAppError(error?.message || 'Search failed', {
            name: error?.name,
            stack: error?.stack,
            fatal: false,
            tag: 'search',
            action: 'fetch_matches',
          });
          analyticsService.trackPerformance('search_fetch', Date.now() - startedAt, {
            screen: 'Search',
            role,
            ok: false,
          });
        } catch {
          // no-op
        }
        toastService.error('Error', 'No se pudo buscar coincidencias: ' + error.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
    };
  }, [filterZone, filterSchedule, userProfile?.role]);

  const handleContact = async (targetUser) => {
    try {
      // Log evento
      await analyticsService.trackContactInitiated(userProfile?.role, targetUser.uid);

      // Guardar contacto (optional: log para analytics)
      if (__DEV__) {
        console.log(`[Contact] ${userProfile?.role} initiated contact with ${targetUser.uid}`);
      }

      // Abrir WhatsApp
      const whatsappNumber = targetUser.whatsapp?.replace(/\D/g, ''); // Remover caracteres no numéricos
      if (!whatsappNumber) {
        toastService.error('Sin WhatsApp', 'Este usuario no tiene número de WhatsApp disponible.');
        return;
      }

      // Mensaje predeterminado según rol
      let message = '';
      if (userProfile?.role === 'parent') {
        message = encodeURIComponent(
          `Hola! Vi tu perfil en FurgoKid como conductor. Necesito transporte escolar para mis hijos. ¿Tienes disponibilidad?`
        );
      } else {
        message = encodeURIComponent(
          `Hola! Vi tu solicitud en FurgoKid y tengo disponibilidad de transporte escolar. ¿Te interesa?`
        );
      }

      // Abrir WhatsApp (con código de país +56 para Chile)
      const whatsappUrl = `https://wa.me/56${whatsappNumber}?text=${message}`;
      const canOpen = await Linking.canOpenURL(whatsappUrl);

      if (canOpen) {
        // Marcar que al volver a la app podemos monetizar (sin bloquear la llamada)
        lastContactTsRef.current = Date.now();
        pendingPostContactAdRef.current = true;
        await Linking.openURL(whatsappUrl);
      } else {
        Alert.alert(
          'WhatsApp no disponible',
          'Copia el número y abre WhatsApp manualmente: ' + whatsappNumber
        );
      }
    } catch (error) {
      console.error('[Contact] Error:', error);
      toastService.error('Error', 'No se pudo abrir WhatsApp: ' + error.message);
    }
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="search" size={64} color="#ccc" />
      <Text style={styles.emptyTitle}>
        {userProfile?.role === 'parent'
          ? 'No hay conductores disponibles'
          : 'No hay solicitudes disponibles'}
      </Text>
      <Text style={styles.emptySubtitle}>Intenta cambiar la zona o el horario de búsqueda</Text>
    </View>
  );

  const renderMatchCard = (item) => {
    const isParent = userProfile?.role === 'parent';
    const targetUser = isParent ? item.driverData : item.parentData;

    if (!targetUser) {
      return null; // Skip si no hay datos del usuario
    }

    return (
      <View key={item.id} style={styles.card}>
        {/* Header con nombre y rating */}
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardName}>{targetUser.displayName || 'Sin nombre'}</Text>
            <View style={styles.ratingContainer}>
              <Ionicons name="star" size={14} color="#FFC107" />
              <Text style={styles.ratingText}>4.5 (12)</Text>
            </View>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{isParent ? 'Conductor' : 'Padre'}</Text>
          </View>
        </View>

        {/* Detalles */}
        {isParent ? (
          // Card para CONDUCTOR (visto por padre)
          <>
            <View style={styles.detailRow}>
              <Ionicons name="car" size={16} color="#2196F3" />
              <Text style={styles.detailText}>
                {item.vehicleModel} · {item.licensePlate}
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="people" size={16} color="#2196F3" />
              <Text style={styles.detailText}>
                {item.availableSeats} de {item.totalSeats} asientos disponibles
              </Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#2196F3" />
              <Text style={styles.detailText}>{item.schedule}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="school" size={16} color="#2196F3" />
              <Text style={styles.detailText} numberOfLines={2}>
                {item.schools.join(', ')}
              </Text>
            </View>
          </>
        ) : (
          // Card para SOLICITUD DE PADRE (visto por conductor)
          <>
            <View style={styles.detailRow}>
              <Ionicons name="school" size={16} color="#2196F3" />
              <Text style={styles.detailText}>{item.school}</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="people" size={16} color="#2196F3" />
              <Text style={styles.detailText}>{item.childrenCount} niño(s)</Text>
            </View>
            <View style={styles.detailRow}>
              <Ionicons name="time" size={16} color="#2196F3" />
              <Text style={styles.detailText}>{item.schedule}</Text>
            </View>
            {item.specialNeeds && (
              <View style={styles.detailRow}>
                <Ionicons name="alert-circle" size={16} color="#FF9800" />
                <Text style={styles.detailText}>{item.specialNeeds}</Text>
              </View>
            )}
          </>
        )}

        {/* Button */}
        <TouchableOpacity
          style={styles.contactButton}
          onPress={() => handleContact(targetUser)}
          accessible={true}
          accessibilityLabel="Contactar por WhatsApp"
          accessibilityRole="button"
          accessibilityHint="Abre WhatsApp para contactar a este usuario"
        >
          <Ionicons name="logo-whatsapp" size={20} color="#fff" />
          <Text style={styles.contactButtonText}>Contactar por WhatsApp</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {userProfile?.role === 'parent' ? '🚗 Conductores' : '👨‍👩‍👧 Solicitudes'}
        </Text>
      </View>

      {/* Filtros */}
      <View style={styles.filterContainer}>
        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Zona</Text>
          <View style={styles.filterPicker}>
            {ZONES.map((z) => (
              <TouchableOpacity
                key={z}
                style={[styles.filterButton, filterZone === z && styles.filterButtonActive]}
                onPress={() => setFilterZone(z)}
                accessible={true}
                accessibilityLabel={`Filtrar por ${z}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: filterZone === z }}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterZone === z && styles.filterButtonTextActive,
                  ]}
                >
                  {z.replace('Zona ', '')}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.filterGroup}>
          <Text style={styles.filterLabel}>Horario</Text>
          <View style={styles.filterPicker}>
            {SCHEDULES.map((s) => (
              <TouchableOpacity
                key={s}
                style={[styles.filterButton, filterSchedule === s && styles.filterButtonActive]}
                onPress={() => setFilterSchedule(s)}
                accessible={true}
                accessibilityLabel={`Filtrar por horario ${s}`}
                accessibilityRole="radio"
                accessibilityState={{ checked: filterSchedule === s }}
              >
                <Text
                  style={[
                    styles.filterButtonText,
                    filterSchedule === s && styles.filterButtonTextActive,
                  ]}
                >
                  {s}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>

      {/* Results */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2196F3" />
        </View>
      ) : matches.length === 0 ? (
        renderEmptyState()
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => renderMatchCard(item)}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  filterContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterGroup: {
    marginBottom: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
    marginBottom: 8,
  },
  filterPicker: {
    flexDirection: 'row',
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 20,
    backgroundColor: '#f9f9f9',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterButtonText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    paddingBottom: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 15,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#333',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  ratingText: {
    fontSize: 12,
    color: '#666',
  },
  badge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#2196F3',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  detailText: {
    fontSize: 13,
    color: '#555',
    flex: 1,
  },
  contactButton: {
    flexDirection: 'row',
    backgroundColor: '#25D366',
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
    gap: 8,
  },
  contactButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
