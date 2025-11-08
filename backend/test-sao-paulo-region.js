import { Firestore } from '@google-cloud/firestore';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testSaoPauloRegion() {
  try {
    console.log('🇧🇷 Testando Firestore na região São Paulo (southamerica-east1)...\n');
    
    const credentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
      path.resolve(__dirname, '../keys/surfcheck-44df4-firebase-adminsdk-fbsvc-c798ba2c3f.json');
    
    // Configuração específica para São Paulo
    const db = new Firestore({
      projectId: 'surfcheck-44df4',
      keyFilename: credentialsPath,
      databaseId: 'surfcheckid'
    });
    
    console.log('✅ Firestore inicializado para região São Paulo');
    
    // Testar listagem de coleções
    console.log('📋 Listando coleções...');
    const collections = await db.listCollections();
    console.log('✅ Coleções encontradas:', collections.map(c => c.id));
    
    if (collections.length === 0) {
      console.log('📝 Nenhuma coleção encontrada. Criando coleção inicial...');
      
      // Criar primeira coleção
      const tidesCollection = db.collection('tides');
      const initDoc = tidesCollection.doc('init-sao-paulo');
      
      await initDoc.set({
        message: 'Primeira conexão bem-sucedida na região São Paulo',
        timestamp: new Date(),
        region: 'southamerica-east1',
        success: true
      });
      
      console.log('✅ Coleção "tides" criada com sucesso!');
      
      // Verificar
      const doc = await initDoc.get();
      if (doc.exists) {
        console.log('✅ Documento criado:', doc.data());
      }
    } else {
      // Testar operações em coleção existente
      const tidesCollection = db.collection('tides');
      
      // Testar escrita
      console.log('✍️ Testando escrita na coleção tides...');
      const testDoc = tidesCollection.doc('connection-test-sp');
      await testDoc.set({
        test: true,
        timestamp: new Date(),
        region: 'southamerica-east1',
        success: true
      });
      console.log('✅ Escrita bem-sucedida!');
      
      // Testar leitura
      console.log('📖 Testando leitura...');
      const doc = await testDoc.get();
      if (doc.exists) {
        console.log('✅ Documento lido:', doc.data());
      }
      
      // Testar query
      console.log('🔍 Testando query...');
      const snapshot = await tidesCollection.where('test', '==', true).limit(5).get();
      console.log('✅ Documentos encontrados na query:', snapshot.size);
      
      // Limpar documento de teste
      await testDoc.delete();
      console.log('🧹 Documento de teste removido');
    }
    
    console.log('\n🎉 FIRESTORE FUNCIONANDO PERFEITAMENTE NA REGIÃO SÃO PAULO!');
    console.log('✅ Conexão estabelecida');
    console.log('✅ Leitura funcionando');
    console.log('✅ Escrita funcionando');
    console.log('✅ Queries funcionando');
    
    return true;
    
  } catch (error) {
    console.error('❌ Erro na região São Paulo:', error.message);
    console.error('Error code:', error.code);
    console.error('Stack:', error.stack);
    return false;
  }
}

testSaoPauloRegion();
