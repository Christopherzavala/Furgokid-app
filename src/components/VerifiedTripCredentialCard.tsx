/**
 * Verified Trip Credential Card Component
 *
 * Displays high-clarity verification details for the active trip driver:
 * - Driver photo, name, vehicle plate, last verification date
 * - Green shield checklists for Professional License, Background Check, and Child Inability Registry
 * - Distinctive badge for Rental or Substitute drivers
 * - Blocking alert state if driver is unverified
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface VerifiedChecks {
  professionalLicense?: boolean | { status?: string };
  criminalRecord?: boolean | { status?: string };
  childInabilityRegistry?: boolean | { status?: string };
}

interface ActiveDriverSnapshot {
  displayName?: string;
  name?: string;
  photoURL?: string;
  photo?: string;
  plate?: string;
  assignmentType?: 'owner' | 'rental' | 'substitute';
  verifiedChecks?: VerifiedChecks;
  verifiedAt?: string;
  validUntil?: string;
}

interface VerifiedTripCredentialCardProps {
  activeDriver?: ActiveDriverSnapshot | null;
  isVerified?: boolean;
}

const isCheckValid = (check: boolean | { status?: string } | undefined): boolean => {
  if (typeof check === 'boolean') return check;
  if (check && typeof check === 'object') {
    return (
      check.status === 'verified' ||
      (check as any).status === 'VERIFIED' ||
      (check as any).status === true
    );
  }
  return false;
};

export const VerifiedTripCredentialCard: React.FC<VerifiedTripCredentialCardProps> = ({
  activeDriver,
  isVerified = true,
}) => {
  if (!activeDriver || !isVerified) {
    return (
      <View style={[styles.card, styles.alertCard]}>
        <View style={styles.headerRow}>
          <Ionicons name="warning" size={24} color="#D9534F" />
          <Text style={styles.alertTitle}>Conductor no verificado o ausente</Text>
        </View>
        <Text style={styles.alertMessage}>
          Este viaje no cuenta actualmente con un conductor verificado asignado. Por seguridad,
          comunícate con la central de operaciones.
        </Text>
      </View>
    );
  }

  const driverName = activeDriver.displayName || activeDriver.name || 'Conductor Titular';
  const driverPhoto = activeDriver.photoURL || activeDriver.photo;
  const plate = activeDriver.plate || '---';
  const assignmentType = activeDriver.assignmentType || 'owner';
  const verifiedAt = activeDriver.verifiedAt
    ? new Date(activeDriver.verifiedAt).toLocaleDateString()
    : 'Reciente';

  const checks = activeDriver.verifiedChecks || {};
  const licenseOk = isCheckValid(checks.professionalLicense);
  const criminalOk = isCheckValid(checks.criminalRecord);
  const inabilityOk = isCheckValid(checks.childInabilityRegistry);

  const assignmentLabel =
    assignmentType === 'rental'
      ? 'Conductor Arrendatario Verificado para este turno'
      : assignmentType === 'substitute'
      ? 'Conductor de Reemplazo Verificado para este turno'
      : 'Conductor Titular Verificado';

  return (
    <View style={styles.card}>
      <View style={styles.topContainer}>
        {driverPhoto ? (
          <Image source={{ uri: driverPhoto }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.placeholderAvatar]}>
            <Ionicons name="person" size={28} color="#666" />
          </View>
        )}
        <View style={styles.driverInfo}>
          <Text style={styles.driverName}>{driverName}</Text>
          <Text style={styles.plateText}>
            Patente furgón: <Text style={styles.plateBold}>{plate}</Text>
          </Text>
          <Text style={styles.verifiedDateText}>Verificado el: {verifiedAt}</Text>
        </View>
      </View>

      {assignmentType !== 'owner' && (
        <View style={styles.badgeBanner}>
          <Ionicons name="swap-horizontal" size={16} color="#fff" />
          <Text style={styles.badgeText}>{assignmentLabel}</Text>
        </View>
      )}

      <View style={styles.checklistContainer}>
        <View style={styles.checkItem}>
          <Ionicons
            name={licenseOk ? 'shield-checkmark' : 'close-circle'}
            size={18}
            color={licenseOk ? '#28A745' : '#D9534F'}
          />
          <Text style={styles.checkText}>Licencia Profesional A1/A3</Text>
        </View>

        <View style={styles.checkItem}>
          <Ionicons
            name={criminalOk ? 'shield-checkmark' : 'close-circle'}
            size={18}
            color={criminalOk ? '#28A745' : '#D9534F'}
          />
          <Text style={styles.checkText}>Certificado de Antecedentes</Text>
        </View>

        <View style={styles.checkItem}>
          <Ionicons
            name={inabilityOk ? 'shield-checkmark' : 'close-circle'}
            size={18}
            color={inabilityOk ? '#28A745' : '#D9534F'}
          />
          <Text style={styles.checkText}>Registro Inhabilidades Menores</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  alertCard: {
    borderLeftWidth: 5,
    borderLeftColor: '#D9534F',
    backgroundColor: '#FFF5F5',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  alertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#D9534F',
    marginLeft: 8,
  },
  alertMessage: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
  },
  topContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#eee',
  },
  placeholderAvatar: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  driverInfo: {
    flex: 1,
    marginLeft: 16,
  },
  driverName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#222',
  },
  plateText: {
    fontSize: 14,
    color: '#555',
    marginTop: 2,
  },
  plateBold: {
    fontWeight: 'bold',
    color: '#000',
  },
  verifiedDateText: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  badgeBanner: {
    flexDirection: 'row',
    backgroundColor: '#FF6B35',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 12,
  },
  badgeText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  checklistContainer: {
    marginTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 10,
  },
  checkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  checkText: {
    fontSize: 13,
    color: '#444',
    marginLeft: 8,
  },
});

export default VerifiedTripCredentialCard;
