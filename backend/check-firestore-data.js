import { config } from 'dotenv';
import { getFirestore } from './src/utils/firebase.js';

// Carregar variáveis de ambiente
config();

console.log('🔍 Verificando dados no Firestore...');

try {
  const db = getFirestore();
  
  // Verificar coleção tides
  console.log('\n📋 Verificando coleção "tides"...');
  const tidesCollection = db.collection('tides');
  const snapshot = await tidesCollection.limit(5).get();
  
  if (snapshot.empty) {
    console.log('❌ Nenhum documento encontrado na coleção "tides"');
  } else {
    console.log(`✅ Encontrados ${snapshot.size} documentos na coleção "tides"`);
    
    snapshot.forEach(doc => {
      const data = doc.data();
      console.log(`📄 Documento ID: ${doc.id}`);
      console.log(`   - Fonte: ${data.source || 'N/A'}`);
      console.log(`   - Eventos: ${data.events?.length || 0}`);
      console.log(`   - Criado: ${data.createdAt || 'N/A'}`);
      console.log(`   - Expira: ${data.expiresAt || 'N/A'}`);
    });
  }
  
  // Verificar especificamente para sape
  console.log('\n🏄 Verificando dados para spot "sape"...');
  const today = new Date().toISOString().split('T')[0];
  const sapeDoc = await db.collection('tides').doc(`sape_${today}`).get();
  
  if (sapeDoc.exists) {
    const data = sapeDoc.data();
    console.log('✅ Dados encontrados para sape hoje:');
    console.log(`   - Fonte: ${data.source}`);
    console.log(`   - Eventos de maré: ${data.events?.length || 0}`);
    console.log(`   - Min: ${data.min}m, Max: ${data.max}m`);
  } else {
    console.log('❌ Nenhum dado encontrado para sape hoje');
  }
  
} catch (error) {
  console.error('❌ Erro ao verificar Firestore:', error.message);
}
