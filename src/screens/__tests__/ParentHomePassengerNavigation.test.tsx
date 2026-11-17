import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import ParentHomeScreen from '../ParentHomeScreen';

jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('expo-linear-gradient', () => ({
  LinearGradient: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'adult-synthetic', email: 'adult@example.invalid' },
    userProfile: { role: 'parent' },
    signOut: jest.fn(),
  }),
}));
jest.mock('../../services/matchTrackingService', () => ({
  getActiveParentMatches: jest.fn(() => Promise.resolve([])),
}));
jest.mock('../../components/AdBannerComponent', () => () => null);
jest.mock('../../components/EmptyState', () => () => null);

describe('ParentHome passenger navigation', () => {
  it('opens the authenticated passenger authorization route', async () => {
    const navigation = { navigate: jest.fn() };
    const screen = render(<ParentHomeScreen navigation={navigation} />);
    const entry = await screen.findByRole('button', {
      name: 'Administrar pasajeros y autorizaciones',
    });
    fireEvent.press(entry);
    await waitFor(() =>
      expect(navigation.navigate).toHaveBeenCalledWith('PassengerAuthorizations')
    );
  });
});
