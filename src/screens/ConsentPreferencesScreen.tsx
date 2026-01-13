import React from 'react';
import { View } from 'react-native';
import ConsentModal from '../components/ConsentModal';

const ConsentPreferencesScreen: React.FC<{ navigation: any }> = ({ navigation }) => {
  return (
    <View style={{ flex: 1 }}>
      <ConsentModal
        visible={true}
        onComplete={() => {
          navigation.goBack();
        }}
      />
    </View>
  );
};

export default ConsentPreferencesScreen;
