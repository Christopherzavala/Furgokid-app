import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export const requestDriverApproval = async () => {
  const requestCallable = httpsCallable(functions, 'requestDriverApproval');
  const result = await requestCallable();
  return result.data;
};

export const reviewDriverRequest = async ({ targetUid, decision }) => {
  const reviewCallable = httpsCallable(functions, 'reviewDriverRequest');
  const result = await reviewCallable({ targetUid, decision });
  return result.data;
};

export default {
  requestDriverApproval,
  reviewDriverRequest,
};
