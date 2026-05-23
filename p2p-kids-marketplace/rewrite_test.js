const fs = require('fs');
const path = require('path');

const filePath = path.join(process.cwd(), 'src/screens/dashboard/__tests__/UserDashboardScreen.test.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// replace invalid hooks module
content = content.replace(/import \{ useSPWallet \} from '@\/hooks\/useSPWallet';/g, '');
content = content.replace(/import \{ useAuth \} from '@\/hooks\/useAuth';/g, 'import { useAuth, useSPWallet } from \'@/hooks/useAuth\';');

// update jest mock
content = content.replace(/jest.mock\('@\/hooks\/useAuth'\);/g, `jest.mock('@/hooks/useAuth', () => ({
  useAuth: jest.fn(),
  useSPWallet: jest.fn(),
}));`);
content = content.replace(/jest.mock\('@\/hooks\/useSPWallet'\);/g, '');

content = content.replace(/jest.mock\('@\/components\/atoms\/Avatar', \(\) => 'Avatar'\);/g, "jest.mock('@/components/atoms/Avatar', () => 'Avatar');\njest.mock('@/components/TrialReminderBanner', () => ({ TrialReminderBanner: () => null }));\njest.mock('@/components/GracePeriodBanner', () => 'GracePeriodBanner');\njest.mock('@/components/subscription/PaymentFailureBanner', () => ({ PaymentFailureBanner: () => null }));\njest.mock('@/components/molecules/ResumeDraftBanner', () => ({ ResumeDraftBanner: () => null }));");

content = content.replace(/jest.mock\('@\/components\/organisms\/SubscriptionBanners', \(\) => \(\{[^}]+\}\)\);/gs, "");

fs.writeFileSync(filePath, content);
console.log('Fixed test file.');
