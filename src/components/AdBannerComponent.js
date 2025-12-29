import { getAdUnitId } from '../config/AdMobConfig';
import { AdBanner } from './AdBanner';

/**
 * AdBannerComponent - Componente reutilizable para mostrar banners AdMob
 * Uso: <AdBannerComponent placement="home" size="BANNER" />
 */
const AdBannerComponent = ({
  placement = 'BANNER_HOME',
  userRole = 'parent',
  adsDisabled = false,
}) => {
  if (adsDisabled) return null;

  const adUnitId = getAdUnitId(placement, userRole);

  // Si no hay Ad Unit ID, no mostrar nada
  if (!adUnitId) {
    return null;
  }

  return <AdBanner unitId={adUnitId} screenName={placement} />;
};

export default AdBannerComponent;
