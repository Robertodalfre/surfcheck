import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  GoogleAuthProvider, 
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  User
} from 'firebase/auth';

// Configuração do Firebase
// ATENÇÃO: Em produção, essas informações devem vir de variáveis de ambiente
const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const authDomain = import.meta.env.VITE_FIREBASE_AUTH_DOMAIN;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;
const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET;
const messagingSenderId = import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID;
const appId = import.meta.env.VITE_FIREBASE_APP_ID;

// Validação explícita das variáveis de ambiente (evita erro genérico auth/invalid-api-key)
const missingOrPlaceholder: string[] = [];
const isPlaceholder = (v?: string) => {
  const s = (v ?? '').toString().trim();
  if (!s) return true; // vazio
  // Marca valores de exemplo como inválidos
  return s.startsWith('your_') ||
         s.includes('your_project_id') ||
         s.includes('your_messaging_sender_id') ||
         s.includes('your_api_key') ||
         s.includes('your_app_id');
};

if (isPlaceholder(apiKey)) missingOrPlaceholder.push('VITE_FIREBASE_API_KEY');
if (isPlaceholder(authDomain)) missingOrPlaceholder.push('VITE_FIREBASE_AUTH_DOMAIN');
if (isPlaceholder(projectId)) missingOrPlaceholder.push('VITE_FIREBASE_PROJECT_ID');
if (isPlaceholder(storageBucket)) missingOrPlaceholder.push('VITE_FIREBASE_STORAGE_BUCKET');
if (isPlaceholder(messagingSenderId)) missingOrPlaceholder.push('VITE_FIREBASE_MESSAGING_SENDER_ID');
if (isPlaceholder(appId)) missingOrPlaceholder.push('VITE_FIREBASE_APP_ID');

if (missingOrPlaceholder.length) {
  // Importante: lançar erro antes de inicializar o Firebase, para mensagem clara no console
  throw new Error(
    `Configuração Firebase ausente ou inválida. Defina as variáveis no .env correto para o modo atual:\n` +
    missingOrPlaceholder.map(k => `- ${k}`).join('\n') +
    `\nDica: use .env.local para desenvolvimento (npm run dev) e .env.production para build de produção (vite build --mode production).`
  );
}

const firebaseConfig = {
  apiKey,
  authDomain,
  projectId,
  storageBucket,
  messagingSenderId,
  appId
};

// Inicializa o Firebase apenas se ainda não foi inicializado
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Configurações adicionais do provedor do Google
googleProvider.setCustomParameters({
  prompt: 'select_account', // Força a seleção de conta a cada login
});

// Função para login com Google
export const signInWithGoogle = async () => {
  try {
    // Alguns navegadores/ambientes com COOP/COEP ou Safari têm restrições a popups
    const shouldUseRedirect = (() => {
      // crossOriginIsolated costuma estar true quando COOP/COEP estão ativos
      if ((window as any).crossOriginIsolated) return true;
      const ua = navigator.userAgent;
      const isSafari = /Safari\//.test(ua) && !/Chrome\//.test(ua);
      const isIOS = /iPhone|iPad|iPod/.test(ua);
      return isSafari || isIOS;
    })();

    if (shouldUseRedirect) {
      await signInWithRedirect(auth, googleProvider);
      // Resultado será processado após redirecionamento
      const redirectResult = await getRedirectResult(auth);
      if (redirectResult) {
        const credential = GoogleAuthProvider.credentialFromResult(redirectResult);
        const token = credential?.idToken;
        return { user: redirectResult.user, token };
      }
      return { user: auth.currentUser, token: undefined };
    }

    // Tenta popup primeiro em ambientes normais
    const result = await signInWithPopup(auth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.idToken;
    return { user: result.user, token };
  } catch (error: any) {
    // Fallback para redirect em erros comuns de popup
    const code = error?.code || '';
    const popupErrors = [
      'auth/popup-blocked',
      'auth/popup-closed-by-user',
      'auth/cancelled-popup-request',
    ];
    if (popupErrors.includes(code)) {
      try {
        await signInWithRedirect(auth, googleProvider);
        const redirectResult = await getRedirectResult(auth);
        if (redirectResult) {
          const credential = GoogleAuthProvider.credentialFromResult(redirectResult);
          const token = credential?.idToken;
          return { user: redirectResult.user, token };
        }
        return { user: auth.currentUser, token: undefined };
      } catch (err) {
        console.error('Erro no fallback redirect:', err);
        throw err;
      }
    }
    console.error('Erro ao fazer login com Google:', error);
    throw error;
  }
};

// Função para logout
export const signOut = async () => {
  try {
    await firebaseSignOut(auth);
    return true;
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
    throw error;
  }
};

// Função para observar mudanças no estado de autenticação
export const onAuthStateChanged = (callback: (user: User | null) => void) => {
  return firebaseOnAuthStateChanged(auth, callback);
};

// Função para obter o usuário atual
export const getCurrentUser = (): Promise<User | null> => {
  return new Promise((resolve, reject) => {
    const unsubscribe = firebaseOnAuthStateChanged(
      auth,
      (user) => {
        unsubscribe();
        resolve(user);
      },
      reject
    );
  });
};

// Exporta as funções necessárias
export { 
  auth, 
  googleProvider, 
  onAuthStateChanged as onAuthStateChangedListener 
};

export default app;
