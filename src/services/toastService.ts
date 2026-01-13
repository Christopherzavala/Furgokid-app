import Toast from 'react-native-toast-message';

type ToastType = 'success' | 'error' | 'info';

const show = (type: ToastType, title: string, message?: string) => {
  Toast.show({
    type,
    text1: title,
    text2: message,
    position: 'bottom',
    visibilityTime: 3500,
  });
};

const toastService = {
  success: (title: string, message?: string) => show('success', title, message),
  error: (title: string, message?: string) => show('error', title, message),
  info: (title: string, message?: string) => show('info', title, message),
};

export default toastService;
