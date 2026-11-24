import React from 'react';
import { render } from '@testing-library/react-native';
import { VerifiedTripCredentialCard } from '../VerifiedTripCredentialCard';

jest.mock('@expo/vector-icons', () => ({
  Ionicons: 'Ionicons',
}));

describe('VerifiedTripCredentialCard Component', () => {
  test('renders unverified or missing driver alert state', () => {
    const { getByText } = render(
      <VerifiedTripCredentialCard activeDriver={null} isVerified={false} />
    );
    expect(getByText('Conductor no verificado o ausente')).toBeTruthy();
  });

  test('renders owner driver credentials and green checkmarks', () => {
    const driver = {
      displayName: 'Juan Pérez',
      plate: 'ABCD12',
      assignmentType: 'owner' as const,
      verifiedChecks: {
        professionalLicense: { status: 'verified' },
        criminalRecord: { status: 'verified' },
        childInabilityRegistry: { status: 'verified' },
      },
      verifiedAt: '2026-11-24T12:00:00Z',
    };
    const { getByText } = render(
      <VerifiedTripCredentialCard activeDriver={driver} isVerified={true} />
    );
    expect(getByText('Juan Pérez')).toBeTruthy();
    expect(getByText('ABCD12')).toBeTruthy();
    expect(getByText('Licencia Profesional A1/A3')).toBeTruthy();
  });

  test('renders rental or substitute driver banner', () => {
    const driver = {
      displayName: 'Carlos Soto',
      plate: 'XYZ987',
      assignmentType: 'rental' as const,
      verifiedChecks: {
        professionalLicense: true,
        criminalRecord: true,
        childInabilityRegistry: true,
      },
    };
    const { getByText } = render(
      <VerifiedTripCredentialCard activeDriver={driver} isVerified={true} />
    );
    expect(getByText('Conductor Arrendatario Verificado para este turno')).toBeTruthy();
  });
});
