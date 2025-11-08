import { config } from 'dotenv';
import { getFirestore } from './src/utils/firebase.js';

// Carregar variáveis de ambiente
config();

console.log('🔍 DEBUG: Verificando configuração do cache');
console.log('==========================================');

// Verificar variáveis de ambiente
console.log('📋 Variáveis de ambiente:');
console.log(`USE_FIRESTORE_CACHE: "${process.env.USE_FIRESTORE_CACHE}"`);
console.log(`FIRESTORE_TIDES_COLLECTION: "${process.env.FIRESTORE_TIDES_COLLECTION}"`);
console.log(`TIDES_TTL_HOURS: "${process.env.TIDES_TTL_HOURS}"`);
console.log(`GOOGLE_APPLICATION_CREDENTIALS: "${process.env.GOOGLE_APPLICATION_CREDENTIALS}"`);

// Verificar se cache está habilitado
const useFirestoreCache = process.env.USE_FIRESTORE_CACHE === 'true';
console.log(`\n🔧 Cache status: ${useFirestoreCache ? '✅ ENABLED' : '❌ DISABLED'}`);

if (useFirestoreCache) {
  try {
    console.log('\n🔥 Testando conexão com Firestore...');
    const db = getFirestore();
    
    // Testar escrita
    const testDoc = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Teste de conexão'
    };
    
    const docRef = db.collection('test').doc('connection-test');
    await docRef.set(testDoc);
    console.log('✅ Escrita no Firestore: SUCCESS');
    
    // Testar leitura
    const snapshot = await docRef.get();
    if (snapshot.exists) {
      console.log('✅ Leitura do Firestore: SUCCESS');
      console.log('📄 Dados lidos:', snapshot.data());
    } else {
      console.log('❌ Documento não encontrado após escrita');
    }
    
    // Limpar teste
    await docRef.delete();
    console.log('🧹 Documento de teste removido');
    
  } catch (error) {
    console.error('❌ Erro ao testar Firestore:', error.message);
    console.error('Stack:', error.stack);
  }
} else {
  console.log('\n⚠️  Cache desabilitado - verifique USE_FIRESTORE_CACHE=true no .env');
}
